import { prisma } from "@/lib/prisma"

type ClosingRecap = {
  toko: { name: string; imageUrl: string | null; receiptLogoUrl: string | null; address: string | null; phone: string | null }
  dateLabel: string
  startedAt: string
  endedAt: string
  closedAt: string
  cashierName: string
  totalTransactions: number
  totalItems: number
  grossTotal: number
  totalDiscount: number
  netTotal: number
  paymentBreakdown: Record<string, number>
  channelBreakdown: Record<string, number>
  topItems: Array<{ productId: string; name: string; qty: number; total: number }>
}

export async function getDailyClosing(ctx: { actorId: string; tokoId: string }, date?: string): Promise<ClosingRecap> {
  const { start, end, label } = getJakartaDayRange(date ? new Date(date) : new Date())

  const [toko, user, orders] = await Promise.all([
    prisma.toko.findUniqueOrThrow({
      where: { id: ctx.tokoId },
      select: { name: true, imageUrl: true, receiptLogoUrl: true, address: true, phone: true },
    }),
    prisma.user.findUnique({
      where: { id: ctx.actorId },
      select: { name: true, email: true },
    }),
    prisma.order.findMany({
      where: {
        tokoId: ctx.tokoId,
        status: "COMPLETED",
        createdAt: { gte: start, lt: end },
      },
      include: { lines: { include: { item: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const paymentBreakdown: Record<string, number> = { CASH: 0, QRIS: 0, TRANSFER: 0, EWALLET: 0, OTHER: 0 }
  const channelBreakdown: Record<string, number> = {}
  const itemSummary = new Map<string, { productId: string; name: string; qty: number; total: number }>()

  let grossTotal = 0
  let totalItems = 0

  for (const order of orders) {
    const orderTotal = Number(order.total)
    grossTotal += orderTotal

    const channel = order.channel ?? "UNKNOWN"
    channelBreakdown[channel] = (channelBreakdown[channel] ?? 0) + orderTotal

    const pm = order.paymentMethod ?? "OTHER"
    paymentBreakdown[pm] = (paymentBreakdown[pm] ?? 0) + orderTotal

    for (const line of order.lines) {
      const qty = Number(line.quantity)
      const subtotal = Number(line.subtotal)
      totalItems += qty

      const current = itemSummary.get(line.itemId) ?? {
        productId: line.itemId,
        name: line.itemName,
        qty: 0,
        total: 0,
      }
      current.qty += qty
      current.total += subtotal
      itemSummary.set(line.itemId, current)
    }
  }

  return {
    toko,
    dateLabel: label,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    closedAt: new Date().toISOString(),
    cashierName: user?.name || user?.email || "Cashier",
    totalTransactions: orders.length,
    totalItems,
    grossTotal,
    totalDiscount: 0,
    netTotal: grossTotal,
    paymentBreakdown,
    channelBreakdown,
    topItems: Array.from(itemSummary.values())
      .sort((a, b) => b.qty - a.qty || b.total - a.total)
      .slice(0, 5),
  }
}

export async function logClosingPrint(ctx: { actorId: string; tokoId: string }): Promise<void> {
  const recap = await getDailyClosing(ctx)
  await prisma.activityLog.create({
    data: {
      tokoId: ctx.tokoId,
      actorId: ctx.actorId,
      action: "printed_closingan",
      entityType: "Closingan",
      metadata: {
        dateLabel: recap.dateLabel,
        totalTransactions: recap.totalTransactions,
        totalItems: recap.totalItems,
        grossTotal: recap.grossTotal,
        netTotal: recap.netTotal,
      },
    },
  })
}

function getJakartaDayRange(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(now)
  const year = Number(parts.find((p) => p.type === "year")?.value)
  const month = Number(parts.find((p) => p.type === "month")?.value)
  const day = Number(parts.find((p) => p.type === "day")?.value)

  const start = new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0))
  const end = new Date(Date.UTC(year, month - 1, day + 1, -7, 0, 0, 0))
  const label = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
  }).format(now)

  return { start, end, label }
}
