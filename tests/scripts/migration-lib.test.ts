// Tests for migration-lib pure functions.
// Run: npx tsx --test tests/scripts/migration-lib.test.ts

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import {
  canonicalChecksum,
  fingerprintOrderLines,
  scoreConversionCandidate,
  isHighConfidenceMatch,
  isLowConfidenceMatch,
  parsePaymentMethodFromNote,
  classifyOrderSourceFromNote,
  safeOrderNumber,
} from "../../scripts/migration-lib"

describe("canonicalChecksum", () => {
  it("produces deterministic hash regardless of key ordering", () => {
    const a = canonicalChecksum({ name: "Test", qty: "5", unit: "kg" })
    const b = canonicalChecksum({ unit: "kg", qty: "5", name: "Test" })
    assert.equal(a, b)
  })

  it("different values produce different hashes", () => {
    const a = canonicalChecksum({ name: "A", qty: "5" })
    const b = canonicalChecksum({ name: "A", qty: "6" })
    assert.notEqual(a, b)
  })

  it("removes null/undefined fields", () => {
    const a = canonicalChecksum({ name: "Test", qty: null, optional: undefined })
    const b = canonicalChecksum({ name: "Test" })
    assert.equal(a, b)
  })
})

describe("fingerprintOrderLines", () => {
  it("same lines produce identical fingerprints", () => {
    const a = fingerprintOrderLines([{ productId: "p1", qty: 2, unitPrice: 5000 }])
    const b = fingerprintOrderLines([{ productId: "p1", qty: 2, unitPrice: 5000 }])
    assert.equal(a, b)
  })

  it("line order does not affect fingerprint", () => {
    const a = fingerprintOrderLines([
      { productId: "p1", qty: 1, unitPrice: 100 },
      { productId: "p2", qty: 2, unitPrice: 200 },
    ])
    const b = fingerprintOrderLines([
      { productId: "p2", qty: 2, unitPrice: 200 },
      { productId: "p1", qty: 1, unitPrice: 100 },
    ])
    assert.equal(a, b)
  })

  it("different lines produce different fingerprints", () => {
    const a = fingerprintOrderLines([{ productId: "p1", qty: 1, unitPrice: 100 }])
    const b = fingerprintOrderLines([{ productId: "p1", qty: 2, unitPrice: 100 }])
    assert.notEqual(a, b)
  })
})

describe("scoreConversionCandidate", () => {
  const baseParams = {
    pesananActorId: "user1",
    saleCreatedById: "user1",
    pesananTotal: "100000",
    saleTotal: "100000",
    pesananFingerprint: "abc",
    saleFingerprint: "abc",
    pesananCreatedAt: new Date("2026-06-01T12:00:00Z"),
    saleCreatedAt: new Date("2026-06-01T12:05:00Z"),
    pesananNote: null,
    hasSaleInvoiceMetadata: false,
    pesananStoreId: "store1",
    saleStoreId: "store1",
  }

  it("cross-store match returns -1 confidence", () => {
    const result = scoreConversionCandidate({ ...baseParams, pesananStoreId: "store1", saleStoreId: "store2" })
    assert.equal(result.confidence, -1)
  })

  it("full match gives high confidence", () => {
    const result = scoreConversionCandidate(baseParams)
    assert.ok(result.confidence > 50, `expected > 50, got ${result.confidence}`)
    assert.ok(result.signals.exactActorMatch)
    assert.ok(result.signals.totalExactMatch)
    assert.ok(result.signals.lineFingerprintMatch)
  })

  it("only actor match gives low confidence", () => {
    const result = scoreConversionCandidate({
      ...baseParams,
      saleTotal: "99999",
      saleFingerprint: "different",
      saleCreatedAt: new Date("2026-07-15T00:00:00Z"),
    })
    assert.ok(result.confidence < 30, `expected < 30, got ${result.confidence}`)
  })

  it("timestamp proximity boosts score", () => {
    const close = scoreConversionCandidate({
      ...baseParams,
      saleTotal: "99999",
      saleFingerprint: "different",
    })
    const far = scoreConversionCandidate({
      ...baseParams,
      saleTotal: "99999",
      saleFingerprint: "different",
      saleCreatedAt: new Date("2026-07-15T00:00:00Z"),
    })
    assert.ok(close.confidence > far.confidence, `close=${close.confidence} should be > far=${far.confidence}`)
  })

  it("conversion note adds signal", () => {
    const result = scoreConversionCandidate({
      ...baseParams,
      pesananNote: "konversi dari pesanan",
      saleTotal: "99999",
      saleFingerprint: "different",
    })
    assert.ok(result.signals.hasConversionNote)
  })
})

describe("isHighConfidenceMatch", () => {
  it("returns true for >= 60", () => {
    assert.ok(isHighConfidenceMatch(60))
    assert.ok(isHighConfidenceMatch(100))
  })

  it("returns false for < 60", () => {
    assert.equal(isHighConfidenceMatch(59), false)
    assert.equal(isHighConfidenceMatch(0), false)
  })
})

describe("isLowConfidenceMatch", () => {
  it("returns true for < 30", () => {
    assert.ok(isLowConfidenceMatch(29))
    assert.ok(isLowConfidenceMatch(0))
  })

  it("returns false for >= 30", () => {
    assert.equal(isLowConfidenceMatch(30), false)
  })
})

describe("parsePaymentMethodFromNote", () => {
  it("detects QRIS", () => {
    assert.equal(parsePaymentMethodFromNote("QRIS"), "QRIS")
    assert.equal(parsePaymentMethodFromNote("via qris"), "QRIS")
  })
  it("detects transfer", () => {
    assert.equal(parsePaymentMethodFromNote("TF BCA"), "TRANSFER")
  })
  it("returns null for empty note", () => {
    assert.equal(parsePaymentMethodFromNote(null), null)
  })
})

describe("classifyOrderSourceFromNote", () => {
  it("detects reseller", () => {
    assert.equal(classifyOrderSourceFromNote("reseller A"), "RESELLER")
  })
  it("returns null for no match", () => {
    assert.equal(classifyOrderSourceFromNote("regular sale"), null)
  })
})

describe("safeOrderNumber", () => {
  it("prefix + sanitized raw", () => {
    assert.equal(safeOrderNumber("SALE", "INV/2026-01"), "SALE-INV2026-01")
  })
  it("preserves alphanumeric", () => {
    assert.equal(safeOrderNumber("PO", "ABC123"), "PO-ABC123")
  })
})
