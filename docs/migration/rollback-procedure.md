# Rollback Procedure

## Decision Tree

```
Has the new model accepted any business writes?
├── NO → Full rollback (safe)
│   1. Enable maintenance mode
│   2. Deploy previous application version
│   3. Restore pre-cutover database from backup
│   4. Validate pre-migration manifest against restored database
│   5. Repoint connection variables to restored database
│   6. Re-run prisma migrate resolve for baseline if needed
│   7. Disable maintenance mode
│   8. Verify application functionality
│
└── YES → Incident procedure (dangerous)
    1. Enable maintenance mode immediately
    2. Export all new-model documents created since cutover
    3. Restore pre-cutover database
    4. Reconcile exported documents into old model (manual)
    5. Deploy previous application version
    6. Validate and open
    ** Do NOT reopen old application without restoring — this creates two diverging sources of truth
```

## Full Rollback (No New Writes Accepted)

### Step 1: Enable Maintenance Mode
```bash
export MAINTENANCE_MODE=1
# Redeploy or restart application
```

### Step 2: Deploy Previous Application
```bash
# Deploy the commit hash from before the migration release
git checkout <pre-migration-commit>
# Build and deploy
```

### Step 3: Restore Database
Choose the appropriate restore method:

#### Option A: Neon Branch Restore (fastest)
- In Neon console, restore the pre-cutover branch or create a new branch from the restore point
- Update DATABASE_URL and DIRECT_URL to point to the restored branch

#### Option B: pg_dump Restore
```bash
# If you created a pg_dump during snapshot:
# Drop and recreate target database if needed
pg_restore --no-owner --no-privileges -d "$DATABASE_URL" -v backup-*.dump
```

### Step 4: Validate Restored Database
```bash
npm run migration:manifest:pre
# Compare with pre-migration manifest from snapshot phase
# Row counts, financials, and checksums must match exactly
```

### Step 5: Resolve Migration State
```bash
# If using the same database instance (restored):
# Prisma's _prisma_migrations table was restored too — migrations should be consistent
npx prisma migrate status

# If the _prisma_migrations table was not restored:
# Mark existing migrations as applied:
npx prisma migrate resolve --applied 20260620000000_baseline
npx prisma migrate resolve --applied 20260621000000_add_simple_inventory_mode
# Do NOT mark the expand migration as applied on the old schema
```

### Step 6: Disable Maintenance Mode
```bash
export MAINTENANCE_MODE=0
# Redeploy or restart application
```

### Step 7: Verify
- [ ] Authentication works
- [ ] Store selection works
- [ ] Cashier checkout works
- [ ] Inventory views are correct
- [ ] Reports match pre-migration data
- [ ] No error spikes

## Post-Rollback Cleanup
- Update runbook with rollback decision and timestamp
- Document root cause of rollback
- Retain migration artifacts (reports, manifests, dumps)
- Schedule new migration attempt after root cause is fixed

## Incident Procedure (New Writes Existed)

**WARNING**: This is complex and data-loss-prone. Avoid this path.

1. **Pause everything**: Enable maintenance mode immediately
2. **Export new writes**: Query all tables in the new model created after cutover timestamp
   ```sql
   SELECT * FROM "Order" WHERE "createdAt" > '<cutover_timestamp>';
   SELECT * FROM "OrderLine" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "createdAt" > '<cutover_timestamp>');
   SELECT * FROM "StockMovement" WHERE "createdAt" > '<cutover_timestamp>';
   SELECT * FROM "IdempotencyRecord" WHERE "createdAt" > '<cutover_timestamp>';
   -- Export all new data as JSON/CSV
   ```
3. **Restore database** (as in Full Rollback steps 2-4)
4. **Manually reconcile**: Replay the exported documents into the old model tables
   - This requires custom scripts and manual verification
   - Document every replayed transaction
5. **Deploy old application and validate** (as in Full Rollback steps 5-7)
6. **Notify stakeholders** of the replayed transactions

## Prohibited Actions
- Never revert the migration DDL without restoring data
- Never run `prisma migrate reset` on production
- Never delete migration rows from `_prisma_migrations` manually
- Never reopen old application writes without restoring the database first
- Never attempt reverse synchronization from new model to old model
