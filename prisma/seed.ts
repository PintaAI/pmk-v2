import 'dotenv/config'
import { PrismaClient } from "../generated/prisma/client"
import { PrismaNeon } from '@prisma/adapter-neon'
import { hashPassword } from 'better-auth/crypto'
import { getUnitConfig, toBaseQty, toBaseUnitPrice } from '../lib/units'

const adapter = new PrismaNeon({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

const BAHAN = [
  { name: "Ikan Tenggiri", unit: "kg", currentQty: 50, averageCost: 55000 },
  { name: "Tepung Tapioka", unit: "kg", currentQty: 200, averageCost: 12000 },
  { name: "Telur", unit: "butir", currentQty: 500, averageCost: 2500 },
  { name: "Garam", unit: "kg", currentQty: 30, averageCost: 5000 },
  { name: "Gula Pasir", unit: "kg", currentQty: 25, averageCost: 14000 },
  { name: "Air", unit: "liter", currentQty: 100, averageCost: 0 },
  { name: "Minyak Goreng", unit: "liter", currentQty: 60, averageCost: 18000 },
  { name: "Bawang Putih", unit: "kg", currentQty: 10, averageCost: 35000 },
  { name: "Penyedap Rasa", unit: "kg", currentQty: 5, averageCost: 25000 },
  { name: "Cuka", unit: "liter", currentQty: 8, averageCost: 8000 },
  { name: "Gula Merah", unit: "kg", currentQty: 15, averageCost: 18000 },
  { name: "Cabai Merah", unit: "kg", currentQty: 8, averageCost: 40000 },
  { name: "Kacang Tanah", unit: "kg", currentQty: 20, averageCost: 28000 },
  { name: "Daun Bawang", unit: "ikat", currentQty: 10, averageCost: 5000 },
] as const

const PRICE_TIERS = [
  { name: "Default", code: "default", sortOrder: 0, isDefault: true },
  { name: "Reseller", code: "reseller", sortOrder: 1, isDefault: false },
  { name: "Online", code: "online", sortOrder: 2, isDefault: false },
] as const

const PRODUCTS = [
  {
    name: "Pempek Kapal Selam",
    prices: { default: 15000, reseller: 12000, online: 18000 },
    currentQty: 30,
    isActive: true,
  },
  {
    name: "Pempek Lenjer",
    prices: { default: 10000, reseller: 8000, online: 13000 },
    currentQty: 50,
    isActive: true,
  },
  {
    name: "Pempek Adaan",
    prices: { default: 12000, reseller: 9500, online: 15000 },
    currentQty: 40,
    isActive: true,
  },
  {
    name: "Pempek Kulit",
    prices: { default: 10000, reseller: 8000, online: 13000 },
    currentQty: 35,
    isActive: true,
  },
  {
    name: "Pempek Tahu",
    prices: { default: 8000, reseller: 6000, online: 10000 },
    currentQty: 25,
    isActive: true,
  },
  {
    name: "Pempek Pistel",
    prices: { default: 8000, reseller: 6000, online: 10000 },
    currentQty: 20,
    isActive: true,
  },
  {
    name: "Pempek Telur Kecil",
    prices: { default: 7000, reseller: 5500, online: 9000 },
    currentQty: 45,
    isActive: true,
  },
  {
    name: "Pempek Keriting",
    prices: { default: 12000, reseller: 9500, online: 15000 },
    currentQty: 30,
    isActive: true,
  },
] as const

const PRODUCTION_RECIPES: Array<{
  productName: string
  qtyProduced: number
  ingredients: Array<{ bahanName: string; qtyUsed: number }>
}> = [
  {
    productName: "Pempek Kapal Selam",
    qtyProduced: 10,
    ingredients: [
      { bahanName: "Ikan Tenggiri", qtyUsed: 2.5 },
      { bahanName: "Tepung Tapioka", qtyUsed: 1.5 },
      { bahanName: "Telur", qtyUsed: 12 },
      { bahanName: "Garam", qtyUsed: 0.1 },
      { bahanName: "Penyedap Rasa", qtyUsed: 0.05 },
      { bahanName: "Air", qtyUsed: 0.5 },
    ],
  },
  {
    productName: "Pempek Lenjer",
    qtyProduced: 20,
    ingredients: [
      { bahanName: "Ikan Tenggiri", qtyUsed: 2 },
      { bahanName: "Tepung Tapioka", qtyUsed: 2.5 },
      { bahanName: "Garam", qtyUsed: 0.1 },
      { bahanName: "Penyedap Rasa", qtyUsed: 0.05 },
      { bahanName: "Air", qtyUsed: 1 },
    ],
  },
  {
    productName: "Pempek Adaan",
    qtyProduced: 20,
    ingredients: [
      { bahanName: "Ikan Tenggiri", qtyUsed: 2 },
      { bahanName: "Tepung Tapioka", qtyUsed: 1.5 },
      { bahanName: "Telur", qtyUsed: 6 },
      { bahanName: "Garam", qtyUsed: 0.08 },
      { bahanName: "Penyedap Rasa", qtyUsed: 0.04 },
      { bahanName: "Air", qtyUsed: 0.3 },
    ],
  },
  {
    productName: "Pempek Kulit",
    qtyProduced: 15,
    ingredients: [
      { bahanName: "Ikan Tenggiri", qtyUsed: 1.5 },
      { bahanName: "Tepung Tapioka", qtyUsed: 2 },
      { bahanName: "Garam", qtyUsed: 0.08 },
      { bahanName: "Penyedap Rasa", qtyUsed: 0.04 },
      { bahanName: "Air", qtyUsed: 0.5 },
    ],
  },
  {
    productName: "Pempek Tahu",
    qtyProduced: 20,
    ingredients: [
      { bahanName: "Ikan Tenggiri", qtyUsed: 1.5 },
      { bahanName: "Tepung Tapioka", qtyUsed: 1 },
      { bahanName: "Telur", qtyUsed: 5 },
      { bahanName: "Garam", qtyUsed: 0.06 },
      { bahanName: "Penyedap Rasa", qtyUsed: 0.03 },
      { bahanName: "Air", qtyUsed: 0.3 },
    ],
  },
]

const BELANJA_DATA = [
  {
    supplier: "PT Samudra Indah",
    dateOffset: 30,
    items: [
      { bahanName: "Ikan Tenggiri", qty: 30, unitPrice: 52000 },
      { bahanName: "Minyak Goreng", qty: 25, unitPrice: 17500 },
    ],
  },
  {
    supplier: "Toko Sembako Jaya",
    dateOffset: 25,
    items: [
      { bahanName: "Tepung Tapioka", qty: 100, unitPrice: 11500 },
      { bahanName: "Garam", qty: 20, unitPrice: 4500 },
      { bahanName: "Gula Pasir", qty: 15, unitPrice: 13500 },
      { bahanName: "Minyak Goreng", qty: 20, unitPrice: 17500 },
    ],
  },
  {
    supplier: "Peternakan Sumber Rezeki",
    dateOffset: 20,
    items: [
      { bahanName: "Telur", qty: 300, unitPrice: 2300 },
    ],
  },
  {
    supplier: "Toko Sembako Jaya",
    dateOffset: 15,
    items: [
      { bahanName: "Bawang Putih", qty: 5, unitPrice: 33000 },
      { bahanName: "Kacang Tanah", qty: 15, unitPrice: 27000 },
      { bahanName: "Gula Merah", qty: 10, unitPrice: 17000 },
      { bahanName: "Cabai Merah", qty: 5, unitPrice: 38000 },
      { bahanName: "Cuka", qty: 5, unitPrice: 7500 },
    ],
  },
  {
    supplier: "PT Samudra Indah",
    dateOffset: 10,
    items: [
      { bahanName: "Ikan Tenggiri", qty: 25, unitPrice: 55000 },
    ],
  },
  {
    supplier: "Peternakan Sumber Rezeki",
    dateOffset: 7,
    items: [
      { bahanName: "Telur", qty: 200, unitPrice: 2500 },
    ],
  },
  {
    supplier: "Toko Sembako Jaya",
    dateOffset: 3,
    items: [
      { bahanName: "Tepung Tapioka", qty: 50, unitPrice: 12000 },
      { bahanName: "Minyak Goreng", qty: 15, unitPrice: 18000 },
      { bahanName: "Daun Bawang", qty: 10, unitPrice: 5000 },
    ],
  },
]

const SALES_DATA = [
  {
    channel: "CASHIER" as const,
    customerName: null,
    dateOffset: 14,
    items: [
      { productName: "Pempek Kapal Selam", qty: 5, priceTierCode: "default" as const },
      { productName: "Pempek Lenjer", qty: 10, priceTierCode: "default" as const },
      { productName: "Pempek Adaan", qty: 8, priceTierCode: "default" as const },
    ],
  },
  {
    channel: "RESELLER" as const,
    customerName: "Ayu Catering",
    dateOffset: 10,
    items: [
      { productName: "Pempek Lenjer", qty: 25, priceTierCode: "reseller" as const },
      { productName: "Pempek Kulit", qty: 15, priceTierCode: "reseller" as const },
      { productName: "Pempek Telur Kecil", qty: 30, priceTierCode: "reseller" as const },
    ],
  },
  {
    channel: "ONLINE" as const,
    customerName: "Budi (GoFood)",
    dateOffset: 7,
    items: [
      { productName: "Pempek Kapal Selam", qty: 3, priceTierCode: "online" as const },
      { productName: "Pempek Keriting", qty: 4, priceTierCode: "online" as const },
    ],
  },
  {
    channel: "CASHIER" as const,
    customerName: null,
    dateOffset: 4,
    items: [
      { productName: "Pempek Tahu", qty: 6, priceTierCode: "default" as const },
      { productName: "Pempek Pistel", qty: 5, priceTierCode: "default" as const },
      { productName: "Pempek Adaan", qty: 4, priceTierCode: "default" as const },
    ],
  },
  {
    channel: "RESELLER" as const,
    customerName: "Dewi Snack",
    dateOffset: 2,
    items: [
      { productName: "Pempek Kapal Selam", qty: 10, priceTierCode: "reseller" as const },
      { productName: "Pempek Keriting", qty: 8, priceTierCode: "reseller" as const },
    ],
  },
]

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0)
  return d
}

