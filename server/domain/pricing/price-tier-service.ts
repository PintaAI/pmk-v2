import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/server/domain/types"
import { ValidationError, NotFoundError, ForbiddenError } from "@/server/domain/errors"

export type PriceTierDTO = {
  id: string
  name: string
  code: string
  sortOrder: number
  isDefault: boolean
  isActive: boolean
  productCount: number
}

export async function listPriceTiers(ctx: AuthContext): Promise<PriceTierDTO[]> {
  const tiers = await prisma.priceTier.findMany({
    where: { tokoId: ctx.tokoId },
    include: { _count: { select: { productPrices: true, itemPrices: true } } },
    orderBy: { sortOrder: "asc" },
  })

  return tiers.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    sortOrder: t.sortOrder,
    isDefault: t.isDefault,
    isActive: t.isActive,
    productCount: t._count.productPrices + t._count.itemPrices,
  }))
}

export async function createPriceTier(ctx: AuthContext, name: string): Promise<PriceTierDTO> {
  if (ctx.role !== "OWNER") throw new ForbiddenError("Owner access required")

  if (!name.trim()) throw new ValidationError("Price tier name is required")

  const count = await prisma.priceTier.count({ where: { tokoId: ctx.tokoId } })
  let code = slugify(name) || "price-tier"
  let suffix = 2

  while (await prisma.priceTier.findFirst({ where: { tokoId: ctx.tokoId, code }, select: { id: true } })) {
    code = `${slugify(name)}-${suffix}`
    suffix++
  }

  const tier = await prisma.$transaction(async (tx) => {
    const created = await tx.priceTier.create({
      data: { tokoId: ctx.tokoId, name: name.trim(), code, sortOrder: count, isDefault: count === 0 },
    })

    const items = await tx.item.findMany({ where: { tokoId: ctx.tokoId, type: "PRODUCT" }, select: { id: true } })
    if (items.length > 0) {
      await tx.itemPrice.createMany({ data: items.map((item) => ({ itemId: item.id, priceTierId: created.id, price: 0 })) })
    }

    const products = await tx.product.findMany({ where: { tokoId: ctx.tokoId }, select: { id: true } })
    if (products.length > 0) {
      await tx.productPrice.createMany({ data: products.map((p) => ({ productId: p.id, priceTierId: created.id, price: 0 })) })
    }

    await tx.activityLog.create({
      data: { tokoId: ctx.tokoId, actorId: ctx.actorId, action: "created_price_tier", entityType: "PriceTier", entityId: created.id },
    })

    return created
  })

  return { id: tier.id, name: tier.name, code: tier.code, sortOrder: tier.sortOrder, isDefault: tier.isDefault, isActive: tier.isActive, productCount: 0 }
}

export async function deletePriceTier(ctx: AuthContext, tierId: string): Promise<void> {
  if (ctx.role !== "OWNER") throw new ForbiddenError("Owner access required")

  const tier = await prisma.priceTier.findFirst({
    where: { id: tierId, tokoId: ctx.tokoId },
    select: { id: true, isDefault: true, sortOrder: true },
  })
  if (!tier) throw new NotFoundError("Price tier not found")

  const remainingTier = tier.isDefault
    ? await prisma.priceTier.findFirst({
        where: { tokoId: ctx.tokoId, id: { not: tierId } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      })
    : null

  await prisma.$transaction(async (tx) => {
    if (remainingTier) {
      await tx.priceTier.update({ where: { id: remainingTier.id }, data: { isDefault: true, sortOrder: tier.sortOrder } })
    }
    await tx.productPrice.deleteMany({ where: { priceTierId: tierId } })
    await tx.itemPrice.deleteMany({ where: { priceTierId: tierId } })
    await tx.saleItem.updateMany({ where: { priceTierId: tierId }, data: { priceTierId: null } })
    await tx.orderLine.updateMany({ where: { priceTierId: tierId }, data: { priceTierId: null } })
    await tx.priceTier.delete({ where: { id: tierId } })
    await tx.priceTier.updateMany({
      where: { tokoId: ctx.tokoId, sortOrder: { gt: tier.sortOrder } },
      data: { sortOrder: { decrement: 1 } },
    })
    await tx.activityLog.create({
      data: { tokoId: ctx.tokoId, actorId: ctx.actorId, action: "removed_price_tier", entityType: "PriceTier", entityId: tierId },
    })
  })
}

export async function adjustTierPrices(ctx: AuthContext, tierId: string, percentage: number): Promise<{ updated: number }> {
  if (ctx.role !== "OWNER") throw new ForbiddenError("Owner access required")

  const tier = await prisma.priceTier.findFirst({ where: { id: tierId, tokoId: ctx.tokoId }, select: { id: true } })
  if (!tier) throw new NotFoundError("Price tier not found")

  const multiplier = 1 + percentage / 100

  const result = await prisma.$transaction(async (tx) => {
    const [oldCount, newCount] = await Promise.all([
      tx.productPrice.count({ where: { priceTierId: tierId } }),
      tx.itemPrice.count({ where: { priceTierId: tierId } }),
    ])
    await tx.$executeRaw`UPDATE "ProductPrice" SET "price" = "price" * ${multiplier}::DECIMAL WHERE "priceTierId" = ${tierId}`
    await tx.$executeRaw`UPDATE "ItemPrice" SET "price" = "price" * ${multiplier}::DECIMAL WHERE "priceTierId" = ${tierId}`
    await tx.activityLog.create({
      data: { tokoId: ctx.tokoId, actorId: ctx.actorId, action: "adjusted_prices", entityType: "PriceTier", entityId: tierId, metadata: { percentage } },
    })
    return oldCount + newCount
  })

  return { updated: result }
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
