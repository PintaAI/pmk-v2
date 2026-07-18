# Production Cutover Runbook

## Prerequisites
- [ ] Rehearsal completed successfully on a production copy with zero unresolved report entries
- [ ] Backup restore validated on a scratch database
- [ ] Existing production schema reviewed against the baseline and `20260620000000_baseline` recorded as applied
- [ ] Release commit approved and tagged
- [ ] Rollback owners identified and available
- [ ] Migration report output directory configured (MIGRATION_OUTPUT_DIR env var)
- [ ] Maintenance mode tested on staging

## T-24 hours
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 1 | Confirm rehearsal success on production copy | | | | | | |
| 2 | Verify zero unresolved migration report entries | | | | | | |
| 3 | Test backup restore into scratch database | | | | | | |
| 4 | Confirm approved release commit | | | `git log --oneline -1` | | | |
| 5 | Confirm rollback owners available | | | | | | |

## T-30 minutes
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 6 | Stop non-essential scheduled jobs/scripts | | | | | | |
| 7 | Verify database identity | | `env | grep DATABASE_URL` | | | | |
| 8 | Run prisma migrate status | | `npx prisma migrate status` | | | | |
| 8a | Record baseline on an existing database if status shows it pending; do not execute baseline DDL | | `npx prisma migrate resolve --applied 20260620000000_baseline` | | | | |
| 9 | Confirm no unexpected schema drift | | `bash scripts/rehearse-migration.sh` | | | | |
| 10 | Announce write window start | | | | | | |

## Freeze
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 11 | Set MAINTENANCE_MODE=1 | | `export MAINTENANCE_MODE=1` | | | | |
| 12 | Verify Server Actions return 503 | | Test write via cashier checkout | | | | |
| 13 | Verify API v1 mutations return 503 | | `curl -X POST /api/v1/stores/{id}/orders/checkout` | | | | |
| 14 | Verify Better Auth write mutations blocked | | Test store creation | | | | |
| 15 | Wait for in-flight transactions to complete | | Monitor active connections | | | | |

## Snapshot
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 16 | Record transaction watermark | | `SELECT txid_current()` | | | | |
| 17 | Generate pre-cutover manifest | | `npm run migration:manifest:pre` | | | | |
| 18 | Create Neon restore point | | Via Neon console/CLI | | | | |
| 19 | Create logical pg_dump | | `pg_dump -Fc -f backup.dump` | | | | |
| 20 | Record dump checksum | | `sha256sum backup.dump` | | | | |
| 21 | Verify dump completeness | | Restore to scratch and run manifest | | | | |

## Expand
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 22 | Deploy expand migrations | | `npx prisma migrate deploy` | | | | |
| 23 | Verify migration status shows all applied | | `npx prisma migrate status` | | | | |
| 24 | Verify old application reads still work | | GET dashboard/reports endpoints | | | | |
| 25 | Run prisma validate | | `npx prisma validate` | | | | |

## Backfill
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 26 | Set approved DB identity env vars | | `export APPROVED_DB_*` | | | | |
| 27 | Run migration backfill | | `npm run migration:backfill` | | | | |
| 28 | Record migration run ID | | From console output | | | | |
| 29 | Verify backfill completed without errors | | Exit code 0 | | | | |

## Verify
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 30 | Run row-level verification gates | | Run phase 5 reconciliation | | | | |
| 31 | Run canonical checksum comparisons | | From migration report | | | | |
| 32 | Run financial comparisons | | Compare pre/post manifest | | | | |
| 33 | Run balance/ledger reconciliation | | `npm run migration:reconcile` | | | | |
| 34 | Run orphan checks | | From migration report | | | | |
| 35 | Run ambiguity report check | | Zero unresolved entries required | | | | |
| 36 | Reviewer signs off on report | | Second operator review | | | | |
| 37 | AUTO NO-GO if any gate fails | | Do not proceed if any error | | | | |

## Deploy
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 38 | Deploy new-model code | | Deployment pipeline | | | | |
| 39 | Confirm all instances running approved commit | | Check version endpoints | | | | |
| 40 | Confirm old instances drained | | Load balancer health checks | | | | |

## Smoke
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 41 | Read-only health checks | | GET dashboard, reports, inventory | | | | |
| 42 | Controlled write in migration test store | | Create order, purchase, production | | | | |
| 43 | Verify document creation | | GET created documents | | | | |
| 44 | Verify movement creation | | GET inventory/movements | | | | |
| 45 | Verify balance update | | GET inventory/balances | | | | |
| 46 | Verify audit log | | GET activity | | | | |
| 47 | Verify API v1 responses | | Test key endpoints | | | | |

## Open
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 48 | Reviewer grants explicit go approval | | | | | | |
| 49 | Disable maintenance mode | | `export MAINTENANCE_MODE=0` | | | | |
| 50 | Start heightened monitoring | | Watch dashboards | | | | |
| 51 | Verify write traffic resumes | | Monitor new orders/movements | | | | |

## T+15 minutes
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 52 | Run reconciliation | | `npm run migration:reconcile` | | | | |
| 53 | Check error rates | | Monitor logs | | | | |
| 54 | Check stock conflicts | | Monitor insufficient stock errors | | | | |

## T+60 minutes
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 55 | Run reconciliation | | `npm run migration:reconcile` | | | | |
| 56 | Compare post-cutover manifest to pre-cutover | | `npm run migration:manifest:post` | | | | |
| 57 | Check revenue comparisons | | Compare manifests | | | | |

## T+24 hours
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 58 | Full reconciliation run | | `npm run migration:reconcile` | | | | |
| 59 | Generate post-cutover manifest | | `npm run migration:manifest:post` | | | | |
| 60 | Compare with pre-cutover + test transactions | | Manual comparison | | | | |
| 61 | Review error logs for 24h period | | Check monitoring | | | | |

## Rollback Window
| Step | Description | Operator | Command | Started | Completed | Result | Checksum |
|------|-------------|----------|---------|---------|-----------|--------|----------|
| 62 | Keep old tables read-only | | No DROP until retention approval | | | | |
| 63 | Keep backups accessible | | Verify backup integrity | | | | |
| 64 | Contract cleanup is separate release | | Deferred | | | | |

**STOP RULES**: Operators MUST NOT continue past any failed gate by manually editing the report. Any non-zero unexplained result is an automatic no-go. If any step fails, follow the rollback procedure.
