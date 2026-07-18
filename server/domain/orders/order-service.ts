import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { PrismaTx } from "@/server/services/prisma-tx"
import type { AuthContext } from "@/server/domain/types"
import { ValidationError, NotFoundError, ForbiddenError, ConflictError, IdempotencyConflictError } from "@/server/domain/errors"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import {
  hashPayload, atomicReserveIdempotency, atomicCompleteIdempotency,
} from "@/server/api/idempotency"

const VALID_PAYMENT_METHODS = ["CASH", "QRIS", "TRANSFER", "EWALLET", "OTHER"] as const
const VALID_CHANNELS = ["CASHIER", "RESELLER", "ONLINE"] as const

export type OrderDTO = {
  id: string
  tokoId: string
  number: string
  source: string
  channel: string | null
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  customerName: string | null
  customerContact: string | null
  note: string | null
  paymentMethod: string | null
  subtotal: string
  discount: string
  deliveryFee: string
  total: string
  paidAmount: string | null
  tracksInventory: boolean
  postedAt: string | null
  cancelledAt: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  lines: OrderLineDTO[]
}

export type OrderLineDTO = {
  id: string
  itemId: string
  itemName: string
  priceTierId: string | null
  priceTierCode: string | null
  priceTierName: string | null
  quantity: string
  unit: string
  unitPrice: string
  subtotal: string
}

export type OrderListQuery = {
  status?: string
  paymentStatus?: string
  fulfillmentStatus?: string
  source?: string
  channel?: string
  dateFrom?: string
  dateTo?: string
  customerSearch?: string
}

export async function listOrders(
  ctx: AuthContext,
  query: OrderListQuery & { limit?: number; cursor?: { createdAt: Date; id: string } },
): Promise<{ items: OrderDTO[]; nextCursor?: string }> {
  const where: Record<string, unknown> = { tokoId: ctx.tokoId }
  if (query.status) where.status = query.status
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus
  if (query.fulfillmentStatus) where.fulfillmentStatus = query.fulfillmentStatus
  if (query.source) where.source = query.source
  if (query.channel) where.channel = query.channel
  if (query.dateFrom || query.dateTo) {
    const createdAtFilter: Record<string, Date> = {}
    if (query.dateFrom) createdAtFilter.gte = new Date(query.dateFrom)
    if (query.dateTo) createdAtFilter.lte = new Date(query.dateTo)
    where.createdAt = createdAtFilter
  }
  if (query.customerSearch) {
    where.OR = [
      { customerName: { contains: query.customerSearch, mode: "insensitive" } },
      { customerContact: { contains: query.customerSearch, mode: "insensitive" } },
    ]
  }

  const limit = query.limit ?? 50
  const orderBy: Record<string, string>[] = [{ createdAt: "desc" }, { id: "desc" }]
  const cursorObj = query.cursor
    ? { createdAt: query.cursor.createdAt, id: query.cursor.id }
    : undefined

  const orders = await prisma.order.findMany({
    where: where as Prisma.OrderWhereInput,
    include: { lines: { include: { item: { select: { name: true } } } } },
    orderBy,
    take: limit + 1,
    ...(cursorObj ? { cursor: cursorObj as Prisma.OrderWhereUniqueInput, skip: 1 } : {}),
  })

  const hasMore = orders.length > limit
  const items = orders.slice(0, limit)

  return {
    items: items.map(toOrderDTO),
    nextCursor: hasMore && items.length > 0
      ? Buffer.from(JSON.stringify({ createdAt: items[items.length - 1].createdAt, id: items[items.length - 1].id })).toString("base64url")
      : undefined,
  }
}

export async function getOrder(ctx: AuthContext, orderId: string): Promise<OrderDTO> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tokoId: ctx.tokoId },
    include: { lines: { include: { item: { select: { name: true } } } } },
  })
  if (!order) throw new NotFoundError("Order not found")
  return toOrderDTO(order)
}

type TxResult<T> = { replayed: true; body: T } | { replayed: false; value: T }

type ProcessedLine = {
  itemId: string
  itemName: string
  priceTierId: string | null
  priceTierCode: string | null
  priceTierName: string | null
  quantity: Prisma.Decimal
  unit: string
  unitPrice: Prisma.Decimal
  subtotal: Prisma.Decimal
}