async function main() {
  console.log("Seeding database...\n")

  // Clean existing data (order matters for FK constraints)
  console.log("Cleaning existing data...")
  await prisma.inventoryMovement.deleteMany()
  await prisma.activityLog.deleteMany()
  await prisma.saleItem.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.productionProduct.deleteMany()
  await prisma.productionBahan.deleteMany()
  await prisma.production.deleteMany()
  await prisma.belanjaItem.deleteMany()
  await prisma.belanja.deleteMany()
  await prisma.productPrice.deleteMany()
  await prisma.product.deleteMany()
  await prisma.priceTier.deleteMany()
  await prisma.bahan.deleteMany()
  await prisma.tokoUser.deleteMany()
  await prisma.toko.deleteMany()
  await prisma.account.deleteMany()
  await prisma.session.deleteMany()
  await prisma.verification.deleteMany()
  await prisma.user.deleteMany()

  // Create dummy user (needed for all createdById references)
  console.log("Creating dummy user...")
  const password = await hashPassword("password123")
  const user = await prisma.user.create({
    data: {
      id: "seed-user",
      name: "Admin Warung",
      email: "admin@warungpempek.test",
      emailVerified: true,
      accounts: {
        create: {
          id: "seed-account",
          accountId: "seed-user",
          providerId: "credential",
          password,
        },
      },
    },
  })
  console.log(`  User: ${user.name} (${user.email})`)
  console.log(`  Password: password123\n`)

  // Create dummy toko
  console.log("Creating dummy toko...")
  const toko = await prisma.toko.create({
    data: { name: "Warung Pempek" },
  })
  await prisma.tokoUser.create({
    data: {
      tokoId: toko.id,
      userId: user.id,
      role: "OWNER",
    },
  })
  const SEED_TOKO_ID = toko.id
  console.log(`  Toko: ${toko.name}\n`)

  // Seed price tiers
  console.log("Seeding price tiers...")
  const priceTierMap = new Map<string, { id: string; name: string; code: string }>()
  for (const item of PRICE_TIERS) {
    const tier = await prisma.priceTier.create({
      data: { ...item, tokoId: SEED_TOKO_ID },
      select: { id: true, name: true, code: true },
    })
    priceTierMap.set(tier.code, tier)
    console.log(`  ${tier.name} (${tier.code})`)
  }
  console.log("")

  // Seed Bahan
  console.log("Seeding bahan...")
  const bahanMap = new Map<string, string>()
  const bahanUnitMap = new Map<string, string>()
  for (const b of BAHAN) {
    const unit = getUnitConfig(b.unit)
    const bahan = await prisma.bahan.create({
      data: {
        tokoId: SEED_TOKO_ID,
        name: b.name,
        unit: unit.unit,
        unitKind: unit.unitKind,
        baseUnit: unit.baseUnit,
        currentQty: toBaseQty(b.currentQty, unit.unit),
        averageCost: toBaseUnitPrice(b.averageCost, unit.unit),
      },
    })
    bahanMap.set(b.name, bahan.id)
    bahanUnitMap.set(b.name, unit.unit)
    await prisma.activityLog.create({
      data: {
        tokoId: SEED_TOKO_ID,
        actorId: user.id,
        action: "created_bahan",
        entityType: "Bahan",
        entityId: bahan.id,
        createdAt: daysAgo(35 + Math.floor(Math.random() * 5)),
      },
    })
    console.log(`  ${bahan.name} — ${bahan.currentQty} ${bahan.unit} @ Rp${bahan.averageCost}`)
  }

  // Seed Products
  console.log("\nSeeding products...")
  const productMap = new Map<string, string>()
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        tokoId: SEED_TOKO_ID,
        name: p.name,
        currentQty: p.currentQty,
        isActive: p.isActive,
        prices: {
          create: PRICE_TIERS.map((tier) => ({
            priceTierId: priceTierMap.get(tier.code)!.id,
            price: p.prices[tier.code],
          })),
        },
      },
    })
    productMap.set(p.name, product.id)
    await prisma.activityLog.create({
      data: {
        tokoId: SEED_TOKO_ID,
        actorId: user.id,
        action: "created_product",
        entityType: "Product",
        entityId: product.id,
        createdAt: daysAgo(35 + Math.floor(Math.random() * 5)),
      },
    })
    console.log(`  ${product.name} — Rp${p.prices.default} (stok: ${product.currentQty})`)
  }

  // Seed Belanja (purchases) with items and inventory movements
  console.log("\nSeeding belanja transactions...")
  for (const belanja of BELANJA_DATA) {
    const date = daysAgo(belanja.dateOffset)
    const items = belanja.items.map((item) => ({
      bahanId: bahanMap.get(item.bahanName)!,
      qty: toBaseQty(item.qty, bahanUnitMap.get(item.bahanName)!),
      unitPrice: toBaseUnitPrice(item.unitPrice, bahanUnitMap.get(item.bahanName)!),
      subtotal: item.qty * item.unitPrice,
    }))
    const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0)

    const record = await prisma.belanja.create({
      data: {
        tokoId: SEED_TOKO_ID,
        date,
        supplier: belanja.supplier,
        status: "COMPLETED",
        totalAmount,
        createdById: user.id,
        items: {
          create: items,
        },
      },
      include: { items: true },
    })

    // Update stok bahan and create movements
    for (const item of record.items) {
      await prisma.bahan.update({
        where: { id: item.bahanId },
        data: { currentQty: { increment: item.qty } },
      })
      await prisma.inventoryMovement.create({
        data: {
          tokoId: SEED_TOKO_ID,
          itemType: "BAHAN",
          bahanId: item.bahanId,
          movementType: "BAHAN_PURCHASE",
          direction: "IN",
          qty: item.qty,
          unitCost: item.unitPrice,
          referenceType: "BELANJA",
          referenceId: record.id,
          createdById: user.id,
          createdAt: date,
        },
      })
    }

    await prisma.activityLog.create({
      data: {
        tokoId: SEED_TOKO_ID,
        actorId: user.id,
        action: "created_belanja",
        entityType: "Belanja",
        entityId: record.id,
        metadata: {
          totalAmount: totalAmount.toString(),
          itemsCount: items.length,
        },
        createdAt: date,
      },
    })
    console.log(`  ${record.supplier} — ${items.length} item, Rp${totalAmount.toLocaleString("id-ID")} (${date.toLocaleDateString("id-ID")})`)
  }

  // Seed Production runs
  console.log("\nSeeding production runs...")
  for (let run = 0; run < 4; run++) {
    const date = daysAgo(20 - run * 5)
    const recipes = PRODUCTION_RECIPES.slice(run % 2 === 0 ? 0 : 2, run % 2 === 0 ? 3 : 5)

    for (const recipe of recipes) {
      const production = await prisma.production.create({
        data: {
          tokoId: SEED_TOKO_ID,
          date,
          note: `Produksi ${recipe.productName} — batch ${run + 1}`,
          status: "COMPLETED",
          createdById: user.id,
        },
      })

      // Create bahan usage
      for (const ing of recipe.ingredients) {
        const bahanId = bahanMap.get(ing.bahanName)!
        const qtyUsed = toBaseQty(ing.qtyUsed, bahanUnitMap.get(ing.bahanName)!)
        await prisma.productionBahan.create({
          data: {
            productionId: production.id,
            bahanId,
            qtyUsed,
          },
        })
        // Decrease stock
        await prisma.bahan.update({
          where: { id: bahanId },
          data: { currentQty: { decrement: qtyUsed } },
        })
        await prisma.inventoryMovement.create({
          data: {
            tokoId: SEED_TOKO_ID,
            itemType: "BAHAN",
            bahanId,
            movementType: "BAHAN_PRODUCTION_USAGE",
            direction: "OUT",
            qty: qtyUsed,
            referenceType: "PRODUCTION",
            referenceId: production.id,
            createdById: user.id,
            createdAt: date,
          },
        })
      }

      // Create product output
      const productId = productMap.get(recipe.productName)!
      await prisma.productionProduct.create({
        data: {
          productionId: production.id,
          productId,
          qtyProduced: recipe.qtyProduced,
        },
      })
      await prisma.product.update({
        where: { id: productId },
        data: { currentQty: { increment: recipe.qtyProduced } },
      })
      await prisma.inventoryMovement.create({
        data: {
          tokoId: SEED_TOKO_ID,
          itemType: "PRODUCT",
          productId,
          movementType: "PRODUCT_PRODUCTION_OUTPUT",
          direction: "IN",
          qty: recipe.qtyProduced,
          referenceType: "PRODUCTION",
          referenceId: production.id,
          createdById: user.id,
          createdAt: date,
        },
      })

      await prisma.activityLog.create({
        data: {
          tokoId: SEED_TOKO_ID,
          actorId: user.id,
          action: "created_production",
          entityType: "Production",
          entityId: production.id,
          metadata: {
            bahanItemsCount: recipe.ingredients.length,
            productItemsCount: 1,
            qtyProduced: recipe.qtyProduced.toString(),
          },
          createdAt: date,
        },
      })
      console.log(`  ${recipe.productName} — ${recipe.qtyProduced} pcs (${date.toLocaleDateString("id-ID")})`)
    }
  }

  // Seed Sales
  console.log("\nSeeding sales...")
  for (const sale of SALES_DATA) {
    const date = daysAgo(sale.dateOffset)
    const items = sale.items.map((item) => {
      const product = PRODUCTS.find((p) => p.name === item.productName)!
      const tier = priceTierMap.get(item.priceTierCode)!
      const unitPrice = product.prices[item.priceTierCode]
      return {
        productId: productMap.get(item.productName)!,
        priceTierId: tier.id,
        priceTierCode: tier.code,
        priceTierName: tier.name,
        qty: item.qty,
        unitPrice,
        subtotal: item.qty * unitPrice,
      }
    })
    const totalAmount = items.reduce((sum, i) => sum + i.subtotal, 0)
    const invoiceNumber = `INV-${date.getTime().toString(36).toUpperCase()}-${sale.channel.slice(0, 3)}`

    const record = await prisma.sale.create({
      data: {
        tokoId: SEED_TOKO_ID,
        invoiceNumber,
        date,
        channel: sale.channel,
        customerName: sale.customerName,
        status: "COMPLETED",
        totalAmount,
        paidAmount: totalAmount,
        createdById: user.id,
        items: { create: items },
      },
      include: { items: true },
    })

    for (const item of record.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { currentQty: { decrement: item.qty } },
      })
      await prisma.inventoryMovement.create({
        data: {
          tokoId: SEED_TOKO_ID,
          itemType: "PRODUCT",
          productId: item.productId,
          movementType: "PRODUCT_SALE",
          direction: "OUT",
          qty: item.qty,
          unitPrice: item.unitPrice,
          referenceType: "SALE",
          referenceId: record.id,
          createdById: user.id,
          createdAt: date,
        },
      })
    }

    await prisma.activityLog.create({
      data: {
        tokoId: SEED_TOKO_ID,
        actorId: user.id,
        action: "created_sale",
        entityType: "Sale",
        entityId: record.id,
        metadata: {
          invoiceNumber,
          channel: sale.channel,
          totalAmount: totalAmount.toString(),
          itemsCount: items.length,
        },
        createdAt: date,
      },
    })
    console.log(`  ${record.invoiceNumber} — ${sale.channel}${sale.customerName ? ` (${sale.customerName})` : ""}, Rp${totalAmount.toLocaleString("id-ID")}`)
  }

  console.log("\nSeeding complete!")
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
