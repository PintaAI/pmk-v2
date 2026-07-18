# Operator Evidence Checklist & Template

## Rules
- Every step records `startedAt`, `completedAt`, `operator`, `reviewer`, `command/script version`, `result`, `artifact checksum`, and `evidence URL`.
- Operators MUST NOT continue past a failed gate by manually editing the report.
- Automatic stop on any error, warning, or unresolved ambiguity.
- No manual override of verification failures.
- All timestamps in ISO-8601 UTC.
- No credentials or customer secrets in evidence.

## Evidence Template

```json
{
  "migrationId": "YYYYMMDD-HHMMSS",
  "environment": "production",
  "operators": ["name1", "name2"],
  "reviewer": "name3",
  "startedAt": "2026-01-01T00:00:00Z",
  "steps": [
    {
      "stepNumber": 1,
      "name": "T-24: Confirm rehearsal success",
      "startedAt": "ISO8601",
      "completedAt": "ISO8601",
      "operator": "operator-name",
      "command": "exact command run",
      "scriptVersion": "git commit SHA",
      "result": "PASS|FAIL|SKIP",
      "output": "summary of output",
      "artifactChecksum": "sha256",
      "evidenceUrl": "link to screenshot/log/artifact"
    }
  ],
  "gates": [
    {
      "name": "Unmapped rows",
      "expected": 0,
      "actual": 0,
      "passed": true
    }
  ],
  "resolution": "completed|rolled-back",
  "completedAt": "ISO8601"
}
```

## Required Evidence Per Step

### Phase: Preparation
1. Rehearsal output (full console log)
2. Migration status output for scratch/staging/production
3. Pre-migration manifest JSON with checksum
4. pg_dump checksum and restore validation log
5. Neon branch/restore point ID
6. Maintenance mode test results across all transports

### Phase: Freeze
7. Active connection count before freeze
8. 503 response samples from Server Actions, API v1, and auth mutations
9. Final pre-freeze transaction watermark

### Phase: Expand
10. `prisma migrate deploy` output
11. `prisma migrate status` output
12. Old-application read test results

### Phase: Backfill
13. Migration run ID from console
14. Full console output of backfill script
15. Phase completion timestamps per store

### Phase: Verify
16. Migration report JSON (from MIGRATION_OUTPUT_DIR)
17. Manifest post-backfill JSON
18. Reconciliation output (`migration:reconcile`)
19. Ambiguity report (zero unresolved entries)
20. Reviewer sign-off (timestamped)

### Phase: Deploy
21. Deployment pipeline log
22. Instance version checks
23. Old instance drain confirmation

### Phase: Smoke
24. Read-only check results per endpoint
25. Controlled write results
26. Balance/ledger verification after test writes

### Phase: Open
27. Go approval record (timestamp, reviewer)
28. Post-open error rate baseline
29. T+15 reconciliation output
30. T+60 reconciliation and manifest comparison
31. T+24h reconciliation and manifest comparison
