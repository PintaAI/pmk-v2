import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { AuthContext } from "@/server/domain/types"
import { ValidationError, NotFoundError, ConflictError } from "@/server/domain/errors"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import {
  hashPayload, atomicReserveIdempotency, atomicCompleteIdempotency,
} from "@/server/api/idempotency"

export type ProductionDTO = {
  id: string
  tokoId: string
  date: string
  note: string | null
  status: string
  postedAt: string | null
  reversedAt: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  lines: ProductionLineDTO[]
}

export type ProductionLineDTO = {
  id: string
  itemId: string | null
  itemName: string
  lineType: string
  quantity: string
  unit: string
  unitCost: string | null
}

export type CreateProductionInput = {
  date?: string
  note?: string
  bahanItems?: Array<{ bahanId: string; qtyUsed: string | number; unit?: string }>
  productItems: Array<{ productId: string; qtyProduced: string | number }>
}

export async function listProductions(
  ctx: AuthContext,
  query: { status?: string; dateFrom?: string; dateTo?: string; limit?: number; cursor?: { createdAt: Date; id: string } },
): Promise<{ items: ProductionDTO[]; nextCursor?: string }> {
  const where: Record<string, unknown> = { tokoId: ctx.tokoId }
  if (query.status) where.status = query.status
  if (query.dateFrom || query.dateTo) {
    const dateFilter: Record<string, Date> = {}
    if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom)
    if (query.dateTo) dateFilter.lte = new Date(query.dateTo)
    where.date = dateFilter
  }

  const limit = query.limit ?? 50
  const orderBy: Record<string, string>[] = [{ date: "desc" }, { id: "desc" }]
  const cursorObj = query.cursor ? { createdAt: query.cursor.createdAt, id: query.cursor.id } : undefined

  const productions = await prisma.newProduction.findMany({
    where: where as Prisma.NewProductionWhereInput,
    include: { lines: { include: { item: { select: { name: true, unit: true } } } } },
    orderBy,
    take: limit + 1,
    ...(cursorObj ? { cursor: cursorObj as Prisma.NewProductionWhereUniqueInput, skip: 1 } : {}),
  })

  const hasMore = productions.length > limit
  const items = productions.slice(0, limit)
  return {
    items: items.map(toProductionDTO),
    nextCursor: hasMore && items.length > 0
      ? Buffer.from(JSON.stringify({ createdAt: items[items.length - 1].createdAt, id: items[items.length - 1].id })).toString("base64url")
      : undefined,
  }
}

export async function getProduction(ctx: AuthContext, productionId: string): Promise<ProductionDTO> {
  const production = await prisma.newProduction.findFirst({
    where: { id: productionId, tokoId: ctx.tokoId },
    include: { lines: { include: { item: { select: { name: true, unit: true } } } } },
  })
  if (!production) throw new NotFoundError("Production not found")
  return toProductionDTO(production)
}