async function processCartLines(
  tx: PrismaTx,
  tokoId: string,
  items: Array<{ productId: string; priceTierId?: string; quantity: number; customUnitPrice?: string | number }>,
): Promise<ProcessedLine[]> {
  const lines: ProcessedLine[] = []
  const seenItemIds = new Set<string>()

  for (const item of items) {
    if (seenItemIds.has(item.productId)) {
      throw new ValidationError(`Duplicate product in cart: ${item.productId}`)
    }
    seenItemIds.add(item.productId)

    const product = await tx.item.findUnique({
      where: { id: item.productId, tokoId },
      include: { itemPrices: { include: { priceTier: true } }, stockBalance: true },
    })
    if (!product) throw new NotFoundError(`Product ${item.productId} not found`)
    if (product.type !== "PRODUCT") throw new ValidationError(`Item ${product.name} is not a product`)
    if (!product.isActive) throw new ValidationError(`Product ${product.name} is archived`)

    const qty = new Prisma.Decimal(item.quantity)
    if (qty.isZero() || qty.isNegative()) throw new ValidationError("Quantity must be positive")

    const selectedPrice = (() => {
      if (item.customUnitPrice !== undefined) {
        const cp = new Prisma.Decimal(item.customUnitPrice)
        if (cp.isNegative() || cp.isZero()) throw new ValidationError("Custom unit price must be positive")
        return { priceTierId: null as string | null, priceTierCode: "CUSTOM", priceTierName: "Custom", unitPrice: cp }
      }
      const tierPrice = item.priceTierId
        ? product.itemPrices.find((p) => p.priceTierId === item.priceTierId)
        : product.itemPrices.find((p) => p.priceTier.isDefault) ?? product.itemPrices[0]
      if (!tierPrice) throw new ValidationError(`Product ${product.name} has no configured price`)
      return {
        priceTierId: tierPrice.priceTierId,
        priceTierCode: tierPrice.priceTier.code,
        priceTierName: tierPrice.priceTier.name,
        unitPrice: tierPrice.price,
      }
    })()

    lines.push({
      itemId: product.id,
      itemName: product.name,
      priceTierId: selectedPrice.priceTierId,
      priceTierCode: selectedPrice.priceTierCode,
      priceTierName: selectedPrice.priceTierName,
      quantity: qty,
      unit: "pcs",
      unitPrice: selectedPrice.unitPrice,
      subtotal: qty.mul(selectedPrice.unitPrice),
    })
  }
  return lines
}

export type CheckoutInput = {
  cart: Array<{
    productId: string
    priceTierId?: string
    quantity: number
    customUnitPrice?: string | number
  }>
  paymentMethod: string
  amountPaid?: string | number
  customerName?: string
  deliveryFee?: string | number
  note?: string
}

