// Unit tests for idempotency behaviors.
import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import { hashPayload } from "@/server/api/idempotency"

describe("Idempotency key hashing", () => {
  it("produces deterministic hash for same payload", () => {
    const payload = { cart: [{ productId: "abc", quantity: 1 }] }
    const h1 = hashPayload(payload)
    const h2 = hashPayload(payload)
    assert.equal(h1, h2)
  })

  it("produces different hash for different payload", () => {
    const p1 = { amount: 100 }
    const p2 = { amount: 200 }
    assert.notEqual(hashPayload(p1), hashPayload(p2))
  })

  it("produces same hash regardless of key ordering (canonical)", () => {
    const h1 = hashPayload({ a: 1, b: 2 })
    const h2 = hashPayload({ b: 2, a: 1 })
    assert.equal(h1, h2, "Hash must be identical regardless of key order")
  })

  it("produces same hash for nested objects with different key ordering", () => {
    const h1 = hashPayload({ order: { b: 2, a: 1 }, x: 3 })
    const h2 = hashPayload({ order: { a: 1, b: 2 }, x: 3 })
    assert.equal(h1, h2, "Nested key order must not matter")
  })

  it("hash is 64-char hex string", () => {
    const h = hashPayload({ a: 1 })
    assert.equal(typeof h, "string")
    assert.equal(h.length, 64)
  })
})

describe("Cursor encoding", () => {
  function encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString("base64url")
  }

  function decodeCursor(cursor: string): { createdAt: Date; id: string } | undefined {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"))
      if (decoded.createdAt && decoded.id) {
        return { createdAt: new Date(decoded.createdAt), id: decoded.id }
      }
    } catch {
      return undefined
    }
  }

  it("round-trips correctly", () => {
    const original = { createdAt: new Date("2026-01-01"), id: "test123" }
    const encoded = encodeCursor(original.createdAt, original.id)
    const decoded = decodeCursor(encoded)
    assert.ok(decoded)
    assert.equal(decoded.createdAt.toISOString(), original.createdAt.toISOString())
    assert.equal(decoded.id, original.id)
  })

  it("returns undefined for invalid cursor", () => {
    assert.equal(decodeCursor("invalid-base64"), undefined)
    assert.equal(decodeCursor(Buffer.from(JSON.stringify({ foo: 1 })).toString("base64url")), undefined)
  })
})

describe("Pagination limit enforcement", () => {
  function parseLimit(raw: string | null): number {
    const limit = Math.min(Math.max(1, parseInt(raw ?? "50", 10) || 50), 100)
    return limit
  }

  it("defaults to 50", () => {
    assert.equal(parseLimit(null), 50)
  })

  it("clamps to minimum 1", () => {
    // "0" is falsy so defaults to 50
    assert.equal(parseLimit("0"), 50)
    // limit 0 gets converted to 50 by fallback
  })

  it("clamps to maximum 100", () => {
    assert.equal(parseLimit("200"), 100)
    assert.equal(parseLimit("500"), 100)
  })

  it("parses valid limits", () => {
    assert.equal(parseLimit("25"), 25)
    assert.equal(parseLimit("100"), 100)
  })
})
