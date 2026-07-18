// Docker-backed DB integration tests.
// Requires Docker. Starts isolated PostgreSQL, deploys migrations, seeds data, runs tests, cleans up.
// Run: npx tsx --test tests/integration/db-integration.test.ts
// Or: bash scripts/run-integration-tests.sh

import { describe, it, before, after } from "node:test"
import * as assert from "node:assert/strict"
import { execSync, spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { PrismaClient } from "../../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma } from "../../generated/prisma/client"

const DB_PASS = "testpass123"
const DB_NAME = "pmk_test"
const CONTAINER_NAME_BASE = `pmk-int-${randomUUID().slice(0, 8)}`
const DB_PORT = 5430

const EXTERNAL_DB = !!process.env.DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || `postgresql://postgres:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}`

const dockerAvailable: boolean = !EXTERNAL_DB && (() => {
  try {
    execSync("docker info", { stdio: "pipe" })
    return true
  } catch {
    return false
  }
})()

// ---- Dynamic domain service loader ----
// Domain services import @/lib/prisma which uses Neon adapter.
// Set DATABASE_URL before loading them.
function loadDomainServices() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DATABASE_URL
    process.env.DIRECT_URL = DATABASE_URL
  }
  // Dynamic require avoids static ESM imports that initialize Neon adapter too early
  /* eslint-disable @typescript-eslint/no-require-imports */
  return {
    createProduction: require("../../server/domain/production/production-service").createProduction,
    checkoutOrder: require("../../server/domain/orders/order-service").checkoutOrder,
    completeOrder: require("../../server/domain/orders/order-service").completeOrder,
    cancelOrder: require("../../server/domain/orders/order-service").cancelOrder,
    createManualOrder: require("../../server/domain/orders/order-service").createManualOrder,
    createPurchase: require("../../server/domain/purchases/purchase-service").createPurchase,
    postAdjustment: require("../../server/domain/inventory/inventory-service").postAdjustment,
    updateProductDetails: require("../../server/domain/items/item-service").updateProductDetails,
  }
  /* eslint-enable @typescript-eslint/no-require-imports */
}

let services: ReturnType<typeof loadDomainServices>

// ---- Helpers ----
let prisma: PrismaClient
let store1Id: string
let store2Id: string
let user1Id: string
let user2Id: string
let regTierS1Id: string
let regTierS2Id: string

function ctx1() {
  return { actorId: user1Id, tokoId: store1Id, role: "OWNER" as const }
}
function ctx2() {
  return { actorId: user2Id, tokoId: store2Id, role: "OWNER" as const }
}

async function seedMaterial(tokoId: string, name: string, qty = "100", unit = "kg") {
  const id = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}`
  await prisma.item.create({
    data: { id, tokoId, type: "MATERIAL", name, unit, unitKind: "MASS", baseUnit: unit },
  })
  await prisma.stockBalance.create({ data: { itemId: id, quantity: qty, averageCost: 0, version: 0 } })
  return id
}

async function seedProduct(tokoId: string, name: string, qty = "100") {
  const id = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}`
  await prisma.item.create({
    data: { id, tokoId, type: "PRODUCT", name, unit: "pcs", unitKind: "COUNT", baseUnit: "pcs" },
  })
  await prisma.stockBalance.create({ data: { itemId: id, quantity: qty, averageCost: 0, version: 0 } })
  const priceTierId = tokoId === store1Id ? regTierS1Id : regTierS2Id
  await prisma.itemPrice.create({ data: { itemId: id, priceTierId, price: 10000 } })
  return id
}

