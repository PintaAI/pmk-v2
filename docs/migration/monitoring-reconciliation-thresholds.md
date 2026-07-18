# Monitoring & Reconciliation Thresholds and Incident Write-Freeze Triggers

## Continuous Monitoring Thresholds

### API Performance
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| p95 latency (POST/PATCH) | > 500ms | > 2000ms | Scale / investigate |
| p95 latency (GET) | > 200ms | > 1000ms | Scale / investigate |
| Error rate (5xx) | > 1% | > 5% | Immediate investigation |
| Error rate (4xx) | > 10% | > 25% | Check for client issues |
| Checkout throughput | < 10/min | < 1/min | Scale / investigate |

### Database
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Active connections | > 80% pool | > 95% pool | Scale / restart |
| Replication lag | > 1s | > 5s | Investigate primary |
| Deadlocks/minute | > 1 | > 5 | Investigate contention |
| Long-running queries | > 5s | > 30s | Kill and investigate |

### Business Metrics
| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Insufficient stock errors | > 1% of checkouts | > 5% | Restock / adjust |
| Idempotency conflicts | > 5/minute | > 20/minute | Check client retry logic |
| Reversal rate | > 1% of orders | > 5% | Investigate UX |
| Stock balance drift | Any non-zero | Any non-zero | Write freeze |

## Reconciliation Thresholds

### Ledger vs Balance (Continuous)
- **Threshold**: 0 (any non-zero is critical)
- **Schedule**: Every 15 minutes via cron
- **Command**: `npm run migration:reconcile`
- **Action on failure**:
  1. Trigger PagerDuty/on-call alert
  2. Automatically enable write freeze (MAINTENANCE_MODE=1)
  3. Log all mismatched items
  4. Manual investigation required before reopening

### Post-Cutover Reconciliation (Manual)
- **Threshold**: All gates in verification matrix must pass
- **T+15 minutes**: Run reconciliation
- **T+60 minutes**: Full reconciliation + manifest comparison
- **T+24 hours**: Full reconciliation + manifest comparison
- **Action on any failure**:
  1. Enable write freeze
  2. Do not reopen without explicit review
  3. Document all mismatches in incident report

## Write-Freeze Triggers (Automatic)

The following conditions trigger automatic `MAINTENANCE_MODE=1`:

1. **Ledger/balance mismatch**: Any non-zero difference for any item
2. **Duplicate dedupe keys in StockMovement**: Any row returned
3. **Duplicate order numbers**: Any duplicate (tokoId, number) pair
4. **Orphan FK references**: Any line referencing a non-existent item or cross-tenant item
5. **Revenue discrepancy > 1%**: Automated comparison between expected and actual
6. **Unresolved ambiguity report entries**: Any warning or error in report
7. **Reconciliation script exit code != 0**: Any non-zero exit from `migration:reconcile`

## Manual Write-Freeze Triggers

The following conditions require operator to enable `MAINTENANCE_MODE=1`:

1. Data integrity suspicion (unexpected balance changes)
2. Authentication bypass suspicion
3. Cross-tenant data exposure suspicion
4. Unexplained API error spike
5. Database performance degradation affecting writes

## Post-Incident Recovery

1. Document incident timeline, trigger, and impact
2. Identify root cause
3. Implement fix
4. Run full reconciliation before reopening
5. Generate post-incident manifest
6. Compare with pre-incident manifest
7. Reviewer approval before disabling maintenance
8. Enhanced monitoring for next 24 hours

## Monitoring Configuration

All alerts route to the operations channel. Critical alerts also trigger on-call pager.
Do not store credentials, webhook URLs, or API keys in this document.
Configure in deployment secrets/environment.

| Alert | Channel | Severity | Auto-action |
|-------|---------|----------|-------------|
| Ledger/balance drift | Ops + On-call | Critical | Auto freeze |
| API error spike | Ops | Warning | Manual review |
| Deadlock surge | Ops | Warning | Manual review |
| Reconciliation failure | Ops + On-call | Critical | Auto freeze |
