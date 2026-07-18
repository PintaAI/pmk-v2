// Unit tests for domain types, errors, and pure functions.
// Run with: npx tsx --test tests/unit/domain-errors.test.ts

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import { ValidationError, UnauthenticatedError, ForbiddenError, NotFoundError, InsufficientStockError, IdempotencyConflictError } from "../../server/domain/errors"
import { ItemType, OrderStatus, PaymentMethod, OperationalMode } from "../../server/domain/types"
import { isMaintenanceMode } from "../../server/domain/maintenance"
import { checkMaintenance } from "../../server/domain/maintenance-check"

describe("Domain Errors", () => {
  it("ValidationError has correct name and message", () => {
    const err = new ValidationError("Test message")
    assert.equal(err.name, "ValidationError")
    assert.equal(err.message, "Test message")
  })

  it("UnauthenticatedError has default message", () => {
    const err = new UnauthenticatedError()
    assert.equal(err.name, "UnauthenticatedError")
    assert.equal(err.message, "Authentication required")
  })

  it("ForbiddenError has default message", () => {
    const err = new ForbiddenError()
    assert.equal(err.name, "ForbiddenError")
    assert.equal(err.message, "Forbidden")
  })

  it("NotFoundError has default message", () => {
    const err = new NotFoundError()
    assert.equal(err.name, "NotFoundError")
    assert.equal(err.message, "Not found")
  })

  it("InsufficientStockError formats correctly", () => {
    const err = new InsufficientStockError("Flour", "10", "5")
    assert.ok(err.message.includes("Flour"))
    assert.ok(err.message.includes("10"))
    assert.ok(err.message.includes("5"))
  })

  it("IdempotencyConflictError has correct message", () => {
    const err = new IdempotencyConflictError()
    assert.equal(err.name, "IdempotencyConflictError")
  })
})

describe("DTO Types", () => {
  it("ItemType enum values are correct", () => {
    assert.equal(ItemType.MATERIAL, "MATERIAL")
    assert.equal(ItemType.PRODUCT, "PRODUCT")
  })

  it("OrderStatus values are correct", () => {
    assert.equal(OrderStatus.DRAFT, "DRAFT")
    assert.equal(OrderStatus.COMPLETED, "COMPLETED")
    assert.equal(OrderStatus.CANCELLED, "CANCELLED")
  })

  it("PaymentMethod values are correct", () => {
    assert.equal(PaymentMethod.CASH, "CASH")
    assert.equal(PaymentMethod.QRIS, "QRIS")
    assert.equal(PaymentMethod.TRANSFER, "TRANSFER")
    assert.equal(PaymentMethod.EWALLET, "EWALLET")
    assert.equal(PaymentMethod.OTHER, "OTHER")
  })

  it("OperationalMode has all three modes", () => {
    assert.equal(OperationalMode.CASHIER_ONLY, "CASHIER_ONLY")
    assert.equal(OperationalMode.SIMPLE_INVENTORY, "SIMPLE_INVENTORY")
    assert.equal(OperationalMode.WITH_INVENTORY, "WITH_INVENTORY")
  })
})

describe("Maintenance", () => {
  it("isMaintenanceMode reads env var", () => {
    const original = process.env.MAINTENANCE_MODE
    process.env.MAINTENANCE_MODE = "1"
    assert.equal(isMaintenanceMode(), true)
    process.env.MAINTENANCE_MODE = "0"
    assert.equal(isMaintenanceMode(), false)
    process.env.MAINTENANCE_MODE = original
  })

  it("checkMaintenance throws when in maintenance mode", () => {
    const original = process.env.MAINTENANCE_MODE
    process.env.MAINTENANCE_MODE = "1"
    try {
      assert.throws(() => checkMaintenance())
    } finally {
      process.env.MAINTENANCE_MODE = original
    }
  })
})
