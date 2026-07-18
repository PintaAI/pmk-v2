# Backup / Restore Validation & Manifest Procedure

## Backup Procedure

### Prerequisites
- `DIRECT_URL` environment variable configured with direct PostgreSQL connection (not pooled)
- `pg_dump` version matching the target PostgreSQL version
- Sufficient disk space for the dump file

### Create Backup
```bash
export PGPASSWORD="<from DIRECT_URL>"
pg_dump \
  -Fc \
  --no-owner \
  --no-privileges \
  -d "$DIRECT_URL" \
  -f "backup-$(date +%Y%m%d-%H%M%S).dump"
```

### Record Checksums
```bash
sha256sum backup-*.dump > backup-checksums.txt
cat backup-checksums.txt
```

### Verify Backup Size
```bash
ls -lh backup-*.dump
```

## Restore Validation

### Prerequisites
- Scratch PostgreSQL instance (Docker or Neon branch)
- Same PostgreSQL major version as production

### Start Scratch Database
```bash
docker run -d --name pg-restore-test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=test123 \
  -e POSTGRES_DB=restore_test \
  -p 5439:5432 \
  postgres:17-alpine
```

### Restore
```bash
export PGPASSWORD=test123
pg_restore \
  --no-owner \
  --no-privileges \
  -d "postgresql://postgres:test123@localhost:5439/restore_test" \
  -v \
  backup-*.dump
```

### Validate Restored Database

1. Run Prisma migrate status (confirm schema matches):
```bash
DATABASE_URL="postgresql://postgres:test123@localhost:5439/restore_test" \
DIRECT_URL="postgresql://postgres:test123@localhost:5439/restore_test" \
npx prisma migrate status
```

2. Run pre-migration manifest against restored database:
```bash
DATABASE_URL="postgresql://postgres:test123@localhost:5439/restore_test" \
APPROVED_DB_NAME=restore_test \
APPROVED_DB_HOST=localhost \
APPROVED_DB_FINGERPRINT=restore_test \
npm run migration:manifest:pre
```

3. Compare manifest with production pre-migration manifest:
   - Row counts must match
   - Financial totals must match
   - Per-store counts must match
   - Checksums must match

4. Sample data verification:
```sql
SELECT COUNT(*) FROM "Bahan";
SELECT COUNT(*) FROM "Product";
SELECT COUNT(*) FROM "Sale";
SELECT COUNT(*) FROM "Pesanan";
SELECT COUNT(*) FROM "Belanja";
SELECT COUNT(*) FROM "Production";
SELECT COUNT(*) FROM "InventoryMovement";
SELECT COUNT(*) FROM "ActivityLog";
```

5. Clean up scratch database:
```bash
docker stop pg-restore-test && docker rm pg-restore-test
```

## Validation Sign-off

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| Dump file exists and non-zero size | > 0 bytes | | |
| Dump checksum matches recorded | match | | |
| Restore completes without errors | exit 0 | | |
| Row counts match production manifest | exact match | | |
| Financial totals match | exact match | | |
| Checksums match | exact match | | |
| Sample queries return expected data | non-zero | | |

Operator: _____________  Reviewer: _____________  Date: _____________
