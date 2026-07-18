#!/usr/bin/env bash
# Docker-backed DB integration test harness.
# Starts isolated PostgreSQL, deploys migrations, runs integration tests, cleans up.
set -euo pipefail

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker is required for integration tests but not available."
  exit 1
fi

CONTAINER_NAME="pmk-int-$(date +%s)"
DB_NAME="pmk_test"
DB_PASS="testpass123"
DB_PORT=$((5400 + RANDOM % 100))

cleanup() {
  echo "=== Cleaning up ==="
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== Starting PostgreSQL container ==="
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "$DB_PORT":5432 \
  postgres:17-alpine >/dev/null

echo "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

export DATABASE_URL="postgresql://postgres:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"
export DIRECT_URL="$DATABASE_URL"

echo "=== Deploying migrations ==="
npx prisma migrate deploy 2>&1

echo "=== Running Prisma generate ==="
npx prisma generate 2>&1

echo "=== Running DB integration tests ==="
npx tsx --test tests/integration/db-integration.test.ts 2>&1

echo "=== Integration tests completed successfully ==="
