// Unit tests for migration library pure functions.
import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import {
  canonicalChecksum,
  parsePaymentMethodFromNote,
  classifyOrderSourceFromNote,
  fingerprintOrderLines,
  scoreConversionCandidate,
  isHighConfidenceMatch,
  isLowConfidenceMatch,
  computeOpeningBalance,
  validateDateFilter,
  getLegacyMovementSourceType,
  mapLegacyMovementTypeToStockMovementType,
  safeOrderNumber,
} from "../../scripts/migration-lib"

describe("canonicalChecksum", () => {
  it("produces deterministic hash", () => {
    const h1 = canonicalChecksum({ a: "1", b: "2" })
    const h2 = canonicalChecksum({ a: "1", b: "2" })
    assert.equal(h1, h2)
  })

  it("produces different hash for different values", () => {
    const h1 = canonicalChecksum({ a: "1" })
    const h2 = canonicalChecksum({ a: "2" })
    assert.notEqual(h1, h2)
  })

  it("is ordering-independent", () => {
    const h1 = canonicalChecksum({ a: "1", b: "2" })
    const h2 = canonicalChecksum({ b: "2", a: "1" })
    assert.equal(h1, h2, "Hash must be identical regardless of key order")
  })

  it("handles Date objects", () => {
    const d = new Date("2026-01-01T00:00:00Z")
    const h = canonicalChecksum({ date: d })
    assert.ok(typeof h === "string")
    assert.ok(h.length === 64)
  })

  it("skips null/undefined values", () => {
    const h1 = canonicalChecksum({ a: "1", b: null, c: undefined })
    const h2 = canonicalChecksum({ a: "1" })
    assert.equal(h1, h2)
  })

  it("returns 64-char hex string", () => {
    const h = canonicalChecksum({ x: "test" })
    assert.equal(h.length, 64)
    assert.ok(/^[0-9a-f]+$/.test(h))
  })
})

describe("parsePaymentMethodFromNote", () => {
  it("detects CASH", () => {
    assert.equal(parsePaymentMethodFromNote("Checkout kasir CASH"), "CASH")
    assert.equal(parsePaymentMethodFromNote("tunai payment"), "CASH")
  })

  it("detects QRIS", () => {
    assert.equal(parsePaymentMethodFromNote("qris payment"), "QRIS")
    assert.equal(parsePaymentMethodFromNote("QRIS"), "QRIS")
  })

  it("detects TRANSFER", () => {
    assert.equal(parsePaymentMethodFromNote("bank transfer"), "TRANSFER")
    assert.equal(parsePaymentMethodFromNote("tf bca"), "TRANSFER")
  })

  it("detects EWALLET", () => {
    assert.equal(parsePaymentMethodFromNote("gopay"), "EWALLET")
    assert.equal(parsePaymentMethodFromNote("ovo payment"), "EWALLET")
    assert.equal(parsePaymentMethodFromNote("dana"), "EWALLET")
    assert.equal(parsePaymentMethodFromNote("shopeepay"), "EWALLET")
    assert.equal(parsePaymentMethodFromNote("ewallet"), "EWALLET")
  })

  it("detects OTHER", () => {
    assert.equal(parsePaymentMethodFromNote("debit card"), "OTHER")
    assert.equal(parsePaymentMethodFromNote("kartu kredit"), "OTHER")
  })

  it("returns null for null/empty", () => {
    assert.equal(parsePaymentMethodFromNote(null), null)
    assert.equal(parsePaymentMethodFromNote(""), null)
    assert.equal(parsePaymentMethodFromNote("unknown method"), null)
  })
})

describe("classifyOrderSourceFromNote", () => {
  it("detects RESELLER", () => {
    assert.equal(classifyOrderSourceFromNote("reseller order"), "RESELLER")
  })

  it("detects ONLINE", () => {
    assert.equal(classifyOrderSourceFromNote("online sale"), "ONLINE")
  })

  it("returns null for no match", () => {
    assert.equal(classifyOrderSourceFromNote(null), null)
    assert.equal(classifyOrderSourceFromNote("cashier"), null)
  })
})