export async function createProduction(
  ctx: AuthContext,
  input: CreateProductionInput,
  idempotency?: { key: string; payload: unknown },
): Promise<ProductionDTO> {
  checkMaintenance()
  const idemHash = idempotency ? hashPayload(idempotency.payload) : undefined

  const toko = await prisma.toko.findUniqueOrThrow({
    where: { id: ctx.tokoId },
    select: { operationalMode: true },
  })
  const isSimpleMode = toko.operationalMode === "SIMPLE_INVENTORY"
  const inputBahanItems = isSimpleMode ? [] : input.bahanItems ?? []

  if (!isSimpleMode && !inputBahanItems.length) {
    throw new ValidationError("Production must use at least one material")
  }
  if (!input.productItems.length) {
    throw new ValidationError("Production must produce at least one product")
  }

  const result = await prisma.$transaction(async (tx) => {
    if (idempotency && idemHash) {
      const res = await atomicReserveIdempotency(tx, ctx.tokoId, idempotency.key, "production_create", ctx.actorId, idemHash)
      if (res.replayed) return { replayed: res.body as ProductionDTO }
    }

    const idemDedupe = idempotency ? idempotency.key.slice(0, 12) : ""

    const bahanLines: Array<{ itemId: string; itemName: string; lineType: "INPUT"; quantity: Prisma.Decimal; unit: string; unitCost: null }> = []
    const seenInputIds = new Set<string>()

    for (const item of inputBahanItems) {
      if (seenInputIds.has(item.bahanId)) throw new ValidationError(`Duplicate material: ${item.bahanId}`)
      seenInputIds.add(item.bahanId)

      const material = await tx.item.findUnique({
        where: { id: item.bahanId, tokoId: ctx.tokoId },
        include: { stockBalance: true },
      })
      if (!material) throw new NotFoundError(`Material ${item.bahanId} not found`)
      if (material.type !== "MATERIAL") throw new ValidationError(`Item ${material.name} is not a material`)
      if (!material.isActive) throw new ValidationError(`Material ${material.name} is archived`)

      const qty = new Prisma.Decimal(item.qtyUsed)
      if (qty.isZero() || qty.isNegative()) throw new ValidationError("Material quantity must be positive")

      const updateResult = await tx.stockBalance.updateMany({
        where: { itemId: material.id, quantity: { gte: qty } },
        data: { quantity: { decrement: qty }, version: { increment: 1 } },
      })
      if (updateResult.count === 0) {
        const balance = await tx.stockBalance.findUnique({ where: { itemId: material.id } })
        throw new ConflictError(`Insufficient stock for ${material.name}: need ${qty}, have ${balance?.quantity.toString() ?? "0"}`)
      }

      bahanLines.push({ itemId: material.id, itemName: material.name, lineType: "INPUT", quantity: qty, unit: item.unit || material.unit, unitCost: null })
    }

    const outputLines: Array<{ itemId: string; itemName: string; lineType: "OUTPUT"; quantity: Prisma.Decimal; unit: string; unitCost: null }> = []

    for (const item of input.productItems) {
      const product = await tx.item.findUnique({ where: { id: item.productId, tokoId: ctx.tokoId } })
      if (!product) throw new NotFoundError(`Product ${item.productId} not found`)
      if (product.type !== "PRODUCT") throw new ValidationError(`Item ${product.name} is not a product`)
      if (!product.isActive) throw new ValidationError(`Product ${product.name} is archived`)

      const qty = new Prisma.Decimal(item.qtyProduced)
      if (qty.isZero() || qty.isNegative()) throw new ValidationError("Product quantity must be positive")
      outputLines.push({ itemId: product.id, itemName: product.name, lineType: "OUTPUT", quantity: qty, unit: "pcs", unitCost: null })
    }

    const production = await tx.newProduction.create({
      data: {
        tokoId: ctx.tokoId,
        date: input.date ? new Date(input.date) : new Date(),
        note: input.note?.trim() || undefined,
        postedAt: new Date(),
        createdById: ctx.actorId,
        lines: {
          create: [...bahanLines, ...outputLines].map((l) => ({
            itemId: l.itemId, itemName: l.itemName, lineType: l.lineType,
            quantity: l.quantity, unit: l.unit, unitCost: l.unitCost,
          })),
        },
      },
      include: { lines: { include: { item: { select: { name: true, unit: true } } } } },
    })

    const productionDTO = toProductionDTO(production)

    for (const line of bahanLines) {
      await tx.stockMovement.create({
        data: {
          tokoId: ctx.tokoId, itemId: line.itemId, quantity: line.quantity.negated(),
          movementType: "PRODUCTION_INPUT", sourceType: "Production", sourceId: production.id,
          dedupeKey: `PROD_IN_${idemDedupe || production.id}_${line.itemId}`, createdById: ctx.actorId,
        },
      })
    }

    for (const line of outputLines) {
      await tx.stockBalance.upsert({
        where: { itemId: line.itemId },
        update: { quantity: { increment: line.quantity }, version: { increment: 1 } },
        create: { itemId: line.itemId, quantity: line.quantity, averageCost: 0, version: 1 },
      })
      await tx.stockMovement.create({
        data: {
          tokoId: ctx.tokoId, itemId: line.itemId, quantity: line.quantity,
          movementType: "PRODUCTION_OUTPUT", sourceType: "Production", sourceId: production.id,
          dedupeKey: `PROD_OUT_${idemDedupe || production.id}_${line.itemId}`, createdById: ctx.actorId,
        },
      })
    }

    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId, actorId: ctx.actorId, action: "created_production",
        entityType: "NewProduction", entityId: production.id,
        metadata: { bahanItemsCount: bahanLines.length, productItemsCount: outputLines.length, simpleMode: isSimpleMode },
      },
    })

    if (idempotency) {
      await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "production_create", productionDTO)
    }

    return { productionDTO }
  })

  if (result && typeof result === "object" && "replayed" in result && result.replayed) {
    return (result as { replayed: ProductionDTO }).replayed
  }
  return (result as { productionDTO: ProductionDTO }).productionDTO
}

function toProductionDTO(p: Prisma.NewProductionGetPayload<{ include: { lines: { include: { item: { select: { name: true; unit: true } } } } } }>): ProductionDTO {
  return {
    id: p.id, tokoId: p.tokoId, date: p.date.toISOString(), note: p.note ?? null,
    status: p.status, postedAt: p.postedAt?.toISOString() ?? null, reversedAt: p.reversedAt?.toISOString() ?? null,
    createdById: p.createdById, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    lines: p.lines.map((l) => ({
      id: l.id, itemId: l.itemId ?? null, itemName: l.itemName ?? l.item?.name ?? "",
      lineType: l.lineType, quantity: l.quantity.toString(),
      unit: l.unit ?? l.item?.unit ?? "pcs", unitCost: l.unitCost?.toString() ?? null,
    })),
  }
}
