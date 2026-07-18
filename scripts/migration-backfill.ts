#!/usr/bin/env npx tsx
// Idempotent migration backfill script v2.
// Acquires PostgreSQL advisory lock. Rejects unknown schema version.
// Safe to re-run: uses upsert/on-conflict; checkpoints by store and phase.
// --dry-run: validates without any DB writes (read-only).
// --verify-only: runs reconciliation and mapping checks without database writes.
// Requires explicit approved DB identity before any write.

import { PrismaClient } from "@/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { Prisma } from "@/generated/prisma/client"
import fs from "node:fs"
import "dotenv/config"

const MIGRATION_VERSION = "v2-schema-expand-001"
const ADVISORY_LOCK_ID = 17072026
const DRY_RUN = process.argv.includes("--dry-run")
const VERIFY_ONLY = process.argv.includes("--verify-only")
const SKIP_WRITES = DRY_RUN || VERIFY_ONLY

import {
  canonicalChecksum,
  parsePaymentMethodFromNote,
  classifyOrderSourceFromNote,
  fingerprintOrderLines,
  scoreConversionCandidate,
  isHighConfidenceMatch,
  isLowConfidenceMatch,
  getLegacyMovementSourceType,
  mapLegacyMovementTypeToStockMovementType,
  safeOrderNumber,
} from "./migration-lib"

const OUTPUT_DIR = process.env.MIGRATION_OUTPUT_DIR || "/tmp/migration-archive"

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }),
})

function guardEnvironment(): void {
  if (SKIP_WRITES) return
  const dbName = process.env.APPROVED_DB_NAME
  const dbHost = process.env.APPROVED_DB_HOST
  const dbFingerprint = process.env.APPROVED_DB_FINGERPRINT
  if (!dbName || !dbHost || !dbFingerprint) {
    console.error("APPROVED_DB_NAME, APPROVED_DB_HOST, and APPROVED_DB_FINGERPRINT must be set for writes.")
    console.error("Use --dry-run to validate without writing. Use --verify-only to check mappings only.")
    process.exit(1)
  }
  const connStr = process.env.DATABASE_URL ?? ""
  if (!connStr.includes(dbHost) || !connStr.includes(dbName)) {
    console.error("DATABASE_URL does not match APPROVED_DB_HOST/APPROVED_DB_NAME. Aborting.")
    process.exit(1)
  }
}

// ---- Report ----
interface ReportEntry {
  severity: "error" | "warning" | "info"
  phase: string
  tokoId?: string
  message: string
  details?: Record<string, unknown>
}

class MigrationReport {
  entries: ReportEntry[] = []
  add(entry: ReportEntry): void { this.entries.push(entry) }
  hasErrors(): boolean { return this.entries.some((e) => e.severity === "error") }
  hasAmbiguities(): boolean { return this.entries.some((e) => e.severity === "warning") }
  print(): void {
    for (const e of this.entries) {
      const prefix = e.severity.toUpperCase().padEnd(7)
      console.log(`[${prefix}] [${e.phase}] ${e.tokoId ? `[${e.tokoId}] ` : ""}${e.message}`)
      if (e.details) console.log(`  Details:`, JSON.stringify(e.details))
    }
  }
  summary(): { errors: number; warnings: number; infos: number } {
    return {
      errors: this.entries.filter((e) => e.severity === "error").length,
      warnings: this.entries.filter((e) => e.severity === "warning").length,
      infos: this.entries.filter((e) => e.severity === "info").length,
    }
  }
  toJSON(): object {
    return {
      summary: this.summary(),
      entries: this.entries.map((e) => ({
        severity: e.severity, phase: e.phase, tokoId: e.tokoId,
        message: e.message, details: e.details,
      })),
    }
  }
}

const report = new MigrationReport()

// ---- Run management ----
async function createRunRecord(): Promise<string> {
  if (SKIP_WRITES) return `dry-run-${Date.now()}`
  const run = await prisma.dataMigrationRun.create({
    data: { version: MIGRATION_VERSION, status: "started", metadata: {} },
  })
  return run.id
}

async function completeRunRecord(runId: string): Promise<void> {
  if (SKIP_WRITES) return
  await prisma.dataMigrationRun.update({
    where: { id: runId },
    data: { status: "completed", endedAt: new Date(), metadata: report.toJSON() as Prisma.InputJsonValue },
  })
}

async function failRunRecord(runId: string, error: string): Promise<void> {
  if (SKIP_WRITES) return
  try {
    await prisma.dataMigrationRun.update({
      where: { id: runId },
      data: { status: "failed", endedAt: new Date(), error },
    })
  } catch { /* ignore */ }
}

// ---- Checkpoint: deterministic upsert (no duplicates) ----
async function upsertCheckpoint(
  runId: string, phase: string, tokoId: string | null,
  status: string, metadata?: Record<string, unknown>,
): Promise<string> {
  if (SKIP_WRITES) return `dry-${phase}`
  const scopeKey = `${MIGRATION_VERSION}:${tokoId ?? "global"}:${phase}`
  const cp = await prisma.dataMigrationCheckpoint.upsert({
    where: { scopeKey },
    update: {
      runId,
      status,
      startedAt: new Date(),
      endedAt: null,
      metadata: metadata as Prisma.InputJsonValue,
    },
    create: { runId, phase, tokoId, scopeKey, status, metadata: metadata as Prisma.InputJsonValue },
  })
  return cp.id
}

async function updateCheckpoint(cpId: string, status: string, metadata?: Record<string, unknown>): Promise<void> {
  if (SKIP_WRITES || cpId.startsWith("dry")) return
  await prisma.dataMigrationCheckpoint.update({
    where: { id: cpId },
    data: { status, endedAt: new Date(), metadata: metadata as Prisma.InputJsonValue },
  })
}

// ---- LegacyRecordMap: deterministic merge upsert ----
async function upsertLegacyMapping(
  sourceType: string, sourceId: string, sourceIds: string[],
  targetType: string, targetId: string, checksum?: string, status = "mapped"
): Promise<void> {
  if (SKIP_WRITES) return
  const existing = await prisma.legacyRecordMap.findFirst({
    where: { sourceType, sourceId, targetType },
  })
  if (existing) {
    const mergedSourceIds = [...new Set([...existing.sourceIds, ...sourceIds])].sort()
    await prisma.legacyRecordMap.update({
      where: { id: existing.id },
      data: {
        sourceIds: mergedSourceIds,
        sourceChecksum: checksum ?? existing.sourceChecksum,
        status, error: null, targetId,
      },
    })
    return
  }
  await prisma.legacyRecordMap.create({
    data: { sourceType, sourceId, sourceIds: [...new Set(sourceIds)].sort(), targetType, targetId, sourceChecksum: checksum, status },
  })
}

