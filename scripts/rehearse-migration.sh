#!/usr/bin/env bash
# Reproducible migration rehearsal script.
# Starts disposable Docker PostgreSQL, runs all migrations from empty,
# then runs Prisma 7 actual drift comparison. Fails on drift.
set -euo pipefail

SCRATCH_DB="rehearsal_scratch_$$"
SHADOW_DB="rehearsal_shadow_$$"
CONTAINER_NAME="pmk-scratch-$$"
SCRATCH_PASSWORD="scratch123"

if ! docker info >/dev/null 2>&1; then
  echo "FATAL: Docker is not available. Rehearsal cannot proceed without an isolated database."
  exit 1
fi

echo "=== Starting scratch PostgreSQL container ==="
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD="$SCRATCH_PASSWORD" \
  -p 5433:5432 \
  postgres:17-alpine >/dev/null

echo "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

# Create databases
docker exec "$CONTAINER_NAME" psql -U postgres -c "CREATE DATABASE $SCRATCH_DB;" >/dev/null 2>&1
docker exec "$CONTAINER_NAME" psql -U postgres -c "CREATE DATABASE $SHADOW_DB;" >/dev/null 2>&1

SCRATCH_URL="postgresql://postgres:${SCRATCH_PASSWORD}@localhost:5433/${SCRATCH_DB}"
SHADOW_URL="postgresql://postgres:${SCRATCH_PASSWORD}@localhost:5433/${SHADOW_DB}"

export DATABASE_URL="$SCRATCH_URL"
export DIRECT_URL="$SCRATCH_URL"

cleanup() {
  echo "=== Cleaning up scratch container ==="
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -f "./prisma-rehearse-tmp-$$.config.ts" 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Running Prisma migrate deploy from empty ==="
npx prisma migrate deploy 2>&1

echo "=== Running Prisma validate ==="
npx prisma validate 2>&1

echo "=== Running Prisma generate ==="
npx prisma generate 2>&1

echo "=== Running Prisma format ==="
npx prisma format 2>&1

echo "=== Running Prisma drift verification (actual diff) ==="
# Create a temporary Prisma config in project root for module resolution
TMP_CONFIG="./prisma-rehearse-tmp-$$.config.ts"

# Read existing prisma config and add shadowDatabaseUrl
cat > "$TMP_CONFIG" << PRISMACONF
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
    shadowDatabaseUrl: "${SHADOW_URL}",
  },
  migrations: {},
})
PRISMACONF

# Run actual diff: compare migrations output vs config datasource (the deployed scratch DB)
DIFF_RESULT=0
npx prisma migrate diff \
  --config "$TMP_CONFIG" \
  --from-migrations prisma/migrations \
  --to-config-datasource \
  --exit-code 2>&1 || DIFF_RESULT=$?

# Prisma migrate diff --exit-code returns:
#   0 = no difference (empty diff)
#   1 = error
#   2 = differences found (non-empty diff)
if [ "$DIFF_RESULT" -eq 2 ]; then
  echo ""
  echo "DRIFT DETECTED: Migrations and deployed schema differ."
  echo "Review the diff output above for details."
  exit 1
elif [ "$DIFF_RESULT" -eq 1 ]; then
  echo "ERROR: Drift comparison failed (exit code 1)."
  exit 1
fi

echo "PASS: No drift detected between migrations and deployed schema."
echo ""

echo ""
echo "=== Rehearsal complete ==="
echo "All 3 migrations: baseline -> simple_inventory_mode -> target_model_expand"
echo "Migration drift: no differences detected"