export async function checkoutOrder(ctx: AuthContext, input: CheckoutInput, idempotency?: { key: string; payload: unknown }): Promise<OrderDTO> {
  checkMaintenance()
  const idemHash = idempotency ? hashPayload(idempotency.payload) : undefined
  if (!input.cart.length) throw new ValidationError("Cart is empty")

  const toko = await prisma.toko.findUniqueOrThrow({
    where: { id: ctx.tokoId },
    select: { operationalMode: true },
  })
  const tracksInventory = toko.operationalMode !== "CASHIER_ONLY"

  const paymentMethod = (input.paymentMethod ?? "CASH").toUpperCase()
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod as (typeof VALID_PAYMENT_METHODS)[number])) {
    throw new ValidationError(`Invalid payment method: ${input.paymentMethod}`)
  }

  const result = await prisma.$transaction(async (tx) => {
    if (idempotency && idemHash) {
      const res = await atomicReserveIdempotency(tx, ctx.tokoId, idempotency.key, "checkout", ctx.actorId, idemHash)
      if (res.replayed) return { replayed: true as const, body: res.body as OrderDTO } satisfies TxResult<OrderDTO>
    }

    const lines = await processCartLines(tx, ctx.tokoId, input.cart)
    const idemDedupe = idempotency ? idempotency.key.slice(0, 12) : ""
    const number = await generateOrderNumber(tx, ctx.tokoId)

    const subtotal = lines.reduce((s, l) => s.plus(l.subtotal), new Prisma.Decimal(0))
    const deliveryFee = new Prisma.Decimal(input.deliveryFee ?? 0)
    if (deliveryFee.isNegative()) throw new ValidationError("Delivery fee must be non-negative")
    const total = subtotal.plus(deliveryFee)
    const paidAmount = new Prisma.Decimal(input.amountPaid ?? total)
    if (paidAmount.lessThan(total)) throw new ValidationError("Paid amount must cover the order total")

    // Atomic stock decrement with quantity guard
    if (tracksInventory) {
      for (const line of lines) {
        const result = await tx.stockBalance.updateMany({
          where: { itemId: line.itemId, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity }, version: { increment: 1 } },
        })
        if (result.count === 0) {
          const balance = await tx.stockBalance.findUnique({ where: { itemId: line.itemId } })
          const avail = balance?.quantity.toString() ?? "0"
          throw new ConflictError(`Insufficient stock for ${line.itemName}: need ${line.quantity}, have ${avail}`)
        }
      }
    }

    const order = await tx.order.create({
      data: {
        tokoId: ctx.tokoId,
        number,
        source: "CASHIER",
        channel: "CASHIER",
        status: "COMPLETED",
        paymentStatus: "PAID",
        fulfillmentStatus: "FULFILLED",
        customerName: input.customerName?.trim() || undefined,
        note: input.note?.trim() || undefined,
        paymentMethod: paymentMethod as "CASH" | "QRIS" | "TRANSFER" | "EWALLET" | "OTHER",
        subtotal,
        deliveryFee,
        total,
        paidAmount,
        tracksInventory,
        postedAt: new Date(),
        createdById: ctx.actorId,
        lines: {
          create: lines.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            priceTierId: l.priceTierId,
            priceTierCode: l.priceTierCode,
            priceTierName: l.priceTierName,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
          })),
        },
      },
      include: { lines: true },
    })

    const dto = buildOrderDTO({
      id: order.id, tokoId: ctx.tokoId, number, source: "CASHIER", channel: "CASHIER",
      status: "COMPLETED", paymentStatus: "PAID", fulfillmentStatus: "FULFILLED",
      customerName: input.customerName?.trim() ?? null,
      customerContact: null, note: input.note?.trim() ?? null,
      paymentMethod: paymentMethod as "CASH" | "QRIS" | "TRANSFER" | "EWALLET" | "OTHER",
      subtotal, discount: new Prisma.Decimal(0), deliveryFee, total,
      paidAmount, tracksInventory,
      postedAt: order.createdAt, cancelledAt: null,
      createdById: ctx.actorId, createdAt: order.createdAt, updatedAt: order.createdAt,
      lines: order.lines.map((l) => ({
        id: l.id,
        itemId: l.itemId, itemName: l.itemName,
        priceTierId: l.priceTierId, priceTierCode: l.priceTierCode, priceTierName: l.priceTierName,
        quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, subtotal: l.subtotal,
      })),
    })

    if (tracksInventory) {
      for (const createdLine of order.lines) {
        await tx.stockMovement.create({
          data: {
            tokoId: ctx.tokoId,
            itemId: createdLine.itemId,
            quantity: createdLine.quantity.negated(),
            movementType: "SALE",
            unitPrice: createdLine.unitPrice,
            sourceType: "Order",
            sourceId: order.id,
            sourceLineId: createdLine.id,
            dedupeKey: `ORDER_SALE_${idemDedupe || order.id}_${createdLine.id}`,
            createdById: ctx.actorId,
          },
        })
      }
    }

    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "checkout_order",
        entityType: "Order",
        entityId: order.id,
        metadata: { number, channel: "CASHIER", totalAmount: total.toString(), itemsCount: lines.length, tracksInventory, paymentMethod },
      },
    })

    if (idempotency) {
      await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "checkout", dto)
    }

    return { replayed: false as const, value: dto } satisfies TxResult<OrderDTO>
  })

  if (result.replayed) return result.body
  return result.value
}

export type CreateManualOrderInput = {
  customerName?: string
  customerContact?: string
  note?: string
  items: Array<{ productId: string; quantity: number; priceTierId?: string; customUnitPrice?: string | number }>
}