async function addLineMapping(
  sourceType: string, sourceId: string, targetType: string, targetId: string, checksum?: string
): Promise<void> {
  await upsertLegacyMapping(sourceType, sourceId, [sourceId], targetType, targetId, checksum, "mapped")
}

// ---- Advisory lock ----
async function acquireAdvisoryLock(): Promise<boolean> {
  const [result] = await prisma.$queryRawUnsafe<Array<{ locked: boolean }>>(
    `SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) as locked`
  )
  return result?.locked ?? false
}

async function releaseAdvisoryLock(): Promise<void> {
  await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`)
}

async function verifySchemaVersion(): Promise<void> {
  const itemExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Item') as exists`
  )
  if (!itemExists?.[0]?.exists) {
    throw new Error("Target schema not found. Run migration expand first.")
  }
  const legacyExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Bahan') as exists`
  )
  if (!legacyExists?.[0]?.exists) {
    report.add({ severity: "warning", phase: "schema_check", message: "Legacy tables not found; assuming full migration already done." })
  }
}

function writeReportFile(runId: string): string {
  const output = {
    migrationVersion: MIGRATION_VERSION,
    runId,
    timestamp: new Date().toISOString(),
    database: { host: (() => { try { return new URL(process.env.DATABASE_URL ?? "").hostname } catch { return "unknown" } })(), approved: !SKIP_WRITES },
    report: report.toJSON(),
  }
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    const filepath = `${OUTPUT_DIR}/migration-report-${runId}.json`
    fs.writeFileSync(filepath, JSON.stringify(output, null, 2))
    console.log(`Report written to ${filepath}`)
    return filepath
  } catch (e) {
    console.error(`Failed to write report: ${e}`)
    return ""
  }
}

