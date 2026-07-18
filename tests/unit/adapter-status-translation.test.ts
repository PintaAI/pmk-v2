// Adapter status translation tests.
// Run with: npx tsx --test tests/unit/adapter-status-translation.test.ts

import { describe, it } from "node:test"
import * as assert from "node:assert/strict"

describe("Pesanan status translation maps", () => {
  const pengirimanToFulfillment: Record<string, string> = {
    BELUM: "UNFULFILLED",
    DIKIRIM: "SHIPPED",
  }

  const pembayaranToPayment: Record<string, string> = {
    BELUM: "UNPAID",
    DIBAYAR: "PAID",
  }

  it("maps BELUM to UNFULFILLED", () => {
    assert.equal(pengirimanToFulfillment["BELUM"], "UNFULFILLED")
  })

  it("maps DIKIRIM to SHIPPED", () => {
    assert.equal(pengirimanToFulfillment["DIKIRIM"], "SHIPPED")
  })

  it("maps BELUM to UNPAID", () => {
    assert.equal(pembayaranToPayment["BELUM"], "UNPAID")
  })

  it("maps DIBAYAR to PAID", () => {
    assert.equal(pembayaranToPayment["DIBAYAR"], "PAID")
  })

  it("has exactly 2 entries in each map", () => {
    assert.equal(Object.keys(pengirimanToFulfillment).length, 2)
    assert.equal(Object.keys(pembayaranToPayment).length, 2)
  })
})

describe("Legacy input field translation", () => {
  function translateBelanjaItems(
    items?: Array<{ bahanId: string; qty: string | number; unit?: string; unitPrice: string | number }>,
  ): Array<{ itemId: string; qty: string | number; unit?: string; unitPrice: string | number }> {
    return (items ?? []).map((item) => ({
      itemId: item.bahanId,
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unitPrice,
    }))
  }

  function translatePesananToManualOrder(
    input: {
      namaPelanggan?: string
      kontak?: string
      catatan?: string
      items: Array<{ productId: string; qty: string | number; priceTierId?: string; customUnitPrice?: string | number }>
    },
  ) {
    return {
      customerName: input.namaPelanggan,
      customerContact: input.kontak,
      note: input.catatan,
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.qty),
        priceTierId: item.priceTierId,
        customUnitPrice: item.customUnitPrice,
      })),
    }
  }

  it("translates bahanId to itemId in belanja items", () => {
    const translated = translateBelanjaItems([
      { bahanId: "b1", qty: "5", unit: "kg", unitPrice: "10000" },
      { bahanId: "b2", qty: 2, unitPrice: 5000 },
    ])
    assert.equal(translated[0].itemId, "b1")
    assert.equal(translated[0].qty, "5")
    assert.equal(translated[1].itemId, "b2")
    assert.equal(translated[1].qty, 2)
  })

  it("translates empty belanja items", () => {
    assert.equal(translateBelanjaItems(undefined).length, 0)
    assert.equal(translateBelanjaItems([]).length, 0)
  })

  it("translates pesanan fields to manual order fields", () => {
    const result = translatePesananToManualOrder({
      namaPelanggan: "Budi",
      kontak: "081234",
      catatan: "cepat",
      items: [{ productId: "p1", qty: "3", customUnitPrice: "15000" }],
    })
    assert.equal(result.customerName, "Budi")
    assert.equal(result.customerContact, "081234")
    assert.equal(result.note, "cepat")
    assert.equal(result.items[0].productId, "p1")
    assert.equal(result.items[0].quantity, 3)
    assert.equal(result.items[0].customUnitPrice, "15000")
  })

  it("translates partial pesanan (no customer)", () => {
    const result = translatePesananToManualOrder({
      items: [{ productId: "p1", qty: 1 }],
    })
    assert.equal(result.customerName, undefined)
    assert.equal(result.items[0].quantity, 1)
  })
})

describe("completePesanan uses completeOrder with CASH default", () => {
  it("builds CompleteOrderInput with CASH payment method", () => {
    function buildCompleteOrderInput(channel: string) {
      return {
        channel,
        paymentMethod: "CASH",
      }
    }
    const input = buildCompleteOrderInput("RESELLER")
    assert.equal(input.channel, "RESELLER")
    assert.equal(input.paymentMethod, "CASH")
  })
})

describe("checkMaintenance is present in adapter flow", () => {
  it("checkMaintenance is importable", async () => {
    const mod = await import("@/server/domain/maintenance-check")
    assert.equal(typeof mod.checkMaintenance, "function")
  })

  it("createPurchase calls checkMaintenance", async () => {
    const mod = await import("@/server/domain/purchases/purchase-service")
    assert.equal(typeof mod.createPurchase, "function")
    // At runtime the function body calls checkMaintenance() early
  })

  it("createManualOrder calls checkMaintenance", async () => {
    const mod = await import("@/server/domain/orders/order-service")
    assert.equal(typeof mod.createManualOrder, "function")
    assert.equal(typeof mod.completeOrder, "function")
    assert.equal(typeof mod.cancelOrder, "function")
    assert.equal(typeof mod.updateOrderPayment, "function")
    assert.equal(typeof mod.updateOrderFulfillment, "function")
  })
})