describe("fingerprintOrderLines", () => {
  it("is deterministic", () => {
    const lines = [{ productId: "abc", qty: 10, unitPrice: 5000 }]
    assert.equal(fingerprintOrderLines(lines), fingerprintOrderLines(lines))
  })

  it("is order-independent", () => {
    const l1 = [{ productId: "a", qty: 1, unitPrice: 100 }, { productId: "b", qty: 2, unitPrice: 200 }]
    const l2 = [{ productId: "b", qty: 2, unitPrice: 200 }, { productId: "a", qty: 1, unitPrice: 100 }]
    assert.equal(fingerprintOrderLines(l1), fingerprintOrderLines(l2))
  })

  it("differs for different lines", () => {
    const l1 = [{ productId: "a", qty: 1, unitPrice: 100 }]
    const l2 = [{ productId: "a", qty: 2, unitPrice: 100 }]
    assert.notEqual(fingerprintOrderLines(l1), fingerprintOrderLines(l2))
  })

  it("handles empty lines", () => {
    const fp = fingerprintOrderLines([])
    assert.ok(typeof fp === "string")
  })
})

describe("scoreConversionCandidate", () => {
  const baseParams = {
    pesananActorId: "user1",
    saleCreatedById: "user1",
    pesananTotal: "100000",
    saleTotal: "100000",
    pesananFingerprint: "abc123",
    saleFingerprint: "abc123",
    pesananCreatedAt: new Date("2026-01-01T12:00:00Z"),
    saleCreatedAt: new Date("2026-01-01T12:05:00Z"),
    pesananNote: null,
    hasSaleInvoiceMetadata: true,
    pesananStoreId: "store1",
    saleStoreId: "store1",
  }

  it("gives high confidence for perfect match", () => {
    const { confidence, signals } = scoreConversionCandidate(baseParams)
    assert.ok(confidence >= 60, `Expected high confidence, got ${confidence}`)
    assert.ok(signals.exactActorMatch)
    assert.ok(signals.totalExactMatch)
    assert.ok(signals.lineFingerprintMatch)
    assert.ok(signals.hasInvoiceMetadata)
  })

  it("rejects cross-store matches", () => {
    const { confidence } = scoreConversionCandidate({ ...baseParams, pesananStoreId: "store2" })
    assert.equal(confidence, -1)
  })

  it("gives moderate confidence without fingerprint match", () => {
    const { confidence } = scoreConversionCandidate({ ...baseParams, pesananFingerprint: "xyz" })
    assert.ok(confidence < 80, `Expected lower confidence, got ${confidence}`)
  })

  it("gives low confidence for poor match", () => {
    const { confidence } = scoreConversionCandidate({
      ...baseParams,
      pesananActorId: "user2",
      pesananTotal: "99999",
      pesananFingerprint: "xyz",
      hasSaleInvoiceMetadata: false,
    })
    assert.ok(confidence < 40, `Expected low confidence, got ${confidence}`)
  })

  it("detects timestamp proximity", () => {
    const { signals } = scoreConversionCandidate(baseParams)
    assert.ok(signals.timestampProximityMinutes !== null)
    assert.ok(signals.timestampProximityMinutes! <= 60)
  })

  it("detects conversion note", () => {
    const { signals } = scoreConversionCandidate({ ...baseParams, pesananNote: "Konversi dari pesanan" })
    assert.ok(signals.hasConversionNote)
  })
})

describe("isHighConfidenceMatch", () => {
  it("returns true for >= 60", () => {
    assert.equal(isHighConfidenceMatch(60), true)
    assert.equal(isHighConfidenceMatch(85), true)
  })

  it("returns false for < 60", () => {
    assert.equal(isHighConfidenceMatch(59), false)
    assert.equal(isHighConfidenceMatch(0), false)
  })
})

describe("isLowConfidenceMatch", () => {
  it("returns true for < 30", () => {
    assert.equal(isLowConfidenceMatch(29), true)
    assert.equal(isLowConfidenceMatch(0), true)
  })

  it("returns false for >= 30", () => {
    assert.equal(isLowConfidenceMatch(30), false)
  })
})

describe("computeOpeningBalance", () => {
  it("computes positive opening", () => {
    const result = computeOpeningBalance("100", "50")
    assert.equal(result.opening, "50")
    assert.equal(result.isNonZero, true)
  })

  it("computes negative opening", () => {
    const result = computeOpeningBalance("50", "100")
    assert.equal(result.opening, "-50")
    assert.equal(result.isNonZero, true)
  })

  it("returns zero for equal", () => {
    const result = computeOpeningBalance("100", "100")
    assert.equal(result.opening, "0")
    assert.equal(result.isNonZero, false)
  })

  it("handles decimal values", () => {
    const result = computeOpeningBalance("100.50", "50.25")
    assert.equal(result.opening, "50.25")
    assert.equal(result.isNonZero, true)
  })

  it("handles invalid input", () => {
    const result = computeOpeningBalance("abc", "def")
    assert.equal(result.isNonZero, false)
  })
})