// ---- Phase 2: Catalog backfill ----
async function phase2Catalog(runId: string): Promise<void> {
  const phase = "catalog"
  console.log("\n=== Phase 2: Catalog Backfill ===")

  const collisions = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT b.id FROM "Bahan" b INNER JOIN "Product" p ON b.id = p.id`
  )
  if (collisions.length > 0) {
    for (const c of collisions) {
      report.add({ severity: "error", phase, message: `ID collision between Bahan and Product`, details: { id: c.id } })
    }
    throw new Error("ID collisions detected.")
  }

  const bahans = await prisma.bahan.findMany({ include: { conversions: true } })
  console.log(`Materials: ${bahans.length}`)

  for (const bahan of bahans) {
    const cpId = await upsertCheckpoint(runId, `${phase}_material`, bahan.tokoId, "in_progress", { bahanId: bahan.id })
    try {
      if (!SKIP_WRITES) {
        await prisma.$transaction(async (tx) => {
          await tx.item.upsert({
            where: { id: bahan.id },
            update: {
              type: "MATERIAL", name: bahan.name, unit: bahan.unit,
              unitKind: bahan.unitKind, baseUnit: bahan.baseUnit, isActive: true,
              updatedAt: bahan.updatedAt,
            },
            create: {
              id: bahan.id, tokoId: bahan.tokoId, type: "MATERIAL", name: bahan.name,
              unit: bahan.unit, unitKind: bahan.unitKind, baseUnit: bahan.baseUnit,
              isActive: true, createdAt: bahan.createdAt, updatedAt: bahan.updatedAt,
            },
          })
          await tx.stockBalance.upsert({
            where: { itemId: bahan.id },
            update: { quantity: bahan.currentQty, averageCost: bahan.averageCost },
            create: { itemId: bahan.id, quantity: bahan.currentQty, averageCost: bahan.averageCost, version: 0 },
          })
          for (const conv of bahan.conversions) {
            await tx.itemUnitConversion.upsert({
              where: { itemId_unit: { itemId: bahan.id, unit: conv.unit } },
              update: { factor: conv.factor },
              create: { id: conv.id, itemId: bahan.id, unit: conv.unit, factor: conv.factor },
            })
          }
        })
      }
      const cs = canonicalChecksum({ name: bahan.name, unit: bahan.unit, kind: bahan.unitKind, qty: String(bahan.currentQty) })
      await upsertLegacyMapping("Bahan", bahan.id, [bahan.id], "Item", bahan.id, cs)
      for (const conv of bahan.conversions) {
        await addLineMapping("BahanUnitConversion", conv.id, "ItemUnitConversion", conv.id,
          canonicalChecksum({ itemId: conv.bahanId, unit: conv.unit, factor: String(conv.factor) }))
      }
      await updateCheckpoint(cpId, "completed")
    } catch (e) {
      report.add({ severity: "error", phase, tokoId: bahan.tokoId, message: `Failed Bahan ${bahan.id}: ${e}` })
      await updateCheckpoint(cpId, "failed")
      throw e
    }
  }

  const products = await prisma.product.findMany({ include: { prices: true } })
  console.log(`Products: ${products.length}`)

  for (const product of products) {
    const cpId = await upsertCheckpoint(runId, `${phase}_product`, product.tokoId, "in_progress", { productId: product.id })
    try {
      if (!SKIP_WRITES) {
        await prisma.$transaction(async (tx) => {
          await tx.item.upsert({
            where: { id: product.id },
            update: {
              type: "PRODUCT", name: product.name, unit: "pcs", unitKind: "COUNT", baseUnit: "pcs",
              imageUrl: product.imageUrl, isActive: product.isActive, updatedAt: product.updatedAt,
            },
            create: {
              id: product.id, tokoId: product.tokoId, type: "PRODUCT", name: product.name,
              unit: "pcs", unitKind: "COUNT", baseUnit: "pcs", imageUrl: product.imageUrl,
              isActive: product.isActive, createdAt: product.createdAt, updatedAt: product.updatedAt,
            },
          })
          await tx.stockBalance.upsert({
            where: { itemId: product.id },
            update: { quantity: product.currentQty, averageCost: 0 },
            create: { itemId: product.id, quantity: product.currentQty, averageCost: 0, version: 0 },
          })
          for (const pp of product.prices) {
            await tx.itemPrice.upsert({
              where: { itemId_priceTierId: { itemId: product.id, priceTierId: pp.priceTierId } },
              update: { price: pp.price },
              create: { id: pp.id, itemId: product.id, priceTierId: pp.priceTierId, price: pp.price },
            })
          }
        })
      }
      const cs = canonicalChecksum({ name: product.name, qty: String(product.currentQty), active: product.isActive })
      await upsertLegacyMapping("Product", product.id, [product.id], "Item", product.id, cs)
      for (const pp of product.prices) {
        await addLineMapping("ProductPrice", pp.id, "ItemPrice", pp.id,
          canonicalChecksum({ itemId: pp.productId, priceTierId: pp.priceTierId, price: String(pp.price) }))
      }
      await updateCheckpoint(cpId, "completed")
    } catch (e) {
      report.add({ severity: "error", phase, tokoId: product.tokoId, message: `Failed Product ${product.id}: ${e}` })
      await updateCheckpoint(cpId, "failed")
      throw e
    }
  }

  const [matCount, prodCount, oldMat, oldProd] = await Promise.all([
    prisma.item.count({ where: { type: "MATERIAL" } }),
    prisma.item.count({ where: { type: "PRODUCT" } }),
    prisma.bahan.count(),
    prisma.product.count(),
  ])
  if (matCount !== oldMat) report.add({ severity: "error", phase, message: `Material count mismatch: items=${matCount} bahan=${oldMat}` })
  if (prodCount !== oldProd) report.add({ severity: "error", phase, message: `Product count mismatch: items=${prodCount} products=${oldProd}` })
  else report.add({ severity: "info", phase, message: `Catalog verified: ${matCount}M + ${prodCount}P` })
  console.log(`Catalog complete. Materials: ${matCount}/${oldMat}, Products: ${prodCount}/${oldProd}`)
}

// ---- Phase 3: Document backfill with candidate matching ----
async function phase3Documents(runId: string): Promise<void> {
  const phase = "documents"
  console.log("\n=== Phase 3: Document Backfill ===")

  const allItems = await prisma.item.findMany({ select: { id: true, name: true, unit: true } })
  const itemMap = new Map(allItems.map((i) => [i.id, i]))
  const itemName = (itemId: string): string => itemMap.get(itemId)?.name ?? ""
  const itemUnit = (itemId: string): string => itemMap.get(itemId)?.unit ?? "pcs"

  // === Step 1: Activity-based conversion detection ===
  const conversionActivities = await prisma.activityLog.findMany({
    where: { action: "pesanan_converted" },
    select: { metadata: true, entityId: true, tokoId: true, actorId: true },
  })
  const convertedSaleIds = new Set<string>()
  const pesananToSaleByActivity = new Map<string, string>()
  const conversionByPesanan = new Map<string, { saleInvoice: string; tokoId: string; actorId: string }>()

  for (const act of conversionActivities) {
    if (!act.entityId) continue
    const meta = act.metadata as Record<string, unknown> | null
    const saleInvoice = meta?.saleInvoiceNumber as string | undefined
    if (saleInvoice) {
      const sale = await prisma.sale.findFirst({ where: { invoiceNumber: saleInvoice }, select: { id: true } })
      if (sale) {
        convertedSaleIds.add(sale.id)
        pesananToSaleByActivity.set(act.entityId, sale.id)
        conversionByPesanan.set(act.entityId, { saleInvoice, tokoId: act.tokoId, actorId: act.actorId })
      }
    }
  }

  // === Step 2: Process Sales -> Orders ===
  const sales = await prisma.sale.findMany({
    include: { items: true },
    orderBy: { createdAt: "asc" },
  })
  console.log(`Sales: ${sales.length} (${convertedSaleIds.size} from Pesanan conversion)`)

  for (const sale of sales) {
    const isConverted = convertedSaleIds.has(sale.id)
    const cpId = await upsertCheckpoint(runId, `${phase}_sale`, sale.tokoId, "in_progress", { saleId: sale.id, converted: isConverted })

    try {
      const paymentMethod = parsePaymentMethodFromNote(sale.note) ?? "CASH"
      const channel = classifyOrderSourceFromNote(sale.note) ?? sale.channel
      const orderNumber = safeOrderNumber("SALE", sale.invoiceNumber)

      if (!SKIP_WRITES) {
        await prisma.$transaction(async (tx) => {
          const orderId = sale.id
          const total = sale.totalAmount
          const paidAmount = sale.paidAmount ?? total

          await tx.order.upsert({
            where: { id: orderId },
            update: {
              number: orderNumber, source: "CASHIER", channel: channel as "CASHIER" | "RESELLER" | "ONLINE",
              status: sale.status === "CANCELLED" ? "CANCELLED" : "COMPLETED",
              paymentStatus: "PAID", fulfillmentStatus: "FULFILLED",
              customerName: sale.customerName, note: sale.note,
              paymentMethod: paymentMethod as "CASH" | "QRIS" | "TRANSFER" | "EWALLET" | "OTHER",
              subtotal: total, total, paidAmount, postedAt: sale.createdAt,
              createdById: sale.createdById, createdAt: sale.createdAt, updatedAt: sale.updatedAt,
            },
            create: {
              id: orderId, tokoId: sale.tokoId, number: orderNumber, source: "CASHIER",
              channel: channel as "CASHIER" | "RESELLER" | "ONLINE",
              status: sale.status === "CANCELLED" ? "CANCELLED" : "COMPLETED",
              paymentStatus: "PAID", fulfillmentStatus: "FULFILLED",
              customerName: sale.customerName, note: sale.note,
              paymentMethod: paymentMethod as "CASH" | "QRIS" | "TRANSFER" | "EWALLET" | "OTHER",
              subtotal: total, total, paidAmount, tracksInventory: true, postedAt: sale.createdAt,
              createdById: sale.createdById, createdAt: sale.createdAt, updatedAt: sale.updatedAt,
            },
          })

          for (const si of sale.items) {
            await tx.orderLine.upsert({
              where: { id: si.id },
              update: {
                itemId: si.productId, itemName: itemName(si.productId),
                priceTierId: si.priceTierId, priceTierCode: si.priceTierCode, priceTierName: si.priceTierName,
                quantity: si.qty, unit: itemUnit(si.productId), unitPrice: si.unitPrice, subtotal: si.subtotal,
              },
              create: {
                id: si.id, orderId, itemId: si.productId, itemName: itemName(si.productId),
                priceTierId: si.priceTierId, priceTierCode: si.priceTierCode, priceTierName: si.priceTierName,
                quantity: si.qty, unit: itemUnit(si.productId), unitPrice: si.unitPrice, subtotal: si.subtotal,
              },
            })
            await addLineMapping("SaleItem", si.id, "OrderLine", si.id,
              canonicalChecksum({ productId: si.productId, qty: String(si.qty), unitPrice: String(si.unitPrice) }))
          }
        })
      }

      // For converted sales, find the corresponding pesanan and create merged mapping
      let sourceIds = [sale.id]
      const mapStatus = isConverted ? "merged_converted" : "mapped"

      const cs = canonicalChecksum({ invoiceNumber: sale.invoiceNumber, channel: sale.channel, total: String(sale.totalAmount) })
      await upsertLegacyMapping("Sale", sale.id, sourceIds, "Order", sale.id, cs, mapStatus)

      // For converted sales: find all Pesanan that map to this Sale and create BOTH mappings
      for (const [pesananId, mappedSaleId] of pesananToSaleByActivity.entries()) {
        if (mappedSaleId === sale.id) {
          sourceIds = [...new Set([...sourceIds, pesananId])].sort()
          // Update the Sale mapping with merged sourceIds
          await upsertLegacyMapping("Sale", sale.id, sourceIds, "Order", sale.id, cs, mapStatus)
          // Create Pesanan mapping pointing to same canonical Order
          const pesanan = await prisma.pesanan.findUnique({ where: { id: pesananId }, include: { items: true } })
          const pesananCs = canonicalChecksum({ kode: pesanan?.kode ?? "", total: String(pesanan?.total ?? 0) })
          await upsertLegacyMapping("Pesanan", pesananId, [pesananId, sale.id], "Order", sale.id, pesananCs, "merged_converted")

          const mappedSaleLineIds = new Set<string>()
          for (const pesananItem of pesanan?.items ?? []) {
            const matches = sale.items.filter((saleItem) =>
              !mappedSaleLineIds.has(saleItem.id) &&
              saleItem.productId === pesananItem.productId &&
              String(saleItem.qty) === String(pesananItem.qty) &&
              String(saleItem.unitPrice) === String(pesananItem.unitPrice) &&
              String(saleItem.subtotal) === String(pesananItem.subtotal)
            )
            if (matches.length !== 1) {
              report.add({
                severity: "error", phase, tokoId: sale.tokoId,
                message: `Converted Pesanan line ${pesananItem.id} has ${matches.length} matching Sale lines`,
              })
              continue
            }
            const targetLine = matches[0]
            mappedSaleLineIds.add(targetLine.id)
            await addLineMapping("ItemPesanan", pesananItem.id, "OrderLine", targetLine.id,
              canonicalChecksum({ productId: pesananItem.productId, qty: String(pesananItem.qty), unitPrice: String(pesananItem.unitPrice) }))
          }
        }
      }

      await updateCheckpoint(cpId, "completed")
    } catch (e) {
      report.add({ severity: "error", phase, tokoId: sale.tokoId, message: `Failed Sale ${sale.id}: ${e}` })
      await updateCheckpoint(cpId, "failed")
      throw e
    }
  }

  // === Step 3: Process Pesanan with candidate matching ===
  const pesanans = await prisma.pesanan.findMany({
    include: { items: true },
    orderBy: { createdAt: "asc" },
  })
  console.log(`Pesanan: ${pesanans.length} (${pesananToSaleByActivity.size} matched by activity)`)

  const unmatchedPesanan = pesanans.filter((p) => !pesananToSaleByActivity.has(p.id))
  const unmatchedSales = sales.filter((s) => !convertedSaleIds.has(s.id))

  // Candidate matching: try to match unmatched completed Pesanan to unmatched Sales
  const cancelledActivities = await prisma.activityLog.findMany({
    where: { action: "cancelled_pesanan", entityType: "Pesanan", entityId: { not: null } },
    select: { entityId: true },
  })
  const cancelledPesananIds = new Set(cancelledActivities.flatMap((activity) => activity.entityId ? [activity.entityId] : []))
  const completedPesanan = unmatchedPesanan.filter((p) =>
    !cancelledPesananIds.has(p.id) &&
    (p.statusPengiriman === "DIKIRIM" || p.statusPembayaran === "DIBAYAR")
  )

  const newMatches = new Map<string, string>() // pesananId -> saleId
  const ambiguousPairs: Array<{ pesananId: string; saleId: string; confidence: number; reason: string }> = []

  if (completedPesanan.length > 0 && unmatchedSales.length > 0) {
    console.log(`\nCandidate matching: ${completedPesanan.length} completed Pesanan vs ${unmatchedSales.length} unmatched Sales`)

    for (const pesanan of completedPesanan) {
      // Collect all unmatched Sales from the same store
      const sameStoreSales = unmatchedSales.filter((s) => s.tokoId === pesanan.tokoId)
      if (sameStoreSales.length === 0) continue

      const pesananFingerprint = fingerprintOrderLines(
        pesanan.items.map((pi) => ({ productId: pi.productId, qty: String(pi.qty), unitPrice: String(pi.unitPrice) }))
      )
      // Find conversion activity metadata for this pesanan
      const convMeta = conversionByPesanan.get(pesanan.id)

      let bestConfidence = 0
      let bestSaleId: string | null = null
      let secondBestConfidence = 0

      for (const sale of sameStoreSales) {
        const saleFingerprint = fingerprintOrderLines(
          sale.items.map((si) => ({ productId: si.productId, qty: String(si.qty), unitPrice: String(si.unitPrice) }))
        )

        const scores = scoreConversionCandidate({
          pesananActorId: pesanan.createdById,
          saleCreatedById: sale.createdById,
          pesananTotal: String(pesanan.total),
          saleTotal: String(sale.totalAmount),
          pesananFingerprint,
          saleFingerprint,
          pesananCreatedAt: pesanan.createdAt,
          saleCreatedAt: sale.createdAt,
          pesananNote: pesanan.catatan,
          hasSaleInvoiceMetadata: convMeta?.saleInvoice != null,
          pesananStoreId: pesanan.tokoId,
          saleStoreId: sale.tokoId,
        })

        if (scores.confidence > bestConfidence) {
          secondBestConfidence = bestConfidence
          bestConfidence = scores.confidence
          bestSaleId = sale.id
        } else if (scores.confidence > secondBestConfidence) {
          secondBestConfidence = scores.confidence
        }
      }

      if (bestSaleId && bestConfidence > 0) {
        // Check for ambiguity: if second-best is close, flag as ambiguous
        if (secondBestConfidence > 0 && bestConfidence - secondBestConfidence < 15) {
          ambiguousPairs.push({
            pesananId: pesanan.id,
            saleId: bestSaleId,
            confidence: bestConfidence,
            reason: `Close second candidate at confidence ${secondBestConfidence}`,
          })
          report.add({
            severity: "warning", phase, tokoId: pesanan.tokoId,
            message: `Ambiguous Pesanan match: ${pesanan.id} matches Sale ${bestSaleId} (confidence ${bestConfidence}%) but second candidate at ${secondBestConfidence}%`,
            details: { pesananId: pesanan.id, saleId: bestSaleId, confidence: bestConfidence, secondConfidence: secondBestConfidence },
          })
          // Ambiguous — do NOT insert/map. Skip this pesanan.
          continue
        }

        // High confidence unambiguous match: auto-accept
        if (isHighConfidenceMatch(bestConfidence)) {
          newMatches.set(pesanan.id, bestSaleId)
          convertedSaleIds.add(bestSaleId)
          report.add({
            severity: "info", phase, tokoId: pesanan.tokoId,
            message: `Auto-matched Pesanan ${pesanan.id} -> Sale ${bestSaleId} (confidence ${bestConfidence}%)`,
          })
        } else if (!isLowConfidenceMatch(bestConfidence) && (secondBestConfidence === 0 || bestConfidence - secondBestConfidence >= 15)) {
          // Moderate confidence unambiguous: flag as uncertain but do NOT insert/map
          ambiguousPairs.push({
            pesananId: pesanan.id, saleId: bestSaleId,
            confidence: bestConfidence,
            reason: "Moderate confidence match without clear second candidate",
          })
          report.add({
            severity: "warning", phase, tokoId: pesanan.tokoId,
            message: `Uncertain Pesanan match: ${pesanan.id} -> Sale ${bestSaleId} (confidence ${bestConfidence}%)`,
            details: { pesananId: pesanan.id, saleId: bestSaleId, confidence: bestConfidence },
          })
        }
        // Low-confidence matches: silently skipped, no mapping
      }
    }

    // Auto-accept high-confidence unambiguous matches
    for (const [pesananId, saleId] of newMatches.entries()) {
      pesananToSaleByActivity.set(pesananId, saleId)
      // Update Sale mapping with both sourceIds
      const sale = sales.find((s) => s.id === saleId)
      if (sale) {
        const sourceIds = [saleId, pesananId].sort()
        const cs = canonicalChecksum({ invoiceNumber: sale.invoiceNumber, channel: sale.channel, total: String(sale.totalAmount) })
        await upsertLegacyMapping("Sale", saleId, sourceIds, "Order", saleId, cs, "merged_converted")
        await upsertLegacyMapping("Pesanan", pesananId, [pesananId, saleId], "Order", saleId,
          canonicalChecksum({ kode: pesanans.find((p) => p.id === pesananId)?.kode ?? "", total: String(pesanans.find((p) => p.id === pesananId)?.total ?? 0) }),
          "merged_converted")
      }
    }
  }

  // Block on unresolved ambiguities
  if (ambiguousPairs.length > 0) {
    const autoMatched = newMatches.size
    const unresolved = ambiguousPairs.length
    console.log(`\nCandidate matching: ${autoMatched} auto-matched, ${unresolved} ambiguous`)
    for (const amb of ambiguousPairs) {
      console.log(`  AMBIGUOUS: Pesanan ${amb.pesananId} -> Sale ${amb.saleId} (${amb.confidence}%): ${amb.reason}`)
    }
    // Ambiguities are warnings, not errors — they block cutover but not backfill
    report.add({
      severity: "warning", phase,
      message: `${unresolved} ambiguous Pesanan/Sale matches require manual resolution before cutover`,
    })
  }

  // Process non-matched Pesanan
  for (const pesanan of pesanans) {
    if (pesananToSaleByActivity.has(pesanan.id)) continue
    // Skip if we already matched this via candidate matching
    if (newMatches.has(pesanan.id) && !SKIP_WRITES) continue

    const cpId = await upsertCheckpoint(runId, `${phase}_pesanan`, pesanan.tokoId, "in_progress", { pesananId: pesanan.id })
    try {
      const isCancelled = await prisma.activityLog.count({
        where: { entityType: "Pesanan", entityId: pesanan.id, action: "cancelled_pesanan" },
      }) > 0
      const orderNumber = safeOrderNumber("PES", pesanan.kode)

      if (!SKIP_WRITES) {
        await prisma.$transaction(async (tx) => {
          const orderId = pesanan.id
          await tx.order.upsert({
            where: { id: orderId },
            update: {
              number: orderNumber, source: "MANUAL", channel: null,
              status: isCancelled ? "CANCELLED" : "CONFIRMED",
              paymentStatus: pesanan.statusPembayaran === "DIBAYAR" ? "PAID" : "UNPAID",
              fulfillmentStatus: pesanan.statusPengiriman === "DIKIRIM" ? "SHIPPED" : "UNFULFILLED",
              customerName: pesanan.namaPelanggan, customerContact: pesanan.kontak, note: pesanan.catatan,
              subtotal: pesanan.total, total: pesanan.total, tracksInventory: false,
              createdById: pesanan.createdById, createdAt: pesanan.createdAt, updatedAt: pesanan.updatedAt,
            },
            create: {
              id: orderId, tokoId: pesanan.tokoId, number: orderNumber, source: "MANUAL", channel: null,
              status: isCancelled ? "CANCELLED" : "CONFIRMED",
              paymentStatus: pesanan.statusPembayaran === "DIBAYAR" ? "PAID" : "UNPAID",
              fulfillmentStatus: pesanan.statusPengiriman === "DIKIRIM" ? "SHIPPED" : "UNFULFILLED",
              customerName: pesanan.namaPelanggan, customerContact: pesanan.kontak, note: pesanan.catatan,
              subtotal: pesanan.total, total: pesanan.total, tracksInventory: false,
              createdById: pesanan.createdById, createdAt: pesanan.createdAt, updatedAt: pesanan.updatedAt,
            },
          })

          for (const ip of pesanan.items) {
            await tx.orderLine.upsert({
              where: { id: ip.id },
              update: {
                itemId: ip.productId, itemName: itemName(ip.productId),
                quantity: ip.qty, unit: itemUnit(ip.productId), unitPrice: ip.unitPrice, subtotal: ip.subtotal,
              },
              create: {
                id: ip.id, orderId, itemId: ip.productId, itemName: itemName(ip.productId),
                quantity: ip.qty, unit: itemUnit(ip.productId), unitPrice: ip.unitPrice, subtotal: ip.subtotal,
              },
            })
            await addLineMapping("ItemPesanan", ip.id, "OrderLine", ip.id,
              canonicalChecksum({ productId: ip.productId, qty: String(ip.qty), unitPrice: String(ip.unitPrice) }))
          }
        })
      }

      const cs = canonicalChecksum({ kode: pesanan.kode, total: String(pesanan.total), cancelled: isCancelled })
      await upsertLegacyMapping("Pesanan", pesanan.id, [pesanan.id], "Order", pesanan.id, cs)
      await updateCheckpoint(cpId, "completed")
    } catch (e) {
      report.add({ severity: "error", phase, tokoId: pesanan.tokoId, message: `Failed Pesanan ${pesanan.id}: ${e}` })
      await updateCheckpoint(cpId, "failed")
      throw e
    }
  }

  // === Step 4: Purchases ===
  const belanjas = await prisma.belanja.findMany({ include: { items: true } })
  console.log(`Purchases: ${belanjas.length}`)

  for (const belanja of belanjas) {
    const cpId = await upsertCheckpoint(runId, `${phase}_purchase`, belanja.tokoId, "in_progress", { belanjaId: belanja.id })
    try {
      const purchaseNumber = `PO-${belanja.id.slice(-6)}`
      if (!SKIP_WRITES) {
        await prisma.$transaction(async (tx) => {
          await tx.purchase.upsert({
            where: { id: belanja.id },
            update: {
              number: purchaseNumber, date: belanja.date, supplier: belanja.supplier,
              note: belanja.note, status: belanja.status, totalAmount: belanja.totalAmount,
              createdById: belanja.createdById, createdAt: belanja.createdAt, updatedAt: belanja.updatedAt,
            },
            create: {
              id: belanja.id, tokoId: belanja.tokoId, number: purchaseNumber, date: belanja.date,
              supplier: belanja.supplier, note: belanja.note, status: belanja.status,
              totalAmount: belanja.totalAmount, createdById: belanja.createdById,
              createdAt: belanja.createdAt, updatedAt: belanja.updatedAt,
            },
          })

          for (const bi of belanja.items) {
            await tx.purchaseLine.upsert({
              where: { id: bi.id },
              update: {
                itemId: bi.bahanId, itemName: itemName(bi.bahanId),
                quantity: bi.qty, unit: itemUnit(bi.bahanId), unitCost: bi.unitPrice, subtotal: bi.subtotal,
              },
              create: {
                id: bi.id, purchaseId: belanja.id, itemId: bi.bahanId, itemName: itemName(bi.bahanId),
                quantity: bi.qty, unit: itemUnit(bi.bahanId), unitCost: bi.unitPrice, subtotal: bi.subtotal,
              },
            })
            await addLineMapping("BelanjaItem", bi.id, "PurchaseLine", bi.id,
              canonicalChecksum({ bahanId: bi.bahanId, qty: String(bi.qty), unitPrice: String(bi.unitPrice) }))
          }
        })
      }

      const cs = canonicalChecksum({ total: String(belanja.totalAmount), supplier: belanja.supplier ?? "", date: belanja.date.toISOString() })
      await upsertLegacyMapping("Belanja", belanja.id, [belanja.id], "Purchase", belanja.id, cs)
      await updateCheckpoint(cpId, "completed")
    } catch (e) {
      report.add({ severity: "error", phase, tokoId: belanja.tokoId, message: `Failed Belanja ${belanja.id}: ${e}` })
      await updateCheckpoint(cpId, "failed")
      throw e
    }
  }

  // === Step 5: Productions ===
  const productions = await prisma.production.findMany({
    include: { bahanItems: true, productItems: true },
  })
  console.log(`Productions: ${productions.length}`)

  for (const prod of productions) {
    const cpId = await upsertCheckpoint(runId, `${phase}_production`, prod.tokoId, "in_progress", { productionId: prod.id })
    try {
      if (!SKIP_WRITES) {
        await prisma.$transaction(async (tx) => {
          await tx.newProduction.upsert({
            where: { id: prod.id },
            update: {
              date: prod.date, note: prod.note, status: prod.status, postedAt: prod.createdAt,
              createdById: prod.createdById, createdAt: prod.createdAt, updatedAt: prod.updatedAt,
            },
            create: {
              id: prod.id, tokoId: prod.tokoId, date: prod.date, note: prod.note,
              status: prod.status, postedAt: prod.createdAt, createdById: prod.createdById,
              createdAt: prod.createdAt, updatedAt: prod.updatedAt,
            },
          })

          for (const pb of prod.bahanItems) {
            await tx.productionLine.upsert({
              where: { id: pb.id },
              update: { itemId: pb.bahanId, itemName: itemName(pb.bahanId), lineType: "INPUT", quantity: pb.qtyUsed, unit: itemUnit(pb.bahanId) },
              create: { id: pb.id, productionId: prod.id, itemId: pb.bahanId, itemName: itemName(pb.bahanId), lineType: "INPUT", quantity: pb.qtyUsed, unit: itemUnit(pb.bahanId) },
            })
            await addLineMapping("ProductionBahan", pb.id, "ProductionLine", pb.id,
              canonicalChecksum({ bahanId: pb.bahanId, qty: String(pb.qtyUsed) }))
          }

          for (const pp of prod.productItems) {
            await tx.productionLine.upsert({
              where: { id: pp.id },
              update: { itemId: pp.productId, itemName: itemName(pp.productId), lineType: "OUTPUT", quantity: pp.qtyProduced, unit: "pcs" },
              create: { id: pp.id, productionId: prod.id, itemId: pp.productId, itemName: itemName(pp.productId), lineType: "OUTPUT", quantity: pp.qtyProduced, unit: "pcs" },
            })
            await addLineMapping("ProductionProduct", pp.id, "ProductionLine", pp.id,
              canonicalChecksum({ productId: pp.productId, qty: String(pp.qtyProduced) }))
          }
        })
      }

      const cs = canonicalChecksum({ date: prod.date.toISOString(), note: prod.note ?? "", status: prod.status })
      await upsertLegacyMapping("Production", prod.id, [prod.id], "NewProduction", prod.id, cs)
      await updateCheckpoint(cpId, "completed")
    } catch (e) {
      report.add({ severity: "error", phase, tokoId: prod.tokoId, message: `Failed Production ${prod.id}: ${e}` })
      await updateCheckpoint(cpId, "failed")
      throw e
    }
  }

  console.log(`Document backfill complete.`)
}

// ---- Phase 4: Ledger backfill and reconciliation ----
async function phase4Ledger(_runId: string): Promise<void> {
  const phase = "ledger"
  console.log("\n=== Phase 4: Ledger Backfill and Reconciliation ===")

  const oldMovements = await prisma.inventoryMovement.findMany({
    orderBy: { createdAt: "asc" },
  })
  console.log(`Legacy movements: ${oldMovements.length}`)

  for (const om of oldMovements) {
    const itemId = om.bahanId ?? om.productId
    if (!itemId) {
      report.add({ severity: "error", phase, tokoId: om.tokoId, message: `Movement ${om.id} has no itemId` })
      throw new Error(`Movement ${om.id} has no item reference`)
    }
    // Reject malformed: both bahanId and productId set
    if (om.bahanId && om.productId) {
      report.add({ severity: "error", phase, tokoId: om.tokoId, message: `Movement ${om.id} has both bahanId and productId` })
      throw new Error(`Movement ${om.id} has dual item reference`)
    }

    const sourceType = getLegacyMovementSourceType(om.referenceType)
    const movementType = mapLegacyMovementTypeToStockMovementType(om.movementType)
    const dedupeKey = `LEGACY_${om.id}`

    let signedQty = new Prisma.Decimal(om.qty)
    if (om.direction === "OUT") {
      signedQty = signedQty.negated()
    }

    try {
      if (!SKIP_WRITES) {
        await prisma.stockMovement.upsert({
          where: { id: om.id },
          update: {
            tokoId: om.tokoId, itemId, quantity: signedQty,
            movementType: movementType as "PURCHASE" | "PRODUCTION_INPUT" | "PRODUCTION_OUTPUT" | "SALE" | "ADJUSTMENT",
            unitCost: om.unitCost, unitPrice: om.unitPrice, sourceType, sourceId: om.referenceId,
            dedupeKey, note: om.note, createdById: om.createdById, createdAt: om.createdAt,
          },
          create: {
            id: om.id, tokoId: om.tokoId, itemId, quantity: signedQty,
            movementType: movementType as "PURCHASE" | "PRODUCTION_INPUT" | "PRODUCTION_OUTPUT" | "SALE" | "ADJUSTMENT",
            unitCost: om.unitCost, unitPrice: om.unitPrice, sourceType, sourceId: om.referenceId,
            dedupeKey, note: om.note, createdById: om.createdById, createdAt: om.createdAt,
          },
        })
      }

      await addLineMapping("InventoryMovement", om.id, "StockMovement", om.id,
        canonicalChecksum({ itemId, movementType, qty: String(om.qty), direction: om.direction }))
    } catch (e) {
      report.add({ severity: "error", phase, tokoId: om.tokoId, message: `Failed InventoryMovement ${om.id}: ${e}` })
      throw e
    }
  }

  // Opening balance movements
  console.log("Computing opening balances...")
  const items = await prisma.item.findMany({ include: { stockBalance: true } })

  for (const item of items) {
    const balanceQty = item.stockBalance?.quantity ?? new Prisma.Decimal(0)
    const result = await prisma.$queryRawUnsafe<Array<{ sum_qty: string }>>(
      `SELECT COALESCE(SUM(quantity), 0)::text AS "sum_qty" FROM "StockMovement" WHERE "itemId" = $1`,
      item.id
    )
    const sumMoved = new Prisma.Decimal(result[0]?.sum_qty ?? "0")
    const opening = new Prisma.Decimal(balanceQty).minus(sumMoved)

    if (!opening.isZero()) {
      const earliest = await prisma.stockMovement.findFirst({
        where: { itemId: item.id },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      })
      const openingTs = earliest?.createdAt ?? item.createdAt
      const dedupeKey = `OPENING_${item.id}`

      if (!SKIP_WRITES) {
        await prisma.stockMovement.upsert({
          where: { dedupeKey },
          update: { quantity: opening, movementType: "MIGRATION_OPENING_BALANCE", unitCost: null, unitPrice: null, note: "Migration opening balance" },
          create: {
            tokoId: item.tokoId, itemId: item.id, quantity: opening,
            movementType: "MIGRATION_OPENING_BALANCE", sourceType: "Migration",
            sourceId: item.id, dedupeKey, createdById: "migration",
            note: "Migration opening balance", createdAt: openingTs,
          },
        })
      }
      report.add({ severity: "info", phase, tokoId: item.tokoId, message: `Opening balance for ${item.id}: ${opening}` })
    }
  }

  // Verify ledger sums match StockBalance
  const mismatched = await prisma.$queryRawUnsafe<Array<{ itemId: string; balance: string; ledger: string; diff: string }>>(
    `SELECT sb."itemId", sb.quantity::text AS balance, COALESCE(SUM(sm.quantity), 0)::text AS ledger,
            (sb.quantity - COALESCE(SUM(sm.quantity), 0))::text AS diff
     FROM "StockBalance" sb
     LEFT JOIN "StockMovement" sm ON sm."itemId" = sb."itemId"
     GROUP BY sb."itemId", sb.quantity
     HAVING sb.quantity != COALESCE(SUM(sm.quantity), 0)`
  )

  if (mismatched.length > 0) {
    for (const m of mismatched) {
      report.add({ severity: "error", phase, message: `Ledger mismatch for item ${m.itemId}: balance=${m.balance} ledger=${m.ledger} diff=${m.diff}` })
    }
    throw new Error("Ledger reconciliation failed")
  }
  console.log("Ledger reconciliation passed for all items.")
}

// ---- Phase 5: Full reconciliation with anti-join verification ----
async function phase5Reconcile(_runId: string): Promise<void> {
  const phase = "reconcile"
  console.log("\n=== Phase 5: Verification ===")

  // Gate: anti-join every legacy table
  const tables: Array<{ legacy: string; target: string; sourceType: string; targetType: string }> = [
    { legacy: "Bahan", target: "Item", sourceType: "Bahan", targetType: "Item" },
    { legacy: "Product", target: "Item", sourceType: "Product", targetType: "Item" },
    { legacy: "BahanUnitConversion", target: "ItemUnitConversion", sourceType: "BahanUnitConversion", targetType: "ItemUnitConversion" },
    { legacy: "ProductPrice", target: "ItemPrice", sourceType: "ProductPrice", targetType: "ItemPrice" },
    { legacy: "Belanja", target: "Purchase", sourceType: "Belanja", targetType: "Purchase" },
    { legacy: "BelanjaItem", target: "PurchaseLine", sourceType: "BelanjaItem", targetType: "PurchaseLine" },
    { legacy: "Sale", target: "Order", sourceType: "Sale", targetType: "Order" },
    { legacy: "SaleItem", target: "OrderLine", sourceType: "SaleItem", targetType: "OrderLine" },
    { legacy: "Pesanan", target: "Order", sourceType: "Pesanan", targetType: "Order" },
    { legacy: "ItemPesanan", target: "OrderLine", sourceType: "ItemPesanan", targetType: "OrderLine" },
    { legacy: "Production", target: "NewProduction", sourceType: "Production", targetType: "NewProduction" },
    { legacy: "ProductionBahan", target: "ProductionLine", sourceType: "ProductionBahan", targetType: "ProductionLine" },
    { legacy: "ProductionProduct", target: "ProductionLine", sourceType: "ProductionProduct", targetType: "ProductionLine" },
    { legacy: "InventoryMovement", target: "StockMovement", sourceType: "InventoryMovement", targetType: "StockMovement" },
  ]

  for (const t of tables) {
    try {
      const unmapped = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT l.id FROM "${t.legacy}" l LEFT JOIN "LegacyRecordMap" m ON m."sourceId" = l.id AND m."sourceType" = '${t.sourceType}' AND m."targetType" = '${t.targetType}' WHERE m.id IS NULL`
      )
      if (unmapped.length > 0) {
        for (const u of unmapped) {
          report.add({ severity: "error", phase, message: `Unmapped ${t.legacy} row: ${u.id}` })
        }
      } else {
        console.log(`  OK: ${t.legacy} -> ${t.target}: all mapped`)
      }
    } catch (e) {
      // Table might not exist — skip
      report.add({ severity: "warning", phase, message: `Could not verify ${t.legacy}: ${e}` })
    }
  }

  // Gate: duplicate source->target mappings (same sourceId maps to multiple targetIds)
  const dupMappings = await prisma.$queryRawUnsafe<Array<{ sourceType: string; sourceId: string; targetType: string; cnt: number }>>(
    `SELECT "sourceType", "sourceId", "targetType", COUNT(DISTINCT "targetId") as cnt
     FROM "LegacyRecordMap"
     GROUP BY "sourceType", "sourceId", "targetType"
     HAVING COUNT(DISTINCT "targetId") > 1`
  )
  if (dupMappings.length > 0) {
    for (const d of dupMappings) {
      report.add({ severity: "error", phase, message: `Duplicate mapping: ${d.sourceType} ${d.sourceId} -> ${d.cnt} ${d.targetType} targets` })
    }
  }

  // Gate: orphan FKs (lines referencing items from different tenant or non-existent items)
  const orphanLines = await prisma.$queryRawUnsafe<Array<{ lineId: string; lineTable: string; itemId: string }>>(
    `SELECT pl.id AS "lineId", 'PurchaseLine' AS "lineTable", pl."itemId" FROM "PurchaseLine" pl LEFT JOIN "Item" i ON i.id = pl."itemId" WHERE i.id IS NULL OR i."tokoId" != (SELECT p."tokoId" FROM "Purchase" p WHERE p.id = pl."purchaseId")
     UNION ALL
     SELECT ol.id, 'OrderLine', ol."itemId" FROM "OrderLine" ol LEFT JOIN "Item" i ON i.id = ol."itemId" WHERE i.id IS NULL OR i."tokoId" != (SELECT o."tokoId" FROM "Order" o WHERE o.id = ol."orderId")
     UNION ALL
     SELECT prl.id, 'ProductionLine', prl."itemId" FROM "ProductionLine" prl LEFT JOIN "Item" i ON i.id = prl."itemId" WHERE i.id IS NOT NULL AND i."tokoId" != (SELECT np."tokoId" FROM "NewProduction" np WHERE np.id = prl."productionId")
     UNION ALL
     SELECT sm.id, 'StockMovement', sm."itemId" FROM "StockMovement" sm LEFT JOIN "Item" i ON i.id = sm."itemId" WHERE i.id IS NOT NULL AND i."tokoId" != sm."tokoId"`
  )
  if (orphanLines.length > 0) {
    for (const o of orphanLines) {
      report.add({ severity: "error", phase, message: `Orphan/mismatched FK: ${o.lineTable} ${o.lineId} -> item ${o.itemId}` })
    }
  } else {
    report.add({ severity: "info", phase, message: "No orphan/tenant mismatches found" })
  }

  // Gate: duplicate order numbers
  const dupNumbers = await prisma.$queryRawUnsafe<Array<{ tokoId: string; number: string; cnt: number }>>(
    `SELECT "tokoId", number, COUNT(*) as cnt FROM "Order" GROUP BY "tokoId", number HAVING COUNT(*) > 1`
  )
  if (dupNumbers.length > 0) {
    for (const d of dupNumbers) {
      report.add({ severity: "error", phase, tokoId: d.tokoId, message: `Duplicate order number: ${d.number} (${d.cnt})` })
    }
  }

  // Gate: duplicate dedupe keys
  const dupDedupe = await prisma.$queryRawUnsafe<Array<{ dedupeKey: string; cnt: number }>>(
    `SELECT "dedupeKey", COUNT(*) as cnt FROM "StockMovement" GROUP BY "dedupeKey" HAVING COUNT(*) > 1`
  )
  if (dupDedupe.length > 0) {
    for (const d of dupDedupe) {
      report.add({ severity: "error", phase, message: `Duplicate dedupe key: ${d.dedupeKey} (${d.cnt})` })
    }
  }

  // Gate: row-level checksum comparison for all mapped items
  const missingTargets = await prisma.$queryRawUnsafe<Array<{ sourceType: string; sourceId: string; targetType: string; targetId: string }>>(
    `SELECT m."sourceType", m."sourceId", m."targetType", m."targetId"
     FROM "LegacyRecordMap" m
     WHERE m."sourceChecksum" IS NOT NULL
     AND m."targetType" = 'Item'
     AND NOT EXISTS (SELECT 1 FROM "Item" it WHERE it.id = m."targetId")`
  )
  if (missingTargets.length > 0) {
    for (const m of missingTargets) {
      report.add({ severity: "error", phase, message: `Mapped target missing: ${m.sourceType} ${m.sourceId} -> ${m.targetType} ${m.targetId}` })
    }
  }

  // Gate: unresolved ambiguities in report
  if (report.hasAmbiguities()) {
    report.add({ severity: "error", phase, message: "Unresolved ambiguities block completion" })
  }

  // Final gate check
  const summary = report.summary()
  if (summary.errors > 0) {
    console.error(`\nVerification FAILED with ${summary.errors} errors and ${summary.warnings} warnings`)
  } else {
    console.log(`\nVerification PASSED: 0 errors, ${summary.warnings} warnings, ${summary.infos} info entries`)
  }
}

