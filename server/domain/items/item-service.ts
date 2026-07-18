import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { PrismaTx } from "@/server/services/prisma-tx"
import type { AuthContext } from "@/server/domain/types"
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from "@/server/domain/errors"
import { OperationalMode } from "@/generated/prisma/client"

export type ItemDTO = {
  id: string
  tokoId: string
  type: string
  name: string
  unit: string
  unitKind: string
  baseUnit: string
  imageUrl: string | null
  isActive: boolean
  currentQty: string
  averageCost: string
  conversions: Array<{ id: string; unit: string; factor: string }>
  prices: Array<{ priceTierId: string; priceTierCode: string; priceTierName: string; price: string; isDefault: boolean }>
  createdAt: string
  updatedAt: string
}

export type ItemListQuery = {
  type?: string
  isActive?: boolean
  search?: string
}

export async function listItems(ctx: AuthContext, query: ItemListQuery = {}): Promise<ItemDTO[]> {
  const where: Record<string, unknown> = { tokoId: ctx.tokoId }
  if (query.type) where.type = query.type
  if (query.isActive !== undefined) where.isActive = query.isActive
  if (query.search) where.name = { contains: query.search, mode: "insensitive" }

  const items = await prisma.item.findMany({
    where: where as Prisma.ItemWhereInput,
    orderBy: { name: "asc" },
    include: {
      stockBalance: true,
      unitConversions: true,
      itemPrices: {
        include: { priceTier: true },
      },
    },
  })

  return items.map((item) => toItemDTO(item))
}

export async function getItem(ctx: AuthContext, itemId: string): Promise<ItemDTO> {
  const item = await prisma.item.findUnique({
    where: { id: itemId, tokoId: ctx.tokoId },
    include: {
      stockBalance: true,
      unitConversions: true,
      itemPrices: {
        include: { priceTier: true },
      },
    },
  })
  if (!item) throw new NotFoundError("Item not found")
  return toItemDTO(item)
}

export type CreateItemInput = {
  type: string
  name: string
  unit?: string
  unitKind?: string
  baseUnit?: string
  imageUrl?: string
  initialQty?: string
  initialCost?: string
  alternativeUnits?: Array<{ unit: string; factor: string | number }>
  prices?: Array<{ priceTierId: string; price: string | number }>
}

export async function createItem(ctx: AuthContext, input: CreateItemInput): Promise<ItemDTO> {
  if (!input.name?.trim()) throw new ValidationError("Item name is required")
  if (input.name.trim().length < 2) throw new ValidationError("Item name must be at least 2 characters")

  const itemType = input.type === "PRODUCT" ? "PRODUCT" : "MATERIAL"
  const unit = input.unit ?? (itemType === "PRODUCT" ? "pcs" : "unit")
  const unitKind = input.unitKind ?? (itemType === "PRODUCT" ? "COUNT" : "CUSTOM")
  const baseUnit = input.baseUnit ?? unit

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        tokoId: ctx.tokoId,
        type: itemType as "MATERIAL" | "PRODUCT",
        name: input.name.trim(),
        unit,
        unitKind: unitKind as "MASS" | "VOLUME" | "COUNT" | "CUSTOM",
        baseUnit,
        imageUrl: input.imageUrl ?? undefined,
        isActive: true,
        stockBalance: {
          create: {
            quantity: input.initialQty ?? "0",
            averageCost: input.initialCost ?? "0",
          },
        },
        unitConversions: input.alternativeUnits?.length
          ? {
              create: input.alternativeUnits.map((u) => ({
                unit: u.unit,
                factor: u.factor,
              })),
            }
          : undefined,
        itemPrices: input.prices?.length
          ? {
              create: input.prices.map((p) => ({
                priceTierId: p.priceTierId,
                price: p.price,
              })),
            }
          : undefined,
      },
    })

    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: itemType === "PRODUCT" ? "created_product" : "created_material",
        entityType: "Item",
        entityId: created.id,
      },
    })

    return created
  })

  return getItem(ctx, item.id)
}

export type UpdateItemInput = {
  name?: string
  unit?: string
  unitKind?: string
  baseUnit?: string
  imageUrl?: string
  isActive?: boolean
}

export async function updateItem(ctx: AuthContext, itemId: string, input: UpdateItemInput): Promise<ItemDTO> {
  const existing = await prisma.item.findUnique({ where: { id: itemId, tokoId: ctx.tokoId } })
  if (!existing) throw new NotFoundError("Item not found")

  if (input.name !== undefined && (!input.name.trim() || input.name.trim().length < 2)) {
    throw new ValidationError("Item name must be at least 2 characters")
  }

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.unit !== undefined) data.unit = input.unit
  if (input.unitKind !== undefined) data.unitKind = input.unitKind
  if (input.baseUnit !== undefined) data.baseUnit = input.baseUnit
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl
  if (input.isActive !== undefined) data.isActive = input.isActive

  if (Object.keys(data).length === 0) return getItem(ctx, itemId)

  await prisma.$transaction(async (tx) => {
    await tx.item.update({ where: { id: itemId }, data: data as Prisma.ItemUpdateInput })
    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "updated_item",
        entityType: "Item",
        entityId: itemId,
      },
    })
  })

  return getItem(ctx, itemId)
}

