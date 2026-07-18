import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { AuthContext } from "@/server/domain/types"
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from "@/server/domain/errors"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { hashPayload, atomicReserveIdempotency, atomicCompleteIdempotency } from "@/server/api/idempotency"

export type StockBalanceDTO = {
  itemId: string
  itemName: string
  itemType: string
  unit: string
  quantity: string
  averageCost: string
  version: number
  updatedAt: string
}

export type StockMovementDTO = {
  id: string
  itemId: string
  itemName: string
  unit: string
  quantity: string
  movementType: string
  unitCost: string | null
  unitPrice: string | null
  sourceType: string
  sourceId: string
  sourceLineId: string | null
  reversalOfId: string | null
  note: string | null
  createdById: string
  createdAt: string
  direction: string
}

export async function listBalances(
  ctx: AuthContext,
  query: { type?: string; search?: string; active?: boolean } = {},
): Promise<StockBalanceDTO[]> {
  const where: Record<string, unknown> = { tokoId: ctx.tokoId }
  if (query.type) where.type = query.type
  if (query.active !== undefined) where.isActive = query.active
  if (query.search) where.name = { contains: query.search, mode: "insensitive" }

  const items = await prisma.item.findMany({
    where: where as Prisma.ItemWhereInput,
    include: { stockBalance: true },
    orderBy: { name: "asc" },
  })

  return items.map((item) => ({
    itemId: item.id,
    itemName: item.name,
    itemType: item.type,
    unit: item.unit,
    quantity: item.stockBalance?.quantity.toString() ?? "0",
    averageCost: item.stockBalance?.averageCost.toString() ?? "0",
    version: item.stockBalance?.version ?? 0,
    updatedAt: item.stockBalance?.updatedAt?.toISOString() ?? new Date().toISOString(),
  }))
}

export async function listMovements(
  ctx: AuthContext,
  query: { itemId?: string; movementType?: string; sourceType?: string; dateFrom?: string; dateTo?: string; limit?: number; cursor?: { createdAt: Date; id: string } },
): Promise<{ items: StockMovementDTO[]; nextCursor?: string }> {
  const where: Record<string, unknown> = { tokoId: ctx.tokoId }
  if (query.itemId) where.itemId = query.itemId
  if (query.movementType) where.movementType = query.movementType
  if (query.sourceType) where.sourceType = query.sourceType
  if (query.dateFrom || query.dateTo) {
    const createdAtFilter: Record<string, Date> = {}
    if (query.dateFrom) createdAtFilter.gte = new Date(query.dateFrom)
    if (query.dateTo) createdAtFilter.lte = new Date(query.dateTo)
    where.createdAt = createdAtFilter
  }

  const limit = query.limit ?? 50
  const orderBy: Record<string, string>[] = [{ createdAt: "desc" }, { id: "desc" }]
  const cursorObj = query.cursor
    ? { createdAt: query.cursor.createdAt, id: query.cursor.id }
    : undefined

  const movements = await prisma.stockMovement.findMany({
    where: where as Prisma.StockMovementWhereInput,
    include: { item: { select: { name: true, unit: true } } },
    orderBy,
    take: limit + 1,
    ...(cursorObj ? { cursor: cursorObj as Prisma.StockMovementWhereUniqueInput, skip: 1 } : {}),
  })

  const hasMore = movements.length > limit
  const items = movements.slice(0, limit)

  return {
    items: items.map((m) => ({
      id: m.id,
      itemId: m.itemId,
      itemName: m.item.name,
      unit: m.item.unit,
      quantity: m.quantity.toString(),
      movementType: m.movementType,
      unitCost: m.unitCost?.toString() ?? null,
      unitPrice: m.unitPrice?.toString() ?? null,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      sourceLineId: m.sourceLineId,
      reversalOfId: m.reversalOfId,
      note: m.note,
      createdById: m.createdById,
      createdAt: m.createdAt.toISOString(),
      direction: m.quantity.gte(0) ? "IN" : "OUT",
    })),
    nextCursor: hasMore && items.length > 0
      ? Buffer.from(JSON.stringify({ createdAt: items[items.length - 1].createdAt, id: items[items.length - 1].id })).toString("base64url")
      : undefined,
  }
}