export async function createManualOrder(ctx: AuthContext, input: CreateManualOrderInput, idempotency?: { key: string; payload: unknown }): Promise<OrderDTO> {
  checkMaintenance()
  const idemHash = idempotency ? hashPayload(idempotency.payload) : undefined
  if (!input.items.length) throw new ValidationError("Order must have at least one item")

  const result = await prisma.$transaction(async (tx) => {
    if (idempotency && idemHash) {
      const res = await atomicReserveIdempotency(tx, ctx.tokoId, idempotency.key, "order_create", ctx.actorId, idemHash)
      if (res.replayed) return { replayed: true as const, body: res.body as OrderDTO } satisfies TxResult<OrderDTO>
    }

    const lines = await processCartLines(tx, ctx.tokoId, input.items)
    const number = await generateOrderNumber(tx, ctx.tokoId)
    const subtotal = lines.reduce((s, l) => s.plus(l.subtotal), new Prisma.Decimal(0))
    const order = await tx.order.create({
      data: {
        tokoId: ctx.tokoId,
        number,
        source: "MANUAL",
        channel: null,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        fulfillmentStatus: "UNFULFILLED",
        customerName: input.customerName?.trim() || undefined,
        customerContact: input.customerContact?.trim() || undefined,
        note: input.note?.trim() || undefined,
        subtotal,
        total: subtotal,
        tracksInventory: false,
        createdById: ctx.actorId,
        lines: {
          create: lines.map((l) => ({
            itemId: l.itemId, itemName: l.itemName,
            priceTierId: l.priceTierId, priceTierCode: l.priceTierCode, priceTierName: l.priceTierName,
            quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, subtotal: l.subtotal,
          })),
        },
      },
      include: { lines: true },
    })

    const dto = buildOrderDTO({
      id: order.id, tokoId: ctx.tokoId, number, source: "MANUAL", channel: null,
      status: "CONFIRMED", paymentStatus: "UNPAID", fulfillmentStatus: "UNFULFILLED",
      customerName: input.customerName?.trim() ?? null,
      customerContact: input.customerContact?.trim() ?? null,
      note: input.note?.trim() ?? null,
      paymentMethod: null,
      subtotal, discount: new Prisma.Decimal(0), deliveryFee: new Prisma.Decimal(0),
      total: subtotal, paidAmount: null,
      tracksInventory: false, postedAt: null, cancelledAt: null,
      createdById: ctx.actorId, createdAt: order.createdAt, updatedAt: order.updatedAt,
      lines: order.lines.map((l) => ({
        id: l.id, itemId: l.itemId, itemName: l.itemName,
        priceTierId: l.priceTierId, priceTierCode: l.priceTierCode, priceTierName: l.priceTierName,
        quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, subtotal: l.subtotal,
      })),
    })

    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId, actorId: ctx.actorId, action: "created_manual_order",
        entityType: "Order", entityId: order.id,
        metadata: { number, total: subtotal.toString(), itemsCount: lines.length },
      },
    })

    if (idempotency) {
      await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "order_create", dto)
    }

    return { replayed: false as const, value: dto } satisfies TxResult<OrderDTO>
  })

  if (result.replayed) return result.body
  return result.value
}

export type UpdatePaymentInput = {
  paymentStatus: string
  paymentMethod?: string
  paidAmount?: string | number
}

export async function updateOrderPayment(ctx: AuthContext, orderId: string, input: UpdatePaymentInput): Promise<OrderDTO> {
  checkMaintenance()
  const validStatus = ["UNPAID", "PARTIALLY_PAID", "PAID", "REFUNDED"]
  if (!validStatus.includes(input.paymentStatus)) throw new ValidationError("Invalid payment status")

  const order = await prisma.order.findFirst({ where: { id: orderId, tokoId: ctx.tokoId } })
  if (!order) throw new NotFoundError("Order not found")
  if (order.status === "CANCELLED") throw new ConflictError("Cannot update cancelled order")
  if (order.postedAt) throw new ConflictError("Cannot update payment on a posted order")

  const data: Record<string, unknown> = { paymentStatus: input.paymentStatus }
  if (input.paymentMethod) {
    const upper = input.paymentMethod.toUpperCase()
    if (!VALID_PAYMENT_METHODS.includes(upper as (typeof VALID_PAYMENT_METHODS)[number])) {
      throw new ValidationError(`Invalid payment method: ${input.paymentMethod}`)
    }
    data.paymentMethod = upper
  }
  if (input.paidAmount !== undefined) {
    const pa = new Prisma.Decimal(input.paidAmount)
    if (pa.isNegative()) throw new ValidationError("Paid amount must be non-negative")
    data.paidAmount = pa
  }

  await prisma.order.update({ where: { id: orderId }, data: data as Prisma.OrderUpdateInput })
  return getOrder(ctx, orderId)
}

export type UpdateFulfillmentInput = {
  fulfillmentStatus: string
}