describe("validateDateFilter", () => {
  it("accepts valid dates", () => {
    const result = validateDateFilter({ from: "2026-01-01", to: "2026-12-31" })
    assert.ok(!("error" in result))
    if (!("error" in result)) {
      assert.ok(result.fromDate instanceof Date)
      assert.ok(result.toDate instanceof Date)
    }
  })

  it("accepts only from date", () => {
    const result = validateDateFilter({ from: "2026-01-01", to: null })
    assert.ok(!("error" in result))
  })

  it("rejects invalid dates", () => {
    const result = validateDateFilter({ from: "not-a-date", to: null })
    assert.ok("error" in result)
  })

  it("rejects from > to", () => {
    const result = validateDateFilter({ from: "2026-12-31", to: "2026-01-01" })
    assert.ok("error" in result)
  })

  it("accepts only to date", () => {
    const result = validateDateFilter({ from: null, to: "2026-12-31" })
    assert.ok(!("error" in result))
  })

  it("accepts no dates", () => {
    const result = validateDateFilter({ from: null, to: null })
    assert.ok(!("error" in result))
    if (!("error" in result)) {
      assert.equal(result.fromDate, undefined)
      assert.equal(result.toDate, undefined)
    }
  })
})

describe("getLegacyMovementSourceType", () => {
  it("maps known types", () => {
    assert.equal(getLegacyMovementSourceType("belanja"), "Purchase")
    assert.equal(getLegacyMovementSourceType("production"), "Production")
    assert.equal(getLegacyMovementSourceType("sale"), "Order")
    assert.equal(getLegacyMovementSourceType("pesanan"), "Order")
  })

  it("is case-insensitive", () => {
    assert.equal(getLegacyMovementSourceType("BELANJA"), "Purchase")
    assert.equal(getLegacyMovementSourceType("Sale"), "Order")
  })

  it("falls back to original", () => {
    assert.equal(getLegacyMovementSourceType(null), "Legacy")
    assert.equal(getLegacyMovementSourceType("custom_type"), "custom_type")
  })
})

describe("mapLegacyMovementTypeToStockMovementType", () => {
  it("maps BAHAN_PURCHASE", () => {
    assert.equal(mapLegacyMovementTypeToStockMovementType("BAHAN_PURCHASE"), "PURCHASE")
  })

  it("maps BAHAN_PRODUCTION_USAGE", () => {
    assert.equal(mapLegacyMovementTypeToStockMovementType("BAHAN_PRODUCTION_USAGE"), "PRODUCTION_INPUT")
  })

  it("maps PRODUCT_PRODUCTION_OUTPUT", () => {
    assert.equal(mapLegacyMovementTypeToStockMovementType("PRODUCT_PRODUCTION_OUTPUT"), "PRODUCTION_OUTPUT")
  })

  it("maps PRODUCT_SALE", () => {
    assert.equal(mapLegacyMovementTypeToStockMovementType("PRODUCT_SALE"), "SALE")
  })

  it("maps STOCK_ADJUSTMENT", () => {
    assert.equal(mapLegacyMovementTypeToStockMovementType("STOCK_ADJUSTMENT"), "ADJUSTMENT")
  })

  it("defaults to PURCHASE", () => {
    assert.equal(mapLegacyMovementTypeToStockMovementType("UNKNOWN_TYPE"), "PURCHASE")
  })
})

describe("safeOrderNumber", () => {
  it("prefixes correctly", () => {
    assert.equal(safeOrderNumber("SALE", "INV-001"), "SALE-INV-001")
  })

  it("strips non-alphanumeric except dash", () => {
    assert.equal(safeOrderNumber("PES", "PESANAN/001#2"), "PES-PESANAN0012")
  })

  it("handles empty string", () => {
    assert.equal(safeOrderNumber("ORD", ""), "ORD-")
  })
})

describe("gate failure: confidence below threshold", () => {
  it("isHighConfidence rejects moderate matches", () => {
    assert.equal(isHighConfidenceMatch(50), false)
    assert.equal(isHighConfidenceMatch(59), false)
  })

  it("isLowConfidence catches weak matches", () => {
    assert.equal(isLowConfidenceMatch(20), true)
    assert.equal(isLowConfidenceMatch(29), true)
  })

  it("moderate matches (30-59) are neither high nor low", () => {
    assert.equal(isHighConfidenceMatch(45), false)
    assert.equal(isLowConfidenceMatch(45), false)
  })
})