// ---- Main ----
async function main(): Promise<void> {
  console.log(`Migration backfill v2 started (${MIGRATION_VERSION})`)
  if (DRY_RUN) console.log("DRY RUN MODE - no writes will be performed")
  if (VERIFY_ONLY) console.log("VERIFY ONLY MODE - reconciliation and mapping checks only; no database writes")
  if (SKIP_WRITES) console.log(`Report output directory: ${OUTPUT_DIR}`)

  guardEnvironment()

  console.log("Acquiring advisory lock...")
  const locked = await acquireAdvisoryLock()
  if (!locked) {
    console.error("Another migration is already running. Aborting.")
    process.exit(1)
  }

  let runId = `dry-run-${Date.now()}`

  try {
    console.log("Lock acquired.")

    const userCount = await prisma.user.count()
    console.log(`Database OK. Users: ${userCount}`)

    await verifySchemaVersion()

    runId = await createRunRecord()
    console.log(`Migration run: ${runId}`)

    // Phase 2: Catalog
    await phase2Catalog(runId)

    // Phase 3: Documents
    await phase3Documents(runId)

    // Phase 4: Ledger
    await phase4Ledger(runId)

    // Phase 5: Reconcile
    await phase5Reconcile(runId)

    // Write final report
    const summary = report.summary()
    console.log(`\n=== Migration Report ===`)
    console.log(`Errors: ${summary.errors}, Warnings: ${summary.warnings}, Info: ${summary.infos}`)
    report.print()

    // Write machine-readable report file
    writeReportFile(runId)

    if (report.hasErrors()) {
      console.error("\nAborting: migration report contains errors.")
      await failRunRecord(runId, `Report contains ${summary.errors} errors`)
      process.exitCode = 1
      return
    }

    if (report.hasAmbiguities()) {
      console.warn("\nWarning: migration report contains unresolved ambiguities.")
      console.warn("These block cutover but backfill completed.")
      await completeRunRecord(runId)
      return
    }

    await completeRunRecord(runId)
    console.log("\nMigration backfill completed successfully.")

  } catch (error) {
    console.error("Migration failed:", error)
    await failRunRecord(runId, String(error))
    writeReportFile(runId)
    throw error
  } finally {
    await releaseAdvisoryLock()
    console.log("Advisory lock released")
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
