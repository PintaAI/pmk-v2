import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { PrismaTx } from "@/server/services/prisma-tx"
import type { AuthContext } from "@/server/domain/types"
import { ValidationError, NotFoundError } from "@/server/domain/errors"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import {
  hashPayload, atomicReserveIdempotency, atomicCompleteIdempotency,
} from "@/server/api/idempotency"

export type PurchaseDTO = {
  id: string
  tokoId: string
  number: string
  date: string
  supplier: string | null
  note: string | null
  status: string
  totalAmount: string
  createdById: string
  createdAt: string
  updatedAt: string
  lines: PurchaseLineDTO[]
}

export type PurchaseLineDTO = {
  id: string
  itemId: string
  itemName: string
  quantity: string
  unit: string
  unitCost: string
  subtotal: string
}

export type CreatePurchaseInput = {
  date?: string
  supplier?: string
  note?: string
  totalAmount?: string | number
  items?: Array<{ itemId: string; qty: string | number; unit?: string; unitPrice: string | number }>
}

export async function listPurchases(
  ctx: AuthContext,
  query: { status?: string; dateFrom?: string; dateTo?: string; limit?: number; cursor?: { createdAt: Date; id: string } },
): Promise<{ items: PurchaseDTO[]; nextCursor?: string }> {
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
  const cursorObj = query.cursor
    ? { createdAt: query.cursor.createdAt, id: query.cursor.id }
    : undefined

  const purchases = await prisma.purchase.findMany({
    where: where as Prisma.PurchaseWhereInput,
    include: { lines: { include: { item: { select: { name: true, unit: true } } } } },
    orderBy,
    take: limit + 1,
    ...(cursorObj ? { cursor: cursorObj as Prisma.PurchaseWhereUniqueInput, skip: 1 } : {}),
  })

  const hasMore = purchases.length > limit
  const items = purchases.slice(0, limit)

  return {
    items: items.map(toPurchaseDTO),
    nextCursor: hasMore && items.length > 0
      ? Buffer.from(JSON.stringify({ createdAt: items[items.length - 1].createdAt, id: items[items.length - 1].id })).toString("base64url")
      : undefined,
  }
}

export async function getPurchase(ctx: AuthContext, purchaseId: string): Promise<PurchaseDTO> {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, tokoId: ctx.tokoId },
    include: { lines: { include: { item: { select: { name: true, unit: true } } } } },
  })
  if (!purchase) throw new NotFoundError("Purchase not found")
  return toPurchaseDTO(purchase)
}