export async function updateOrderFulfillment(ctx: AuthContext, orderId: string, input: UpdateFulfillmentInput): Promise<OrderDTO> {
  checkMaintenance()
  const validStatus = ["UNFULFILLED", "PROCESSING", "READY", "SHIPPED", "FULFILLED", "CANCELLED"]
  if (!validStatus.includes(input.fulfillmentStatus)) throw new ValidationError("Invalid fulfillment status")

  const order = await prisma.order.findFirst({ where: { id: orderId, tokoId: ctx.tokoId } })
  if (!order) throw new NotFoundError("Order not found")
  if (order.status === "CANCELLED") throw new ConflictError("Cannot update cancelled order")
  if (order.postedAt) throw new ConflictError("Cannot update fulfillment on a posted order")

  await prisma.order.update({ where: { id: orderId }, data: { fulfillmentStatus: input.fulfillmentStatus as "UNFULFILLED" | "PROCESSING" | "READY" | "SHIPPED" | "FULFILLED" | "CANCELLED" } })
  return getOrder(ctx, orderId)
}

export type CompleteOrderInput = {
  channel: string
  paymentMethod: string
  deliveryFee?: string | number
  paidAmount?: string | number
}

export async function completeOrder(ctx: AuthContext, orderId: string, input: CompleteOrderInput, idempotency?: { key: string; payload: unknown }): Promise<OrderDTO> {
  checkMaintenance()
  const idemHash = idempotency ? hashPayload(idempotency.payload) : undefined

  const toko = await prisma.toko.findUniqueOrThrow({
    where: { id: ctx.tokoId },
    select: { operationalMode: true },
  })
  const tracksInventory = toko.operationalMode !== "CASHIER_ONLY"

  const channelUpper = input.channel.toUpperCase()
  if (!VALID_CHANNELS.includes(channelUpper as (typeof VALID_CHANNELS)[number])) {
    throw new ValidationError(`Invalid channel: ${input.channel}`)
  }
  const paymentMethodUpper = input.paymentMethod.toUpperCase()
  if (!VALID_PAYMENT_METHODS.includes(paymentMethodUpper as (typeof VALID_PAYMENT_METHODS)[number])) {
    throw new ValidationError(`Invalid payment method: ${input.paymentMethod}`)
  }

  const deliveryFee = new Prisma.Decimal(input.deliveryFee ?? 0)
  if (deliveryFee.isNegative()) throw new ValidationError("Delivery fee must be non-negative")
  if (input.paidAmount !== undefined && new Prisma.Decimal(input.paidAmount).isNegative()) {
    throw new ValidationError("Paid amount must be non-negative")
  }

  return prisma.$transaction(async (tx) => {
    if (idempotency && idemHash) {
      const res = await atomicReserveIdempotency(tx, ctx.tokoId, idempotency.key, "order_complete", ctx.actorId, idemHash)
      if (res.replayed) return { replayed: true as const, body: res.body as OrderDTO } satisfies TxResult<OrderDTO>
    }

    const order = await tx.order.findFirst({
      where: { id: orderId, tokoId: ctx.tokoId },
      include: { lines: { include: { item: { select: { name: true } } } } },
    })
    if (!order) throw new NotFoundError("Order not found")

    // Idempotent replay: already completed
    if (order.status === "COMPLETED" && order.postedAt) {
      if (!idempotency) throw new ConflictError("Order is already posted")
      // Check if idempotency was previously stored; if not, store the current DTO
      if (idempotency) {
        const existingRecord = await tx.idempotencyRecord.findUnique({
          where: { tokoId_key_operation: { tokoId: ctx.tokoId, key: idempotency.key, operation: "order_complete" } },
        })
        if (!existingRecord || !existingRecord.responseRef) {
          const dto = toOrderDTO(order)
          await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "order_complete", dto)
        }
      }
      return { replayed: false as const, value: toOrderDTO(order) } satisfies TxResult<OrderDTO>
    }

    // Atomic conditional state update
    if (order.postedAt) throw new ConflictError("Order is already posted")
    if (order.status === "CANCELLED") throw new ConflictError("Cannot complete cancelled order")

    const now = new Date()
    const updateResult = await tx.order.updateMany({
      where: { id: orderId, postedAt: null, status: { not: "CANCELLED" } },
      data: {
        channel: channelUpper as "CASHIER" | "RESELLER" | "ONLINE",
        status: "COMPLETED",
        paymentStatus: "PAID",
        fulfillmentStatus: "FULFILLED",
        paymentMethod: paymentMethodUpper as "CASH" | "QRIS" | "TRANSFER" | "EWALLET" | "OTHER",
        deliveryFee,
        total: order.subtotal.plus(deliveryFee),
        paidAmount: new Prisma.Decimal(input.paidAmount ?? order.subtotal.plus(deliveryFee)),
        tracksInventory,
        postedAt: now,
      },
    })
    if (updateResult.count === 0) {
      // Re-read to give accurate error
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, postedAt: true } })
      if (!current) throw new NotFoundError("Order not found")
      if (current.postedAt) throw new ConflictError("Order is already posted")
      if (current.status === "CANCELLED") throw new ConflictError("Cannot complete cancelled order")
      throw new ConflictError("Order cannot be completed")
    }

    const idemDedupe = idempotency ? idempotency.key.slice(0, 12) : order.id

    if (tracksInventory) {
      for (const line of order.lines) {
        const result = await tx.stockBalance.updateMany({
          where: { itemId: line.itemId, quantity: { gte: line.quantity } },
          data: { quantity: { decrement: line.quantity }, version: { increment: 1 } },
        })
        if (result.count === 0) {
          const balance = await tx.stockBalance.findUnique({ where: { itemId: line.itemId } })
          const avail = balance?.quantity.toString() ?? "0"
          throw new ConflictError(`Insufficient stock for ${line.itemName}: need ${line.quantity}, have ${avail}`)
        }
      }
    }

    if (tracksInventory) {
      for (const line of order.lines) {
        await tx.stockMovement.create({
          data: {
            tokoId: ctx.tokoId,
            itemId: line.itemId,
            quantity: line.quantity.negated(),
            movementType: "SALE",
            unitPrice: line.unitPrice,
            sourceType: "Order",
            sourceId: order.id,
            sourceLineId: line.id,
            dedupeKey: `ORDER_SALE_${idemDedupe}_${line.id}`,
            createdById: ctx.actorId,
          },
        })
      }
    }

    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "completed_order",
        entityType: "Order",
        entityId: order.id,
        metadata: { number: order.number, channel: channelUpper, paymentMethod: paymentMethodUpper },
      },
    })

    const total = order.subtotal.plus(deliveryFee)
    const paidAmount = new Prisma.Decimal(input.paidAmount ?? total)
    if (paidAmount.lessThan(total)) throw new ValidationError("Paid amount must cover the order total")
    const completeDto = buildOrderDTO({
      id: order.id, tokoId: ctx.tokoId, number: order.number,
      source: order.source, channel: channelUpper,
      status: "COMPLETED", paymentStatus: "PAID", fulfillmentStatus: "FULFILLED",
      customerName: order.customerName, customerContact: order.customerContact,
      note: order.note, paymentMethod: paymentMethodUpper,
      subtotal: order.subtotal, discount: order.discount, deliveryFee,
      total, paidAmount,
      tracksInventory, postedAt: now, cancelledAt: order.cancelledAt,
      createdById: order.createdById, createdAt: order.createdAt, updatedAt: now,
      lines: order.lines.map((l) => ({
        id: l.id, itemId: l.itemId, itemName: l.itemName,
        priceTierId: l.priceTierId, priceTierCode: l.priceTierCode, priceTierName: l.priceTierName,
        quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, subtotal: l.subtotal,
      })),
    })

    if (idempotency) {
      await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "order_complete", completeDto)
    }

    return { replayed: false as const, value: completeDto } satisfies TxResult<OrderDTO>
  }).then((result) => {
    if (result.replayed) return result.body
    return result.value
  })
}