export type AdjustmentInput = {
  itemId: string
  quantity: string
  reason: string
}

export async function postAdjustment(
  ctx: AuthContext,
  input: AdjustmentInput,
  idempotency?: { key: string; payload: unknown },
): Promise<StockMovementDTO> {
  checkMaintenance()
  const idemHash = idempotency ? hashPayload(idempotency.payload) : undefined
  if (ctx.role !== "OWNER") throw new ForbiddenError("Owner access required")

  const qty = new Prisma.Decimal(input.quantity)
  if (qty.isZero()) throw new ValidationError("Adjustment quantity must not be zero")
  if (!input.reason?.trim()) throw new ValidationError("Reason is required")

  const item = await prisma.item.findUnique({
    where: { id: input.itemId, tokoId: ctx.tokoId },
    include: { stockBalance: true },
  })
  if (!item) throw new NotFoundError("Item not found")

  const dedupeKey = `ADJ_${ctx.tokoId}_${item.id}_${qty.toString()}_${Date.now()}`

  const result = await prisma.$transaction(async (tx) => {
    if (idempotency && idemHash) {
      const res = await atomicReserveIdempotency(tx, ctx.tokoId, idempotency.key, "inventory_adjustment", ctx.actorId, idemHash)
      if (res.replayed) return { replayed: res.body as StockMovementDTO }
    }

    if (qty.isNegative()) {
      // Atomic guarded decrement
      const updateResult = await tx.stockBalance.updateMany({
        where: { itemId: item.id, quantity: { gte: qty.abs() } },
        data: { quantity: { decrement: qty.abs() }, version: { increment: 1 } },
      })
      if (updateResult.count === 0) {
        const balance = await tx.stockBalance.findUnique({ where: { itemId: item.id } })
        throw new ConflictError(`Insufficient stock for ${item.name}: need ${qty.abs()}, have ${balance?.quantity.toString() ?? "0"}`)
      }
    } else {
      await tx.stockBalance.upsert({
        where: { itemId: item.id },
        update: { quantity: { increment: qty }, version: { increment: 1 } },
        create: { itemId: item.id, quantity: qty, averageCost: 0, version: 1 },
      })
    }

    const movement = await tx.stockMovement.create({
      data: {
        tokoId: ctx.tokoId,
        itemId: item.id,
        quantity: qty,
        movementType: "ADJUSTMENT",
        sourceType: "Adjustment",
        sourceId: item.id,
        dedupeKey,
        note: input.reason,
        createdById: ctx.actorId,
      },
    })

    const movementDTO: StockMovementDTO = {
      id: movement.id,
      itemId: movement.itemId,
      itemName: item.name,
      unit: item.unit,
      quantity: movement.quantity.toString(),
      movementType: movement.movementType,
      unitCost: movement.unitCost?.toString() ?? null,
      unitPrice: movement.unitPrice?.toString() ?? null,
      sourceType: movement.sourceType,
      sourceId: movement.sourceId,
      sourceLineId: movement.sourceLineId,
      reversalOfId: movement.reversalOfId,
      note: movement.note,
      createdById: movement.createdById,
      createdAt: movement.createdAt.toISOString(),
      direction: movement.quantity.gte(0) ? "IN" : "OUT",
    }

    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "posted_adjustment",
        entityType: "StockMovement",
        entityId: movement.id,
        metadata: { itemId: item.id, quantity: qty.toString(), reason: input.reason },
      },
    })

    if (idempotency) {
      await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "inventory_adjustment", movementDTO)
    }

    return movementDTO
  })

  if (result && typeof result === "object" && "replayed" in result && result.replayed) {
    return result.replayed as StockMovementDTO
  }
  return result as StockMovementDTO
}
