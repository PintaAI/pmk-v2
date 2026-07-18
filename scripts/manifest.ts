#!/usr/bin/env npx tsx
// Pre/post migration manifest generator.
// Captures database identity, schema version, row counts, financial totals,
// per-item balances, checksums. Outputs JSON — never includes credentials.
// Usage: npx tsx scripts/manifest.ts [pre|post]

import { PrismaClient } from "@/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { createHash } from "node:crypto"
import "dotenv/config"

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
})

type Manifest = {
  type: "pre" | "post"
  timestamp: string
  database: {
    host: string
    name: string
    fingerprint: string
  }
  schema: { version: string; migrationCount: number }
  rowCounts: Record<string, number>
  financials: {
    totalRevenue: string
    totalExpenses: string
    totalOrderCount: number
    totalPurchaseCount: number
  }
  perStore: Array<{
    storeId: string
    storeName: string
    materialCount: number
    productCount: number
    orderCount: number
    revenue: string
    expense: string
  }>
  checksums: {
    tableRowHash: string
    balanceHash: string
  }
}

async function generateManifest(type: "pre" | "post"): Promise<Manifest> {
  const connStr = process.env.DATABASE_URL ?? ""
  const urlObj = new URL(connStr)

  const tableList = [
    "User", "Toko", "TokoUser", "Bahan", "Product", "PriceTier", "ProductPrice",
    "Belanja", "BelanjaItem", "Production", "ProductionBahan", "ProductionProduct",
    "Sale", "SaleItem", "Pesanan", "ItemPesanan", "InventoryMovement",
    "BahanUnitConversion", "Session", "Account", "Verification",
    "Item", "StockBalance", "ItemUnitConversion", "ItemPrice",
    "Purchase", "PurchaseLine", "NewProduction", "ProductionLine",
    "Order", "OrderLine", "StockMovement",
    "DataMigrationRun", "DataMigrationCheckpoint", "LegacyRecordMap",
    "IdempotencyRecord", "ActivityLog",
  ]

  const rowCounts: Record<string, number> = {}
  for (const table of tableList) {
    try {
      const [result] = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
        `SELECT COUNT(*) as cnt FROM "${table}"`
      )
      rowCounts[table] = Number(result?.cnt ?? 0)
    } catch {
      rowCounts[table] = 0
    }
  }

  const [orderAgg, purchaseAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "COMPLETED" },
      _sum: { total: true },
      _count: true,
    }),
    prisma.purchase.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalAmount: true },
      _count: true,
    }),
  ])

  const stores = await prisma.toko.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  })
  const perStore: Manifest["perStore"] = []
  for (const s of stores) {
    const [matC, prodC, ordC, rev, exp] = await Promise.all([
      prisma.item.count({ where: { tokoId: s.id, type: "MATERIAL" } }),
      prisma.item.count({ where: { tokoId: s.id, type: "PRODUCT" } }),
      prisma.order.count({ where: { tokoId: s.id, status: "COMPLETED" } }),
      prisma.order.aggregate({ where: { tokoId: s.id, status: "COMPLETED" }, _sum: { total: true } }),
      prisma.purchase.aggregate({ where: { tokoId: s.id, status: "COMPLETED" }, _sum: { totalAmount: true } }),
    ])
    perStore.push({
      storeId: s.id,
      storeName: s.name,
      materialCount: matC,
      productCount: prodC,
      orderCount: ordC,
      revenue: rev._sum.total?.toString() ?? "0",
      expense: exp._sum.totalAmount?.toString() ?? "0",
    })
  }

  const checksumInput = JSON.stringify(rowCounts) + perStore.map((s) => s.storeId + s.revenue + s.expense).join("")
  const tableRowHash = createHash("sha256").update(checksumInput).digest("hex")

  // Balance checksum
  const balances = await prisma.$queryRawUnsafe<Array<{ itemId: string; qty: string; cost: string }>>(
    `SELECT "itemId", quantity::text AS qty, "averageCost"::text AS cost FROM "StockBalance" ORDER BY "itemId"`
  )
  const balanceInput = balances.map((b) => `${b.itemId}:${b.qty}:${b.cost}`).join(",")
  const balanceHash = createHash("sha256").update(balanceInput).digest("hex")

  return {
    type,
    timestamp: new Date().toISOString(),
    database: {
      host: urlObj.hostname,
      name: urlObj.pathname.replace(/^\//, ""),
      fingerprint: createHash("sha256").update(`${urlObj.hostname}:${urlObj.pathname}`).digest("hex").slice(0, 16),
    },
    schema: {
      version: "v2-schema-expand",
      migrationCount: 3,
    },
    rowCounts,
    financials: {
      totalRevenue: orderAgg._sum.total?.toString() ?? "0",
      totalExpenses: purchaseAgg._sum.totalAmount?.toString() ?? "0",
      totalOrderCount: orderAgg._count,
      totalPurchaseCount: purchaseAgg._count,
    },
    perStore,
    checksums: { tableRowHash, balanceHash },
  }
}

async function main() {
  const type = process.argv[2] === "post" ? "post" : "pre"
  console.log(`Generating ${type}-migration manifest...`)
  const manifest = await generateManifest(type)
  const outPath = `scripts/manifest-${type}-${Date.now()}.json`
  await import("node:fs").then((fs) => fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2)))
  console.log(`Manifest written to ${outPath}`)
  console.log(`Row count: ${Object.values(manifest.rowCounts).reduce((a, b) => a + b, 0)}`)
  console.log(`Revenue: ${manifest.financials.totalRevenue}`)
  console.log(`Checksum: ${manifest.checksums.tableRowHash}`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