export async function archiveItem(ctx: AuthContext, itemId: string): Promise<ItemDTO> {
  const existing = await prisma.item.findUnique({ where: { id: itemId, tokoId: ctx.tokoId } })
  if (!existing) throw new NotFoundError("Item not found")

  await prisma.$transaction(async (tx) => {
    await tx.item.update({ where: { id: itemId }, data: { isActive: false } })
    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "archived_item",
        entityType: "Item",
        entityId: itemId,
      },
    })
  })

  return getItem(ctx, itemId)
}

export async function upsertItemUnitConversions(
  ctx: AuthContext,
  itemId: string,
  conversions: Array<{ unit: string; factor: string | number }>,
): Promise<ItemDTO> {
  const existing = await prisma.item.findUnique({ where: { id: itemId, tokoId: ctx.tokoId } })
  if (!existing) throw new NotFoundError("Item not found")

  await prisma.$transaction(async (tx) => {
    await tx.itemUnitConversion.deleteMany({ where: { itemId } })
    if (conversions.length > 0) {
      await tx.itemUnitConversion.createMany({
        data: conversions.map((c) => ({
          itemId,
          unit: c.unit,
          factor: c.factor,
        })),
      })
    }
    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "updated_unit_conversions",
        entityType: "Item",
        entityId: itemId,
      },
    })
  })

  return getItem(ctx, itemId)
}

export async function upsertItemPrices(
  ctx: AuthContext,
  itemId: string,
  prices: Array<{ priceTierId: string; price: string | number }>,
): Promise<ItemDTO> {
  const item = await prisma.item.findUnique({ where: { id: itemId, tokoId: ctx.tokoId } })
  if (!item) throw new NotFoundError("Item not found")
  if (item.type !== "PRODUCT") throw new ValidationError("Prices can only be set for products")

  await prisma.$transaction(async (tx) => {
    for (const p of prices) {
      const tier = await tx.priceTier.findFirst({
        where: { id: p.priceTierId, tokoId: ctx.tokoId },
      })
      if (!tier) throw new ValidationError(`Price tier ${p.priceTierId} not found in this store`)

      await tx.itemPrice.upsert({
        where: { itemId_priceTierId: { itemId, priceTierId: p.priceTierId } },
        update: { price: p.price },
        create: { itemId, priceTierId: p.priceTierId, price: p.price },
      })
    }
    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "updated_item_prices",
        entityType: "Item",
        entityId: itemId,
      },
    })
  })

  return getItem(ctx, itemId)
}

export async function deleteItem(ctx: AuthContext, itemId: string): Promise<void> {
  if (ctx.role !== "OWNER") throw new ForbiddenError("Owner access required")
  const existing = await prisma.item.findUnique({ where: { id: itemId, tokoId: ctx.tokoId } })
  if (!existing) throw new NotFoundError("Item not found")

  const [purchaseLines, orderLines, movements, productions] = await Promise.all([
    prisma.purchaseLine.count({ where: { itemId } }),
    prisma.orderLine.count({ where: { itemId } }),
    prisma.stockMovement.count({ where: { itemId } }),
    prisma.productionLine.count({ where: { itemId } }),
  ])

  if (purchaseLines > 0 || orderLines > 0 || movements > 0 || productions > 0) {
    throw new ConflictError("Item is referenced in historical documents and cannot be deleted. Archive it instead.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.itemUnitConversion.deleteMany({ where: { itemId } })
    await tx.itemPrice.deleteMany({ where: { itemId } })
    await tx.stockBalance.deleteMany({ where: { itemId } })
    await tx.item.delete({ where: { id: itemId } })
    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "deleted_item",
        entityType: "Item",
        entityId: existing.id,
      },
    })
  })
}

type ItemWithRelations = Prisma.ItemGetPayload<{
  include: {
    stockBalance: true
    unitConversions: true
    itemPrices: { include: { priceTier: true } }
  }
}>

function toItemDTO(item: ItemWithRelations): ItemDTO {
  return {
    id: item.id,
    tokoId: item.tokoId,
    type: item.type,
    name: item.name,
    unit: item.unit,
    unitKind: item.unitKind,
    baseUnit: item.baseUnit,
    imageUrl: item.imageUrl ?? null,
    isActive: item.isActive,
    currentQty: item.stockBalance?.quantity.toString() ?? "0",
    averageCost: item.stockBalance?.averageCost.toString() ?? "0",
    conversions: (item.unitConversions ?? []).map((c) => ({
      id: c.id,
      unit: c.unit,
      factor: c.factor.toString() ?? "1",
    })),
    prices: (item.itemPrices ?? []).map((p) => ({
      priceTierId: p.priceTierId,
      priceTierCode: p.priceTier.code,
      priceTierName: p.priceTier.name,
      price: p.price.toString() ?? "0",
      isDefault: p.priceTier.isDefault,
    })),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}