export async function cancelOrder(ctx: AuthContext, orderId: string, idempotency?: { key: string; payload: unknown }): Promise<OrderDTO> {
  checkMaintenance()
  const idemHash = idempotency ? hashPayload(idempotency.payload) : undefined

  if (ctx.role !== "OWNER") {
    // Check if posted — only owner can cancel posted
    const preCheck = await prisma.order.findUnique({ where: { id: orderId, tokoId: ctx.tokoId }, select: { postedAt: true, status: true } })
    if (!preCheck) throw new NotFoundError("Order not found")
    if (preCheck.postedAt) throw new ForbiddenError("Only owner can cancel posted orders")
  }

  return prisma.$transaction(async (tx) => {
    if (idempotency && idemHash) {
      const res = await atomicReserveIdempotency(tx, ctx.tokoId, idempotency.key, "order_cancel", ctx.actorId, idemHash)
      if (res.replayed) return { replayed: true as const, body: res.body as OrderDTO } satisfies TxResult<OrderDTO>
    }

    const order = await tx.order.findFirst({
      where: { id: orderId, tokoId: ctx.tokoId },
      include: { lines: { include: { item: { select: { name: true } } } } },
    })
    if (!order) throw new NotFoundError("Order not found")

    // Idempotent replay: already cancelled
    if (order.status === "CANCELLED") {
      if (!idempotency) throw new ConflictError("Order is already cancelled")
      if (idempotency) {
        const existingRecord = await tx.idempotencyRecord.findUnique({
          where: { tokoId_key_operation: { tokoId: ctx.tokoId, key: idempotency.key, operation: "order_cancel" } },
        })
        if (!existingRecord || !existingRecord.responseRef) {
          const dto = toOrderDTO(order)
          await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "order_cancel", dto)
        }
      }
      return { replayed: false as const, value: toOrderDTO(order) } satisfies TxResult<OrderDTO>
    }

    if (order.postedAt && ctx.role !== "OWNER") {
      throw new ForbiddenError("Only owner can cancel posted orders")
    }

    const isPosted = !!order.postedAt
    const idemDedupe = idempotency ? idempotency.key.slice(0, 12) : order.id
    const now = new Date()

    // Atomic conditional state update
    const updateResult = await tx.order.updateMany({
      where: { id: orderId, status: { not: "CANCELLED" } },
      data: {
        status: "CANCELLED",
        paymentStatus: isPosted ? "REFUNDED" : "UNPAID",
        fulfillmentStatus: "CANCELLED",
        cancelledAt: now,
      },
    })
    if (updateResult.count === 0) {
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } })
      if (!current) throw new NotFoundError("Order not found")
      if (current.status === "CANCELLED") throw new ConflictError("Order is already cancelled")
      throw new ConflictError("Order cannot be cancelled")
    }

    if (isPosted && order.tracksInventory) {
      for (const line of order.lines) {
        await tx.stockBalance.updateMany({
          where: { itemId: line.itemId },
          data: { quantity: { increment: line.quantity }, version: { increment: 1 } },
        })

        const existingReversal = await tx.stockMovement.findFirst({
          where: { sourceType: "Order", sourceId: order.id, sourceLineId: line.id, movementType: "REVERSAL" },
        })
        if (existingReversal) continue

        const originalMovement = await tx.stockMovement.findFirst({
          where: { sourceType: "Order", sourceId: order.id, sourceLineId: line.id, movementType: "SALE" },
          orderBy: { createdAt: "asc" },
        })

        await tx.stockMovement.create({
          data: {
            tokoId: ctx.tokoId,
            itemId: line.itemId,
            quantity: line.quantity,
            movementType: "REVERSAL",
            sourceType: "Order",
            sourceId: order.id,
            sourceLineId: line.id,
            dedupeKey: `ORDER_REV_${idemDedupe}_${line.id}`,
            reversalOfId: originalMovement?.id ?? null,
            createdById: ctx.actorId,
            note: `Reversal of cancelled order ${order.number}`,
          },
        })
      }
    }

    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "cancelled_order",
        entityType: "Order",
        entityId: order.id,
        metadata: { number: order.number, wasPosted: isPosted },
      },
    })

    const cancelDto = buildOrderDTO({
      id: order.id, tokoId: ctx.tokoId, number: order.number,
      source: order.source, channel: order.channel,
      status: "CANCELLED",
      paymentStatus: isPosted ? "REFUNDED" : "UNPAID",
      fulfillmentStatus: "CANCELLED",
      customerName: order.customerName, customerContact: order.customerContact,
      note: order.note, paymentMethod: order.paymentMethod,
      subtotal: order.subtotal, discount: order.discount,
      deliveryFee: order.deliveryFee, total: order.total,
      paidAmount: order.paidAmount,
      tracksInventory: order.tracksInventory, postedAt: order.postedAt,
      cancelledAt: now,
      createdById: order.createdById, createdAt: order.createdAt, updatedAt: now,
      lines: order.lines.map((l) => ({
        id: l.id, itemId: l.itemId, itemName: l.itemName,
        priceTierId: l.priceTierId, priceTierCode: l.priceTierCode, priceTierName: l.priceTierName,
        quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, subtotal: l.subtotal,
      })),
    })

    if (idempotency) {
      await atomicCompleteIdempotency(tx, ctx.tokoId, idempotency.key, "order_cancel", cancelDto)
    }

    return { replayed: false as const, value: cancelDto } satisfies TxResult<OrderDTO>
  }).then((result) => {
    if (result.replayed) return result.body
    return result.value
  })
}

