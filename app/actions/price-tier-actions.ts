'use server'

import { revalidatePath } from 'next/cache'
import { getUserAndTokoId } from '@/lib/toko'
import { toActionResult, type ActionResult } from '@/lib/action-result'
import { requireText } from '@/lib/number'
import { checkMaintenance } from '@/server/domain/maintenance-check'
import { prisma } from '@/lib/prisma'

export type CreatePriceTierInput = {
  name: string
}

export type PriceTierItem = {
  id: string
  name: string
  code: string
  isDefault: boolean
  isActive: boolean
  productCount: number
}

export async function createPriceTierAction(input: CreatePriceTierInput) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()
    const name = requireText(input.name, 'Price tier name')
    const count = await prisma.priceTier.count({ where: { tokoId } })
    const code = await createUniquePriceTierCode(name, tokoId)

    const tier = await prisma.$transaction(async (tx) => {
      const created = await tx.priceTier.create({
        data: {
          tokoId,
          name,
          code,
          sortOrder: count,
          isDefault: count === 0,
        },
        select: { id: true },
      })

      const products = await tx.product.findMany({
        where: { tokoId },
        select: { id: true },
      })
      if (products.length) {
        await tx.productPrice.createMany({
          data: products.map((product) => ({
            productId: product.id,
            priceTierId: created.id,
            price: 0,
          })),
        })
      }

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'created_price_tier',
          entityType: 'PriceTier',
          entityId: created.id,
        },
      })

      return created
    })

    revalidatePath('/settings')
    revalidatePath('/production')

    return tier
  })
}

export async function listPriceTiersAction(): Promise<ActionResult<PriceTierItem[]>> {
  return toActionResult(async () => {
    const { tokoId } = await getUserAndTokoId()

    const tiers = await prisma.priceTier.findMany({
      where: { tokoId },
      include: { _count: { select: { productPrices: true } } },
      orderBy: { sortOrder: 'asc' },
    })

    return tiers.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      isDefault: t.isDefault,
      isActive: t.isActive,
      productCount: t._count.productPrices,
    }))
  })
}

export async function adjustTierPricesAction(tierId: string, percentage: number): Promise<ActionResult<{ updated: number }>> {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()

    const tier = await prisma.priceTier.findFirst({
      where: { id: tierId, tokoId },
      select: { id: true },
    })
    if (!tier) throw new Error('Tipe harga tidak ditemukan.')

    const multiplier = 1 + percentage / 100

    const result = await prisma.$transaction(async (tx) => {
      const count: number = await tx.$executeRaw`
        UPDATE "ProductPrice"
        SET "price" = "price" * ${multiplier}::DECIMAL
        WHERE "priceTierId" = ${tierId}
      `

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'adjusted_prices',
          entityType: 'PriceTier',
          entityId: tierId,
          metadata: { percentage },
        },
      })

      return count
    })

    return { updated: result }
  })
}

export async function removePriceTierAction(tierId: string): Promise<ActionResult<void>> {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()

    const tier = await prisma.priceTier.findFirst({
      where: { id: tierId, tokoId },
      select: { id: true, isDefault: true, sortOrder: true },
    })
    if (!tier) throw new Error('Tipe harga tidak ditemukan.')

    const remainingTier = tier.isDefault
      ? await prisma.priceTier.findFirst({
          where: { tokoId, id: { not: tierId } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        })
      : null

    await prisma.$transaction(async (tx) => {
      if (remainingTier) {
        await tx.priceTier.update({
          where: { id: remainingTier.id },
          data: { isDefault: true, sortOrder: tier.sortOrder },
        })
      }

      await tx.productPrice.deleteMany({ where: { priceTierId: tierId } })
      await tx.saleItem.updateMany({
        where: { priceTierId: tierId },
        data: { priceTierId: null },
      })
      await tx.priceTier.delete({ where: { id: tierId } })

      await tx.priceTier.updateMany({
        where: { tokoId, sortOrder: { gt: tier.sortOrder } },
        data: { sortOrder: { decrement: 1 } },
      })

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'removed_price_tier',
          entityType: 'PriceTier',
          entityId: tierId,
        },
      })
    })

    revalidatePath('/settings')
    revalidatePath('/production')
    revalidatePath('/cashier')
  })
}

async function createUniquePriceTierCode(name: string, tokoId: string) {
  const base = slugify(name) || 'price-tier'
  let code = base
  let suffix = 2

  while (await prisma.priceTier.findFirst({ where: { tokoId, code }, select: { id: true } })) {
    code = `${base}-${suffix}`
    suffix += 1
  }

  return code
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
