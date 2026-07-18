// Pure functions extracted from migration-backfill for testability.
// All functions are deterministic, side-effect-free, and independently testable.

import { createHash } from "node:crypto"

export function canonicalChecksum(fields: Record<string, unknown>): string {
  const canonical = Object.keys(fields).sort().reduce<Record<string, string>>((acc, k) => {
    const v = fields[k]
    if (v instanceof Date) {
      acc[k] = v.toISOString()
    } else if (v !== null && v !== undefined) {
      acc[k] = String(v)
    }
    return acc
  }, {})
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export function parsePaymentMethodFromNote(note: string | null): string | null {
  if (!note) return null
  const lower = note.toLowerCase()
  if (lower.includes("qris")) return "QRIS"
  if (lower.includes("transfer") || lower.includes("tf ")) return "TRANSFER"
  if (lower.includes("ewallet") || lower.includes("gopay") || lower.includes("ovo") || lower.includes("dana") || lower.includes("shopeepay")) return "EWALLET"
  if (lower.includes("cash") || lower.includes("tunai")) return "CASH"
  if (lower.includes("debit") || lower.includes("kartu")) return "OTHER"
  return null
}

export function classifyOrderSourceFromNote(note: string | null): string | null {
  if (!note) return null
  const lower = note.toLowerCase()
  if (lower.includes("reseller")) return "RESELLER"
  if (lower.includes("online")) return "ONLINE"
  return null
}

export function fingerprintOrderLines(lines: Array<{ productId: string; qty: string | number; unitPrice: string | number }>): string {
  const key = lines
    .map((l) => `${l.productId}:${l.qty}:${l.unitPrice}`)
    .sort()
    .join(",")
  return createHash("sha256").update(key).digest("hex").slice(0, 16)
}

export function safeOrderNumber(prefix: string, raw: string): string {
  return `${prefix}-${raw.replace(/[^A-Za-z0-9-]/g, "")}`
}

export interface ConversionCandidate {
  pesananId: string
  saleId: string
  pesananTotal: string
  saleTotal: string
  pesananActorId: string
  saleCreatedById: string
  pesananCreatedAt: Date
  saleCreatedAt: Date
  pesananLines: Array<{ productId: string; qty: string; unitPrice: string }>
  saleLines: Array<{ productId: string; qty: string; unitPrice: string }>
  signals: {
    exactActorMatch: boolean
    totalExactMatch: boolean
    lineFingerprintMatch: boolean
    timestampProximityMinutes: number | null
    hasConversionNote: boolean
    hasInvoiceMetadata: boolean
    confidence: number
  }
}

export function scoreConversionCandidate(params: {
  pesananActorId: string
  saleCreatedById: string
  pesananTotal: string
  saleTotal: string
  pesananFingerprint: string
  saleFingerprint: string
  pesananCreatedAt: Date
  saleCreatedAt: Date
  pesananNote: string | null
  hasSaleInvoiceMetadata: boolean
  pesananStoreId: string
  saleStoreId: string
}): { confidence: number; signals: ConversionCandidate["signals"] } {
  let score = 0
  const signals: ConversionCandidate["signals"] = {
    exactActorMatch: false,
    totalExactMatch: false,
    lineFingerprintMatch: false,
    timestampProximityMinutes: null,
    hasConversionNote: false,
    hasInvoiceMetadata: false,
    confidence: 0,
  }

  if (params.pesananStoreId !== params.saleStoreId) {
    return { confidence: -1, signals }
  }

  if (params.pesananActorId === params.saleCreatedById) {
    score += 3
    signals.exactActorMatch = true
  }

  if (params.pesananTotal === params.saleTotal) {
    score += 3
    signals.totalExactMatch = true
  }

  if (params.pesananFingerprint === params.saleFingerprint) {
    score += 5
    signals.lineFingerprintMatch = true
  }

  const tsDiff = Math.abs(params.pesananCreatedAt.getTime() - params.saleCreatedAt.getTime()) / 60000
  signals.timestampProximityMinutes = tsDiff
  if (tsDiff <= 60) {
    score += 2
  } else if (tsDiff <= 1440) {
    score += 1
  }

  const lowerNote = (params.pesananNote ?? "").toLowerCase()
  if (lowerNote.includes("konversi") || lowerNote.includes("convert") || lowerNote.includes("pesanan")) {
    score += 1
    signals.hasConversionNote = true
  }

  if (params.hasSaleInvoiceMetadata) {
    score += 3
    signals.hasInvoiceMetadata = true
  }

  const maxScore = 17
  signals.confidence = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  return { confidence: signals.confidence, signals }
}

export function isHighConfidenceMatch(confidence: number): boolean {
  return confidence >= 60
}

export function isLowConfidenceMatch(confidence: number): boolean {
  return confidence < 30
}

export function computeOpeningBalance(balanceQty: string, ledgerSum: string): { opening: string; isNonZero: boolean } {
  const balance = parseFloat(balanceQty)
  const sum = parseFloat(ledgerSum)
  const opening = balance - sum
  if (isNaN(opening) || opening === 0) return { opening: "0", isNonZero: false }
  return { opening: String(opening), isNonZero: true }
}

export function validateDateFilter(params: {
  from?: string | null
  to?: string | null
}): { fromDate?: Date; toDate?: Date } | { error: string } {
  let fromDate: Date | undefined
  let toDate: Date | undefined
  if (params.from) {
    fromDate = new Date(params.from)
    if (isNaN(fromDate.getTime())) return { error: `Invalid from date: ${params.from}` }
  }
  if (params.to) {
    toDate = new Date(params.to)
    if (isNaN(toDate.getTime())) return { error: `Invalid to date: ${params.to}` }
  }
  if (fromDate && toDate && fromDate > toDate) {
    return { error: "from date must be before to date" }
  }
  return { fromDate, toDate }
}

export function getLegacyMovementSourceType(referenceType: string | null): string {
  switch (referenceType?.toLowerCase()) {
    case "belanja": return "Purchase"
    case "production": return "Production"
    case "sale": return "Order"
    case "pesanan": return "Order"
    default: return referenceType || "Legacy"
  }
}

export function mapLegacyMovementTypeToStockMovementType(movementType: string): string {
  switch (movementType) {
    case "BAHAN_PURCHASE": return "PURCHASE"
    case "BAHAN_PRODUCTION_USAGE": return "PRODUCTION_INPUT"
    case "PRODUCT_PRODUCTION_OUTPUT": return "PRODUCTION_OUTPUT"
    case "PRODUCT_SALE": return "SALE"
    case "STOCK_ADJUSTMENT": return "ADJUSTMENT"
    default: return "PURCHASE"
  }
}
