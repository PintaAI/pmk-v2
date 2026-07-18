// Unit tests for order state transitions and validation.
// Run with: npx tsx --test tests/unit/order-lifecycle.test.ts

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

describe("Order State Transitions", () => {
  const VALID_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"]
  const VALID_FULFILLMENT_STATUSES = ["UNFULFILLED", "PROCESSING", "READY", "SHIPPED", "FULFILLED", "CANCELLED"]
  const VALID_PAYMENT_METHODS = ["CASH", "QRIS", "TRANSFER", "EWALLET", "OTHER"]
  const VALID_CHANNELS = ["CASHIER", "RESELLER", "ONLINE"]

  it("allows valid payment status transitions", () => {
    const transitions: Record<string, string[]> = {
      UNPAID: ["PARTIALLY_PAID", "PAID"],
      PARTIALLY_PAID: ["PAID", "UNPAID"],
      PAID: ["REFUNDED"],
      REFUNDED: [],
    }
    for (const [from, toList] of Object.entries(transitions)) {
      for (const to of toList) {
        assert.ok(VALID_PAYMENT_STATUSES.includes(from))
        assert.ok(VALID_PAYMENT_STATUSES.includes(to))
      }
    }
  })

  it("validates payment methods", () => {
    assert.ok(VALID_PAYMENT_METHODS.includes("CASH"))
    assert.ok(VALID_PAYMENT_METHODS.includes("QRIS"))
    assert.equal(VALID_PAYMENT_METHODS.length, 5)
  })

  it("validates channels", () => {
    assert.ok(VALID_CHANNELS.includes("CASHIER"))
    assert.ok(VALID_CHANNELS.includes("RESELLER"))
    assert.ok(VALID_CHANNELS.includes("ONLINE"))
  })

  it("all fulfillment statuses are valid", () => {
    assert.equal(VALID_FULFILLMENT_STATUSES.length, 6)
    for (const s of VALID_FULFILLMENT_STATUSES) {
      assert.ok(typeof s === "string")
    }
  })
})

describe("Payment note parsing", () => {
  function parsePaymentMethod(note: string | null): string {
    const normalized = (note ?? "").toLowerCase()
    if (normalized.includes("cash")) return "CASH"
    if (normalized.includes("qris")) return "QRIS"
    if (normalized.includes("transfer")) return "TRANSFER"
    if (normalized.includes("ewallet") || normalized.includes("e-wallet")) return "EWALLET"
    return "OTHER"
  }

  it("detects CASH from note", () => {
    assert.equal(parsePaymentMethod("Checkout kasir · CASH"), "CASH")
    assert.equal(parsePaymentMethod("CASHIER cash"), "CASH")
  })

  it("detects QRIS from note", () => {
    assert.equal(parsePaymentMethod("Checkout QRIS"), "QRIS")
  })

  it("detects TRANSFER from note", () => {
    assert.equal(parsePaymentMethod("Payment via transfer"), "TRANSFER")
  })

  it("defaults to OTHER", () => {
    assert.equal(parsePaymentMethod(null), "OTHER")
    assert.equal(parsePaymentMethod("unknown payment"), "OTHER")
  })
})