// ---- Setup ----
if (!dockerAvailable && !EXTERNAL_DB) {
  describe("DB Integration Tests", () => {
    it("SKIPPED: Docker not available", () => { assert.ok(true) })
  })
} else {
  let containerName = ""
  before(async () => {
    if (EXTERNAL_DB) {
      console.log("Using external DATABASE_URL, skipping Docker setup.")
    } else {
      containerName = CONTAINER_NAME_BASE
      execSync(`docker run -d --name ${containerName} \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=${DB_PASS} \
        -e POSTGRES_DB=${DB_NAME} \
        -p ${DB_PORT}:5432 \
        postgres:17-alpine`, { stdio: "pipe" })
      for (let i = 0; i < 30; i++) {
        try {
          execSync(`docker exec ${containerName} pg_isready -U postgres`, { stdio: "pipe" })
          break
        } catch { await new Promise((r) => setTimeout(r, 1000)) }
      }
      const deployResult = spawnSync("npx", ["prisma", "migrate", "deploy"], {
        env: { ...process.env, DATABASE_URL, DIRECT_URL: DATABASE_URL },
        cwd: path.resolve(import.meta.dirname ?? __dirname, "..", ".."),
        stdio: "pipe",
        timeout: 60000,
      })
      if (deployResult.status !== 0) { console.error(deployResult.stderr.toString()); throw new Error("Migration deploy failed") }
      const genResult = spawnSync("npx", ["prisma", "generate"], {
        env: { ...process.env, DATABASE_URL, DIRECT_URL: DATABASE_URL },
        cwd: path.resolve(import.meta.dirname ?? __dirname, "..", ".."),
        stdio: "pipe",
        timeout: 60000,
      })
      if (genResult.status !== 0) { console.error(genResult.stderr.toString()); throw new Error("Prisma generate failed") }
    }

    process.env.DATABASE_URL = DATABASE_URL
    process.env.DIRECT_URL = DATABASE_URL

    // Load domain services after DATABASE_URL is set
    services = loadDomainServices()

    prisma = new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) })

    user1Id = `u1-${randomUUID().slice(0, 8)}`
    user2Id = `u2-${randomUUID().slice(0, 8)}`
    store1Id = `s1-${randomUUID().slice(0, 8)}`
    store2Id = `s2-${randomUUID().slice(0, 8)}`
    regTierS1Id = `pt1-${randomUUID().slice(0, 8)}`
    regTierS2Id = `pt2-${randomUUID().slice(0, 8)}`

    await prisma.$transaction([
      prisma.user.create({ data: { id: user1Id, name: "Owner One", email: `${user1Id}@test.com`, emailVerified: true } }),
      prisma.user.create({ data: { id: user2Id, name: "Owner Two", email: `${user2Id}@test.com`, emailVerified: true } }),
      prisma.toko.create({ data: { id: store1Id, name: "Store One", operationalMode: "WITH_INVENTORY" } }),
      prisma.toko.create({ data: { id: store2Id, name: "Store Two", operationalMode: "WITH_INVENTORY" } }),
      prisma.tokoUser.create({ data: { tokoId: store1Id, userId: user1Id, role: "OWNER" } }),
      prisma.tokoUser.create({ data: { tokoId: store2Id, userId: user2Id, role: "OWNER" } }),
      prisma.priceTier.create({ data: { id: regTierS1Id, tokoId: store1Id, name: "Regular", code: "REG", isDefault: true, sortOrder: 0 } }),
      prisma.priceTier.create({ data: { id: regTierS2Id, tokoId: store2Id, name: "Regular", code: "REG", isDefault: true, sortOrder: 0 } }),
    ])
  })

  after(async () => {
    if (prisma && EXTERNAL_DB) {
      const tokoIds = [store1Id, store2Id].filter(Boolean)
      const userIds = [user1Id, user2Id].filter(Boolean)
      await prisma.idempotencyRecord.deleteMany({ where: { tokoId: { in: tokoIds } } })
      await prisma.stockMovement.deleteMany({ where: { tokoId: { in: tokoIds } } })
      await prisma.order.deleteMany({ where: { tokoId: { in: tokoIds } } })
      await prisma.purchase.deleteMany({ where: { tokoId: { in: tokoIds } } })
      await prisma.newProduction.deleteMany({ where: { tokoId: { in: tokoIds } } })
      await prisma.item.deleteMany({ where: { tokoId: { in: tokoIds } } })
      await prisma.toko.deleteMany({ where: { id: { in: tokoIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
    if (prisma) { await prisma.$disconnect() }
    if (!EXTERNAL_DB && containerName) {
      try { execSync(`docker stop ${containerName} && docker rm ${containerName}`, { stdio: "pipe" }) } catch {}
    }
  })

  // ============= Finding 11: Domain service integration tests =============

  describe("Product optimistic concurrency", () => {
    it("rejects a stale edit without overwriting the committed product", async () => {
      const productId = await seedProduct(store1Id, "Concurrent Product")
      const original = await prisma.item.findUniqueOrThrow({ where: { id: productId } })

      const committed = await services.updateProductDetails(ctx1(), productId, {
        name: "First Update",
        categoryId: null,
        expectedUpdatedAt: original.updatedAt.toISOString(),
        prices: [{ priceTierId: regTierS1Id, price: "12000" }],
      })

      await assert.rejects(
        services.updateProductDetails(ctx1(), productId, {
          name: "Stale Update",
          categoryId: null,
          expectedUpdatedAt: original.updatedAt.toISOString(),
          prices: [{ priceTierId: regTierS1Id, price: "9000" }],
        }),
        /changed by another user/,
      )

      const persisted = await prisma.item.findUniqueOrThrow({
        where: { id: productId },
        include: { itemPrices: true },
      })
      assert.equal(persisted.name, committed.name)
      assert.equal(persisted.itemPrices[0]?.price.toString(), "12000")
    })
  })

  describe("Purchase via domain service", () => {
    it("creates purchase with lines, movements, balance, and weighted average", async () => {
      const matId = await seedMaterial(store1Id, "Flour50")
      const result = await services.createPurchase(ctx1(), {
        items: [{ itemId: matId, qty: "10", unit: "kg", unitPrice: "5000" }],
      }, {
        key: `purchase-create-${randomUUID().slice(0, 8)}`,
        payload: { items: [{ itemId: matId, qty: "10", unitPrice: "5000" }] },
      })

      assert.ok(result.id)
      assert.ok(result.lines.length >= 1)
      const line = result.lines[0]
      assert.ok(line.id, "Line must have real ID")
      assert.equal(line.itemId, matId)
      assert.equal(line.quantity, "10")
      assert.equal(line.unitCost, "5000")
      assert.equal(line.subtotal, "50000")

      const balance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: matId } })
      assert.equal(balance.quantity.toString(), "110")

      const avgCost = new Prisma.Decimal(balance.averageCost)
      assert.ok(avgCost.gt(450) && avgCost.lt(460), `Expected avgCost ~454.545, got ${avgCost}`)

      const movements = await prisma.stockMovement.findMany({ where: { itemId: matId } })
      assert.equal(movements.length, 1)
      assert.equal(movements[0].movementType, "PURCHASE")
    })

    it("idempotency replay returns identical DTO", async () => {
      const matId = await seedMaterial(store1Id, "Wheat25")
      const idemKey = `purchase-replay-${randomUUID().slice(0, 8)}`
      const idemPayload = { items: [{ itemId: matId, qty: "5", unitPrice: "3000" }] }

      const first = await services.createPurchase(ctx1(), {
        items: [{ itemId: matId, qty: "5", unit: "kg", unitPrice: "3000" }],
      }, { key: idemKey, payload: idemPayload })

      const replay = await services.createPurchase(ctx1(), {
        items: [{ itemId: matId, qty: "5", unit: "kg", unitPrice: "3000" }],
      }, { key: idemKey, payload: idemPayload })

      assert.deepStrictEqual(first, replay)

      const purchases = await prisma.purchase.findMany({ where: { tokoId: store1Id } })
      const matching = purchases.filter((p) => p.id === first.id)
      assert.equal(matching.length, 1)
    })

    it("tenant isolation: reject cross-store access", async () => {
      const matId = await seedMaterial(store1Id, "CrossFlour")
      await assert.rejects(
        services.createPurchase(ctx2(), { items: [{ itemId: matId, qty: "5", unit: "kg", unitPrice: "1000" }] }),
        /not found/i
      )
    })
  })

  describe("Production via domain service", () => {
    it("idempotent create returns DTO with real line IDs, replay returns identical DTO", async () => {
      const matId = await seedMaterial(store1Id, "Sugar99", "50")
      const prodId = await seedProduct(store1Id, "Candy99", "0")

      const idemKey = `prod-create-${randomUUID().slice(0, 8)}`
      const idemPayload = {
        bahanItems: [{ bahanId: matId, qtyUsed: "5" }],
        productItems: [{ productId: prodId, qtyProduced: "20" }],
      }

      const first = await services.createProduction(ctx1(), {
        bahanItems: [{ bahanId: matId, qtyUsed: "5" }],
        productItems: [{ productId: prodId, qtyProduced: "20" }],
      }, { key: idemKey, payload: idemPayload })

      assert.ok(first.lines.length >= 2)
      first.lines.forEach((l: { id: string }) => {
        assert.ok(l.id, "Line must have real ID")
        assert.ok(l.id.length > 0)
      })

      const replay = await services.createProduction(ctx1(), {
        bahanItems: [{ bahanId: matId, qtyUsed: "5" }],
        productItems: [{ productId: prodId, qtyProduced: "20" }],
      }, { key: idemKey, payload: idemPayload })

      assert.deepStrictEqual(first, replay)

      const movements = await prisma.stockMovement.findMany({
        where: { sourceId: first.id },
      })
      assert.equal(movements.length, 2)
    })
  })

  describe("Checkout via domain service", () => {
    it("ignores migrated order prefixes when allocating the next number", async () => {
      const prodId = await seedProduct(store1Id, "MigratedPrefix", "10")
      await prisma.order.create({
        data: {
          tokoId: store1Id,
          number: `SALE-SALE-${randomUUID()}`,
          source: "CASHIER",
          status: "COMPLETED",
          paymentStatus: "PAID",
          fulfillmentStatus: "FULFILLED",
          subtotal: 10000,
          total: 10000,
          paidAmount: 10000,
          tracksInventory: false,
          createdById: user1Id,
        },
      })

      const order = await services.checkoutOrder(ctx1(), {
        cart: [{ productId: prodId, quantity: 1 }],
        paymentMethod: "CASH",
      })

      assert.match(order.number, /^ORD-\d+$/)
      assert.notEqual(order.number, "ORD-0NaN")
    })

    it("allocates distinct numbers for simultaneous checkouts", async () => {
      const prodId = await seedProduct(store1Id, "ConcurrentCheckout", "10")
      const input = {
        cart: [{ productId: prodId, quantity: 1 }],
        paymentMethod: "CASH",
      }

      const [first, second] = await Promise.all([
        services.checkoutOrder(ctx1(), input),
        services.checkoutOrder(ctx1(), input),
      ])

      assert.notEqual(first.number, second.number)
      assert.match(first.number, /^ORD-\d+$/)
      assert.match(second.number, /^ORD-\d+$/)
    })

    it("creates order with real line IDs and stock movements with sourceLineId", async () => {
      const prodId = await seedProduct(store1Id, "Cookie2", "50")

      const result = await services.checkoutOrder(ctx1(), {
        cart: [{ productId: prodId, quantity: 2 }],
        paymentMethod: "CASH",
      }, {
        key: `checkout-${randomUUID().slice(0, 8)}`,
        payload: { cart: [{ productId: prodId, quantity: 2 }] },
      })

      assert.ok(result.id)
      assert.equal(result.status, "COMPLETED")
      assert.ok(result.lines.length >= 1)
      const line = result.lines[0]
      assert.ok(line.id, "OrderLine must have real ID")
      assert.ok(line.id.length > 0)

      const movements = await prisma.stockMovement.findMany({
        where: { sourceId: result.id, movementType: "SALE" },
      })
      assert.ok(movements.length >= 1)
      movements.forEach((m) => {
        assert.ok(m.sourceLineId, "Movement must have sourceLineId from order line")
      })
    })

    it("idempotency replay returns identical DTO", async () => {
      const prodId = await seedProduct(store1Id, "Chips50", "50")
      const idemKey = `checkout-replay-${randomUUID().slice(0, 8)}`
      const idemPayload = { cart: [{ productId: prodId, quantity: 1 }] }

      const first = await services.checkoutOrder(ctx1(), {
        cart: [{ productId: prodId, quantity: 1 }],
        paymentMethod: "CASH",
      }, { key: idemKey, payload: idemPayload })

      const replay = await services.checkoutOrder(ctx1(), {
        cart: [{ productId: prodId, quantity: 1 }],
        paymentMethod: "CASH",
      }, { key: idemKey, payload: idemPayload })

      assert.deepStrictEqual(first, replay)

      const orders = await prisma.order.findMany({ where: { tokoId: store1Id, status: "COMPLETED" } })
      const matching = orders.filter((o) => o.id === first.id)
      assert.equal(matching.length, 1)
    })
  })

  describe("Complete order via domain service", () => {
    it("posts inventory movements when completing a manual order", async () => {
      const prodId = await seedProduct(store1Id, "ManualComplete99", "30")

      const order = await services.createManualOrder(ctx1(), {
        customerName: "Test Customer",
        items: [{ productId: prodId, quantity: 3 }],
      }, {
        key: `manual-order-${randomUUID().slice(0, 8)}`,
        payload: { items: [{ productId: prodId, quantity: 3 }] },
      })

      assert.equal(order.status, "CONFIRMED")

      const completed = await services.completeOrder(ctx1(), order.id, {
        channel: "CASHIER",
        paymentMethod: "CASH",
      }, {
        key: `complete-${randomUUID().slice(0, 8)}`,
        payload: { orderId: order.id, channel: "CASHIER" },
      })

      assert.equal(completed.status, "COMPLETED")
      assert.ok(completed.postedAt)

      const balance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: prodId } })
      assert.equal(balance.quantity.toString(), "27")

      const movements = await prisma.stockMovement.findMany({
        where: { sourceId: order.id, movementType: "SALE" },
      })
      assert.ok(movements.length >= 1)
      movements.forEach((m) => assert.ok(m.sourceLineId))
    })

    it("rejects double completion (idempotent replay works)", async () => {
      const prodId = await seedProduct(store1Id, "NoDoubleComp", "50")

      const order = await services.createManualOrder(ctx1(), {
        items: [{ productId: prodId, quantity: 2 }],
      }, {
        key: `no-double-manual-${randomUUID().slice(0, 8)}`,
        payload: { items: [{ productId: prodId, quantity: 2 }] },
      })

      const idemKey = `complete-no-double-${randomUUID().slice(0, 8)}`
      await services.completeOrder(ctx1(), order.id, {
        channel: "CASHIER", paymentMethod: "CASH",
      }, { key: idemKey, payload: { orderId: order.id } })

      const replay = await services.completeOrder(ctx1(), order.id, {
        channel: "CASHIER", paymentMethod: "CASH",
      }, { key: idemKey, payload: { orderId: order.id } })

      assert.equal(replay.status, "COMPLETED")

      const movements = await prisma.stockMovement.findMany({
        where: { sourceId: order.id, movementType: "SALE" },
      })
      assert.equal(movements.length, order.lines.length,
        `Expected ${order.lines.length} SALE movements, got ${movements.length}`)
    })
  })

  describe("Cancel order via domain service", () => {
    it("reverses posted order and links reversalOfId to original movement", async () => {
      const prodId = await seedProduct(store1Id, "CancelMe99", "50")

      const order = await services.checkoutOrder(ctx1(), {
        cart: [{ productId: prodId, quantity: 3 }],
        paymentMethod: "CASH",
      }, {
        key: `cancel-checkout-${randomUUID().slice(0, 8)}`,
        payload: { cart: [{ productId: prodId, quantity: 3 }] },
      })

      const cancelled = await services.cancelOrder(ctx1(), order.id, {
        key: `cancel-${randomUUID().slice(0, 8)}`,
        payload: { orderId: order.id },
      })

      assert.equal(cancelled.status, "CANCELLED")
      assert.ok(cancelled.cancelledAt)

      const reversals = await prisma.stockMovement.findMany({
        where: { sourceId: order.id, movementType: "REVERSAL" },
      })
      assert.ok(reversals.length >= 1, "Reversal movements must exist")
      reversals.forEach((r) => {
        assert.ok(r.reversalOfId, `Reversal ${r.id} must have reversalOfId`)
      })

      const balance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: prodId } })
      assert.equal(balance.quantity.toString(), "50")
    })

    it("idempotent replay of cancel does not double-reverse", async () => {
      const prodId = await seedProduct(store1Id, "NoDoubleCancel", "50")

      const order = await services.checkoutOrder(ctx1(), {
        cart: [{ productId: prodId, quantity: 2 }],
        paymentMethod: "CASH",
      }, {
        key: `ndc-checkout-${randomUUID().slice(0, 8)}`,
        payload: { cart: [{ productId: prodId, quantity: 2 }] },
      })

      const idemKey = `ndc-cancel-${randomUUID().slice(0, 8)}`
      await services.cancelOrder(ctx1(), order.id, { key: idemKey, payload: { orderId: order.id } })

      const replay = await services.cancelOrder(ctx1(), order.id, { key: idemKey, payload: { orderId: order.id } })
      assert.equal(replay.status, "CANCELLED")

      const reversals = await prisma.stockMovement.findMany({
        where: { sourceId: order.id, movementType: "REVERSAL" },
      })
      const sales = await prisma.stockMovement.findMany({
        where: { sourceId: order.id, movementType: "SALE" },
      })
      assert.equal(reversals.length, sales.length,
        `Reversals (${reversals.length}) should equal sales (${sales.length})`)

      const balance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: prodId } })
      assert.equal(balance.quantity.toString(), "50")
    })
  })

  describe("Adjustment via domain service", () => {
    it("creates adjustment and returns proper DTO", async () => {
      const matId = await seedMaterial(store1Id, "AdjMat99", "50")

      const idemKey = `adj-${randomUUID().slice(0, 8)}`
      const result = await services.postAdjustment(ctx1(), {
        itemId: matId, quantity: "-5", reason: "Spoilage",
      }, { key: idemKey, payload: { itemId: matId, quantity: "-5", reason: "Spoilage" } })

      assert.ok(result.id)
      assert.equal(result.movementType, "ADJUSTMENT")
      assert.equal(result.direction, "OUT")

      const replay = await services.postAdjustment(ctx1(), {
        itemId: matId, quantity: "-5", reason: "Spoilage",
      }, { key: idemKey, payload: { itemId: matId, quantity: "-5", reason: "Spoilage" } })

      assert.deepStrictEqual(result, replay)

      const balance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: matId } })
      assert.equal(balance.quantity.toString(), "45")
    })
  })

  describe("Idempotency payload conflict", () => {
    it("changed payload with same key causes IdempotencyConflictError", async () => {
      const matId = await seedMaterial(store1Id, "IdemConflict", "100")

      const idemKey = `idem-cfl-${randomUUID().slice(0, 8)}`
      await services.createPurchase(ctx1(), {
        items: [{ itemId: matId, qty: "1", unit: "kg", unitPrice: "1000" }],
      }, { key: idemKey, payload: { items: [{ itemId: matId, qty: "1", unitPrice: "1000" }] } })

      await assert.rejects(
        services.createPurchase(ctx1(), {
          items: [{ itemId: matId, qty: "2", unit: "kg", unitPrice: "1000" }],
        }, { key: idemKey, payload: { items: [{ itemId: matId, qty: "2", unitPrice: "1000" }] } }),
        /IdempotencyConflictError|idempotency/i
      )

      const purchases = await prisma.purchase.findMany({ where: { tokoId: store1Id } })
      assert.ok(purchases.length >= 1)
    })
  })

  describe("Concurrent oversell prevention", () => {
    it("allows only one of two simultaneous sales when combined demand exceeds stock", async () => {
      const prodId = await seedProduct(store1Id, "RareItem", "5")

      const results = await Promise.allSettled([
        services.checkoutOrder(ctx1(), {
          cart: [{ productId: prodId, quantity: 4 }],
          paymentMethod: "CASH",
        }, {
          key: `rare-a-${randomUUID().slice(0, 8)}`,
          payload: { cart: [{ productId: prodId, quantity: 4 }] },
        }),
        services.checkoutOrder(ctx1(), {
          cart: [{ productId: prodId, quantity: 4 }],
          paymentMethod: "CASH",
        }, {
          key: `rare-b-${randomUUID().slice(0, 8)}`,
          payload: { cart: [{ productId: prodId, quantity: 4 }] },
        }),
      ])

      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
      assert.equal(results.filter((result) => result.status === "rejected").length, 1)

      const balance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: prodId } })
      assert.equal(balance.quantity.toString(), "1")
    })
  })

  describe("Weighted average under concurrent purchases", () => {
    it("serializable transaction protects weighted average calculation", async () => {
      const matId = await seedMaterial(store1Id, "WacMat99", "0")

      await Promise.all([
        services.createPurchase(ctx1(), {
          items: [{ itemId: matId, qty: "10", unit: "kg", unitPrice: "1000" }],
        }, {
          key: `wac-a-${randomUUID().slice(0, 8)}`,
          payload: { items: [{ itemId: matId, qty: "10", unitPrice: "1000" }] },
        }),
        services.createPurchase(ctx1(), {
          items: [{ itemId: matId, qty: "20", unit: "kg", unitPrice: "2000" }],
        }, {
          key: `wac-b-${randomUUID().slice(0, 8)}`,
          payload: { items: [{ itemId: matId, qty: "20", unitPrice: "2000" }] },
        }),
      ])

      const balance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: matId } })
      assert.equal(balance.quantity.toString(), "30")
      const avg = new Prisma.Decimal(balance.averageCost)
      assert.ok(avg.gt(1660) && avg.lt(1670), `Expected avgCost ~1666.667, got ${avg}`)
    })
  })

  describe("Ledger equals balance", () => {
    it("fresh item has matching ledger and balance", async () => {
      const matId = await seedMaterial(store1Id, "LedgerMat99", "5")
      // Create matching opening movement so ledger = balance
      await prisma.stockMovement.create({
        data: {
          tokoId: store1Id, itemId: matId, quantity: new Prisma.Decimal(5),
          movementType: "OPENING_BALANCE", sourceType: "Test", sourceId: matId,
          dedupeKey: `OPENING_LEDGER_${matId}`, createdById: "test",
        },
      })

      const [row] = await prisma.$queryRawUnsafe<Array<{ b: string; m: string }>>(
        `SELECT sb.quantity::text AS b, COALESCE(SUM(sm.quantity), 0)::text AS m
         FROM "StockBalance" sb
         LEFT JOIN "StockMovement" sm ON sm."itemId" = sb."itemId"
         WHERE sb."itemId" = $1
         GROUP BY sb."itemId", sb.quantity`,
        matId
      )
      assert.equal(Number(row.b), Number(row.m), `Balance ${row.b} != ledger ${row.m}`)
    })
  })

  describe("Operational modes", () => {
    it("preserves CASHIER_ONLY, SIMPLE_INVENTORY, and WITH_INVENTORY behavior", async () => {
      try {
        await prisma.toko.update({ where: { id: store1Id }, data: { operationalMode: "CASHIER_ONLY" } })
        const cashierProductId = await seedProduct(store1Id, "CashierOnlyMode", "1")

        const checkout = await services.checkoutOrder(ctx1(), {
          cart: [{ productId: cashierProductId, quantity: 5 }],
          paymentMethod: "CASH",
        })
        assert.equal(checkout.tracksInventory, false)

        const manualOrder = await services.createManualOrder(ctx1(), {
          items: [{ productId: cashierProductId, quantity: 4 }],
        })
        const completed = await services.completeOrder(ctx1(), manualOrder.id, {
          channel: "CASHIER",
          paymentMethod: "CASH",
        })
        assert.equal(completed.tracksInventory, false)

        const cashierBalance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: cashierProductId } })
        assert.equal(cashierBalance.quantity.toString(), "1")
        assert.equal(await prisma.stockMovement.count({
          where: { sourceId: { in: [checkout.id, manualOrder.id] }, movementType: "SALE" },
        }), 0)

        await prisma.toko.update({ where: { id: store1Id }, data: { operationalMode: "SIMPLE_INVENTORY" } })
        const simplePurchase = await services.createPurchase(ctx1(), { totalAmount: "25000" })
        assert.equal(simplePurchase.lines.length, 0)
        assert.equal(simplePurchase.totalAmount, "25000")

        const simpleProductId = await seedProduct(store1Id, "SimpleModeProduct", "0")
        const production = await services.createProduction(ctx1(), {
          bahanItems: [],
          productItems: [{ productId: simpleProductId, qtyProduced: "4" }],
        })
        assert.equal(production.lines.filter((line: { lineType: string }) => line.lineType === "INPUT").length, 0)
        assert.equal(production.lines.filter((line: { lineType: string }) => line.lineType === "OUTPUT").length, 1)

        const simpleCheckout = await services.checkoutOrder(ctx1(), {
          cart: [{ productId: simpleProductId, quantity: 2 }],
          paymentMethod: "CASH",
        })
        assert.equal(simpleCheckout.tracksInventory, true)
        const simpleBalance = await prisma.stockBalance.findUniqueOrThrow({ where: { itemId: simpleProductId } })
        assert.equal(simpleBalance.quantity.toString(), "2")
        assert.equal(await prisma.stockMovement.count({
          where: { sourceId: simpleCheckout.id, movementType: "SALE" },
        }), 1)

        await prisma.toko.update({ where: { id: store1Id }, data: { operationalMode: "WITH_INVENTORY" } })
        await assert.rejects(
          services.createProduction(ctx1(), {
            bahanItems: [],
            productItems: [{ productId: simpleProductId, qtyProduced: "1" }],
          }),
          /at least one material/i,
        )
      } finally {
        await prisma.toko.update({ where: { id: store1Id }, data: { operationalMode: "WITH_INVENTORY" } })
      }
    })
  })
}