export async function createPurchase(
  ctx: AuthContext,
  input: CreatePurchaseInput,
  idempotency?: { key: string; payload: unknown },
): Promise<PurchaseDTO> {
  checkMaintenance()
  const idemHash = idempotency ? hashPayload(idempotency.payload) : undefined

  const toko = await prisma.toko.findUniqueOrThrow({
    where: { id: ctx.tokoId },
    select: { operationalMode: true },
  })
  const isSimpleMode = toko.operationalMode === "SIMPLE_INVENTORY"

  if (isSimpleMode) {
    const totalAmount = new Prisma.Decimal(input.totalAmount ?? 0)
    if (totalAmount.isZero() || totalAmount.isNegative()) {
      throw new ValidationError("Total amount must be positive")
    }

    const purchase = await prisma.$transaction(async (tx) => {
      if (idempotency && idemHash) {
        const res = await atomicReserveIdempotency(tx, ctx.tokoId, idempotency.key, "purchase_create", ctx.actorId, idemHash)
        if (res.replayed) return { replayed: true as const, body: res.body as PurchaseDTO }
      }
      const number = await generatePurchaseNumber(tx, ctx.tokoId)
      const created = await tx.purchase.create({
        data: {
          tokoId: ctx.tokoId,
          number,
          date: input.date ? new Date(input.date) : new Date(),
          supplier: input.supplier?.trim() || undefined,
          note: input.note?.trim() || undefined,
          totalAmount,
          createdById: ctx.actorId,
        },
      })
      await tx.activityLog.create({
        data: {
          tokoId: ctx.tokoId,
          actorId: ctx.actorId,
          action: "created_purchase",
          entityType: "Purchase",
          entityId: created.id,
          metadata: { totalAmount: totalAmount.toString(), simpleMode: true },
        },
      })
      const dto: PurchaseDTO = {
        id: created.id,
        tokoId: created.tokoId,
        number: created.number,
        date: created.date.toISOString(),
        supplier: created.supplier,
        note: created.note,
        status: created.status,
        totalAmount: created.totalAmount.toString(),
        createdById: created.createdById,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        lines: [],
      }
      if (idempotency) {
        await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "purchase_create", dto)
      }
      return { replayed: false as const, value: dto }
    })
    return purchase.replayed ? purchase.body : purchase.value
  }

  const inputItems = input.items ?? []
  if (!inputItems.length) throw new ValidationError("Purchase must have at least one item")
  const uniqueItemIds = new Set(inputItems.map((item) => item.itemId))
  if (uniqueItemIds.size !== inputItems.length) throw new ValidationError("A material may only appear once per purchase")

  return prisma.$transaction(async (tx) => {
    if (idempotency && idemHash) {
      const res = await atomicReserveIdempotency(tx, ctx.tokoId, idempotency.key, "purchase_create", ctx.actorId, idemHash)
      if (res.replayed) return { replayed: res.body }
    }

    const number = await generatePurchaseNumber(tx, ctx.tokoId)

    const lines: Array<{ itemId: string; itemName: string; quantity: Prisma.Decimal; unit: string; unitCost: Prisma.Decimal; subtotal: Prisma.Decimal }> = []

    for (const item of inputItems) {
      const material = await tx.item.findUnique({
        where: { id: item.itemId, tokoId: ctx.tokoId, type: "MATERIAL" },
      })
      if (!material) throw new NotFoundError(`Material ${item.itemId} not found`)
      if (!material.isActive) throw new ValidationError(`Material ${material.name} is archived`)

      const qty = new Prisma.Decimal(item.qty)
      if (qty.isZero() || qty.isNegative()) throw new ValidationError("Item quantity must be positive")
      const unitCost = new Prisma.Decimal(item.unitPrice)
      if (unitCost.isNegative()) throw new ValidationError("Unit cost must be non-negative")
      const subtotal = qty.mul(unitCost)

      lines.push({
        itemId: material.id,
        itemName: material.name,
        quantity: qty,
        unit: item.unit || material.unit,
        unitCost,
        subtotal,
      })
    }

    const totalAmount = lines.reduce((sum, l) => sum.plus(l.subtotal), new Prisma.Decimal(0))

    const purchase = await tx.purchase.create({
      data: {
        tokoId: ctx.tokoId,
        number,
        date: input.date ? new Date(input.date) : new Date(),
        supplier: input.supplier?.trim() || undefined,
        note: input.note?.trim() || undefined,
        totalAmount,
        createdById: ctx.actorId,
        lines: {
          create: lines.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            quantity: l.quantity,
            unit: l.unit,
            unitCost: l.unitCost,
            subtotal: l.subtotal,
          })),
        },
      },
      include: { lines: { include: { item: { select: { name: true, unit: true } } } } },
    })

    const idemDedupe = idempotency ? idempotency.key.slice(0, 12) : purchase.id

    for (const line of lines) {
      // Lock the row for concurrent safety on weighted average computation
      await tx.$queryRawUnsafe(
        `SELECT "itemId" FROM "StockBalance" WHERE "itemId" = $1 FOR UPDATE`,
        line.itemId
      ).catch(() => { /* row may not exist yet, upsert below will create it */ })

      const balance = await tx.stockBalance.findUnique({ where: { itemId: line.itemId } })
      const prevQty = balance?.quantity ?? new Prisma.Decimal(0)
      const prevCost = balance?.averageCost ?? new Prisma.Decimal(0)
      const prevValue = prevQty.mul(prevCost)
      const purchaseValue = line.quantity.mul(line.unitCost)
      const nextQty = prevQty.plus(line.quantity)
      const avgCost = nextQty.isZero() ? new Prisma.Decimal(0) : prevValue.plus(purchaseValue).div(nextQty)

      await tx.stockBalance.upsert({
        where: { itemId: line.itemId },
        update: { quantity: { increment: line.quantity }, averageCost: avgCost, version: { increment: 1 } },
        create: { itemId: line.itemId, quantity: line.quantity, averageCost: avgCost, version: 1 },
      })

      await tx.stockMovement.create({
        data: {
          tokoId: ctx.tokoId,
          itemId: line.itemId,
          quantity: line.quantity,
          movementType: "PURCHASE",
          unitCost: line.unitCost,
          sourceType: "Purchase",
          sourceId: purchase.id,
          dedupeKey: `PURCH_${idemDedupe}_${line.itemId}`,
          createdById: ctx.actorId,
        },
      })
    }

    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "created_purchase",
        entityType: "Purchase",
        entityId: purchase.id,
        metadata: { totalAmount: totalAmount.toString(), itemsCount: lines.length },
      },
    })

    if (idempotency) {
      const purchaseDTO: PurchaseDTO = {
        id: purchase.id, tokoId: ctx.tokoId, number,
        date: purchase.date.toISOString(), supplier: input.supplier?.trim() || null,
        note: input.note?.trim() || null, status: purchase.status,
        totalAmount: totalAmount.toString(), createdById: ctx.actorId,
        createdAt: purchase.createdAt.toISOString(), updatedAt: purchase.updatedAt.toISOString(),
        lines: purchase.lines.map((l) => ({
          id: l.id, itemId: l.itemId, itemName: l.itemName,
          quantity: l.quantity.toString(), unit: l.unit, unitCost: l.unitCost.toString(), subtotal: l.subtotal.toString(),
        })),
      }
      await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "purchase_create", purchaseDTO)
    }

    return purchase
  }).then((p) => {
    if (p && typeof p === "object" && "replayed" in p && p.replayed) {
      return (p as { replayed: unknown }).replayed as PurchaseDTO
    }
    return getPurchase(ctx, (p as { id: string }).id)
  })
}

async function generatePurchaseNumber(tx: PrismaTx, tokoId: string): Promise<string> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`purchase-number:${tokoId}`}, 0))::text AS locked`
  const rows = await tx.$queryRaw<Array<{ next: bigint }>>`
    SELECT COALESCE(MAX(SUBSTRING("number" FROM 4)::bigint), 0) + 1 AS next
    FROM "Purchase"
    WHERE "tokoId" = ${tokoId} AND "number" ~ '^PO-[0-9]+$'
  `
  return `PO-${(rows[0]?.next.toString() ?? "1").padStart(3, "0")}`
}

function toPurchaseDTO(p: Prisma.PurchaseGetPayload<{ include: { lines: { include: { item: { select: { name: true; unit: true } } } } } }>): PurchaseDTO {
  return {
    id: p.id,
    tokoId: p.tokoId,
    number: p.number,
    date: p.date.toISOString(),
    supplier: p.supplier ?? null,
    note: p.note ?? null,
    status: p.status,
    totalAmount: p.totalAmount.toString(),
    createdById: p.createdById,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lines: p.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      itemName: l.itemName ?? l.item.name,
      quantity: l.quantity.toString(),
      unit: l.unit ?? l.item.unit,
      unitCost: l.unitCost.toString(),
      subtotal: l.subtotal.toString(),
    })),
  }
}