async function generateOrderNumber(tx: PrismaTx, tokoId: string): Promise<string> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`order-number:${tokoId}`}, 0))::text AS locked`
  const rows = await tx.$queryRawUnsafe<Array<{ number: string }>>(
    `SELECT number FROM "Order" WHERE "tokoId" = $1 ORDER BY number DESC LIMIT 1 FOR UPDATE`,
    tokoId
  )
  const next = rows.length > 0 ? parseInt(rows[0].number.replace("ORD-", ""), 10) + 1 : 1
  return `ORD-${String(next).padStart(4, "0")}`
}

function buildOrderDTO(params: {
  id: string
  tokoId: string
  number: string
  source: string
  channel: string | null
  status: string
  paymentStatus: string
  fulfillmentStatus: string
  customerName?: string | null
  customerContact?: string | null
  note?: string | null
  paymentMethod?: string | null
  subtotal: Prisma.Decimal
  discount: Prisma.Decimal
  deliveryFee: Prisma.Decimal
  total: Prisma.Decimal
  paidAmount?: Prisma.Decimal | null
  tracksInventory: boolean
  postedAt?: Date | null
  cancelledAt?: Date | null
  createdById: string
  createdAt: Date
  updatedAt: Date
  lines: Array<{
    id: string
    itemId: string
    itemName: string
    priceTierId: string | null
    priceTierCode: string | null
    priceTierName: string | null
    quantity: Prisma.Decimal | string
    unit: string
    unitPrice: Prisma.Decimal | string
    subtotal: Prisma.Decimal | string
  }>
}): OrderDTO {
  return {
    id: params.id,
    tokoId: params.tokoId,
    number: params.number,
    source: params.source,
    channel: params.channel ?? null,
    status: params.status,
    paymentStatus: params.paymentStatus,
    fulfillmentStatus: params.fulfillmentStatus,
    customerName: params.customerName ?? null,
    customerContact: params.customerContact ?? null,
    note: params.note ?? null,
    paymentMethod: params.paymentMethod ?? null,
    subtotal: params.subtotal.toString(),
    discount: params.discount.toString(),
    deliveryFee: params.deliveryFee.toString(),
    total: params.total.toString(),
    paidAmount: params.paidAmount?.toString() ?? null,
    tracksInventory: params.tracksInventory,
    postedAt: params.postedAt?.toISOString() ?? null,
    cancelledAt: params.cancelledAt?.toISOString() ?? null,
    createdById: params.createdById,
    createdAt: params.createdAt.toISOString(),
    updatedAt: params.updatedAt.toISOString(),
    lines: params.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      itemName: l.itemName,
      priceTierId: l.priceTierId,
      priceTierCode: l.priceTierCode,
      priceTierName: l.priceTierName,
      quantity: typeof l.quantity === "string" ? l.quantity : l.quantity.toString(),
      unit: l.unit,
      unitPrice: typeof l.unitPrice === "string" ? l.unitPrice : l.unitPrice.toString(),
      subtotal: typeof l.subtotal === "string" ? l.subtotal : l.subtotal.toString(),
    })),
  }
}

function toOrderDTO(o: Prisma.OrderGetPayload<{ include: { lines: { include: { item: { select: { name: true } } } } } }>): OrderDTO {
  return {
    id: o.id,
    tokoId: o.tokoId,
    number: o.number,
    source: o.source,
    channel: o.channel ?? null,
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    customerName: o.customerName ?? null,
    customerContact: o.customerContact ?? null,
    note: o.note ?? null,
    paymentMethod: o.paymentMethod ?? null,
    subtotal: o.subtotal.toString(),
    discount: o.discount.toString(),
    deliveryFee: o.deliveryFee.toString(),
    total: o.total.toString(),
    paidAmount: o.paidAmount?.toString() ?? null,
    tracksInventory: o.tracksInventory,
    postedAt: o.postedAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    createdById: o.createdById,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    lines: o.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      itemName: l.itemName ?? l.item.name,
      priceTierId: l.priceTierId,
      priceTierCode: l.priceTierCode,
      priceTierName: l.priceTierName,
      quantity: l.quantity.toString(),
      unit: l.unit,
      unitPrice: l.unitPrice.toString(),
      subtotal: l.subtotal.toString(),
    })),
  }
}
