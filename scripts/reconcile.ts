#!/usr/bin/env npx tsx
// Scheduled reconciliation script comparing StockBalance against StockMovement sums.
// Alerts on any delta. Suitable for cron/CI scheduled execution.
// Usage: npx tsx scripts/reconcile.ts

import { PrismaClient } from "@/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import "dotenv/config"

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const start = Date.now()
  console.log("Starting ledger reconciliation...")

  const result = await prisma.$queryRawUnsafe<Array<{
    itemId: string
    itemName: string
    tokoId: string
    balanceQty: string
    ledgerSum: string
    diff: string
  }>>(
    `SELECT
      sb."itemId",
      i.name AS "itemName",
      i."tokoId",
      sb.quantity::text AS "balanceQty",
      COALESCE(SUM(sm.quantity), 0)::text AS "ledgerSum",
      (sb.quantity - COALESCE(SUM(sm.quantity), 0))::text AS "diff"
     FROM "StockBalance" sb
     JOIN "Item" i ON i.id = sb."itemId"
     LEFT JOIN "StockMovement" sm ON sm."itemId" = sb."itemId"
     GROUP BY sb."itemId", i.name, i."tokoId", sb.quantity
     HAVING sb.quantity != COALESCE(SUM(sm.quantity), 0)
     ORDER BY ABS(sb.quantity - COALESCE(SUM(sm.quantity), 0)) DESC`
  )

  const totalItems = await prisma.item.count()

  console.log(`Checked ${totalItems} items. ${result.length} mismatches found.`)

  if (result.length > 0) {
    console.error("RECONCILIATION FAILURE DETECTED:")
    for (const row of result) {
      console.error(`  Item ${row.itemId} (${row.itemName}, toko ${row.tokoId}): balance=${row.balanceQty} ledger=${row.ledgerSum} diff=${row.diff}`)
    }
    process.exit(1)
  }

  // Also check duplicate dedupe keys
  const dupDedupe = await prisma.$queryRawUnsafe<Array<{ dedupeKey: string; cnt: number }>>(
    `SELECT "dedupeKey", COUNT(*) as cnt FROM "StockMovement" GROUP BY "dedupeKey" HAVING COUNT(*) > 1`
  )
  if (dupDedupe.length > 0) {
    console.error("DUPLICATE DEDUPE KEYS FOUND:")
    for (const d of dupDedupe) {
      console.error(`  ${d.dedupeKey}: ${d.cnt} occurrences`)
    }
    process.exit(1)
  }

  // Check duplicate order numbers within same store
  const dupOrders = await prisma.$queryRawUnsafe<Array<{ tokoId: string; number: string; cnt: number }>>(
    `SELECT "tokoId", number, COUNT(*) as cnt FROM "Order" GROUP BY "tokoId", number HAVING COUNT(*) > 1`
  )
  if (dupOrders.length > 0) {
    console.error("DUPLICATE ORDER NUMBERS FOUND:")
    for (const d of dupOrders) {
      console.error(`  toko ${d.tokoId}: ${d.number} x${d.cnt}`)
    }
    process.exit(1)
  }

  // Orphan FKs
  const orphans = await prisma.$queryRawUnsafe<Array<{ sourceTable: string; sourceId: string; targetTable: string; missingId: string }>>(
    `SELECT 'PurchaseLine' AS "sourceTable", pl.id AS "sourceId", 'Item' AS "targetTable", pl."itemId" AS "missingId"
     FROM "PurchaseLine" pl WHERE NOT EXISTS (SELECT 1 FROM "Item" i WHERE i.id = pl."itemId")
     UNION ALL
     SELECT 'OrderLine', ol.id, 'Item', ol."itemId"
     FROM "OrderLine" ol WHERE NOT EXISTS (SELECT 1 FROM "Item" i WHERE i.id = ol."itemId")
     UNION ALL
     SELECT 'ProductionLine', prl.id, 'Item', prl."itemId"
     FROM "ProductionLine" prl WHERE prl."itemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Item" i WHERE i.id = prl."itemId")
     UNION ALL
     SELECT 'StockMovement', sm.id, 'Item', sm."itemId"
     FROM "StockMovement" sm WHERE NOT EXISTS (SELECT 1 FROM "Item" i WHERE i.id = sm."itemId")`
  )
  if (orphans.length > 0) {
    console.error("ORPHAN FK REFERENCES FOUND:")
    for (const o of orphans) {
      console.error(`  ${o.sourceTable} ${o.sourceId} -> ${o.targetTable} ${o.missingId}`)
    }
    process.exit(1)
  }

  console.log(`Reconciliation PASSED in ${Date.now() - start}ms. No issues found.`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
