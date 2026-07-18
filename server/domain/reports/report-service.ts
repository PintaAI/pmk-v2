import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import type { AuthContext } from "@/server/domain/types"

export interface SummaryAnalytics {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  totalSales: number
}

export interface MonthlyAnalytics {
  month: string
  year: number
  monthLabel: string
  revenue: number
  expenses: number
  profit: number
}

export interface ChannelAnalytics {
  channel: string
  total: number
  count: number
  percentage: number
}

export interface ProductAnalytics {
  productId: string
  productName: string
  total: number
  qty: number
}

export interface DayAnalytics {
  date: string
  revenue: number
  expenses: number
  profit: number
}

export interface AnalyticsDTO {
  summary: SummaryAnalytics
  monthly: MonthlyAnalytics[]
  byChannel: ChannelAnalytics[]
  topProducts: ProductAnalytics[]
  byDay: DayAnalytics[]
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function toNumber(value: unknown): number {
  if (value == null) return 0
  return Number(value)
}

export async function getAnalytics(
  ctx: AuthContext,
  dateFilter?: { fromDate?: Date; toDate?: Date },
): Promise<AnalyticsDTO> {
  const orderWhere = (dateFilter?.fromDate || dateFilter?.toDate)
    ? {
        tokoId: ctx.tokoId, status: "COMPLETED" as const,
        ...(dateFilter?.fromDate ? { postedAt: { gte: dateFilter.fromDate } } : {}),
        ...(dateFilter?.toDate ? { postedAt: { ...(dateFilter?.fromDate ? { gte: dateFilter.fromDate } : {}), lte: dateFilter.toDate } } : {}),
      }
    : { tokoId: ctx.tokoId, status: "COMPLETED" as const }

  const purchaseWhere = (dateFilter?.fromDate || dateFilter?.toDate)
    ? {
        tokoId: ctx.tokoId, status: "COMPLETED" as const,
        date: { ...(dateFilter?.fromDate ? { gte: dateFilter.fromDate } : {}), ...(dateFilter?.toDate ? { lte: dateFilter.toDate } : {}) },
      }
    : { tokoId: ctx.tokoId, status: "COMPLETED" as const }

  const [orderAgg, purchaseAgg, monthlyOrders, monthlyPurchases, channelData, productData, dailyOrders, dailyPurchases] =
    await Promise.all([
      prisma.order.aggregate({
        where: orderWhere,
        _sum: { total: true },
        _count: true,
      }),
      prisma.purchase.aggregate({
        where: purchaseWhere,
        _sum: { totalAmount: true },
      }),
      prisma.order.findMany({
        where: orderWhere,
        select: { postedAt: true, total: true },
        orderBy: { postedAt: "asc" },
      }),
      prisma.purchase.findMany({
        where: purchaseWhere,
        select: { date: true, totalAmount: true },
        orderBy: { date: "asc" },
      }),
      prisma.order.groupBy({
        by: ["channel"],
        where: orderWhere,
        _sum: { total: true },
        _count: true,
      }),
      prisma.orderLine.findMany({
        where: { order: orderWhere },
        select: { itemId: true, itemName: true, subtotal: true, quantity: true },
      }),
      prisma.order.findMany({
        where: orderWhere,
        select: { postedAt: true, total: true },
      }),
      prisma.purchase.findMany({
        where: purchaseWhere,
        select: { date: true, totalAmount: true },
      }),
    ])

  const totalRevenue = toNumber(orderAgg._sum.total)
  const totalExpenses = toNumber(purchaseAgg._sum.totalAmount)

  const monthMap = new Map<string, { revenue: number; expenses: number }>()
  for (const order of monthlyOrders) {
    const ts = order.postedAt!
    const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`
    const entry = monthMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry.revenue += toNumber(order.total)
    monthMap.set(key, entry)
  }
  for (const purchase of monthlyPurchases) {
    const key = `${purchase.date.getFullYear()}-${String(purchase.date.getMonth() + 1).padStart(2, "0")}`
    const entry = monthMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry.expenses += toNumber(purchase.totalAmount)
    monthMap.set(key, entry)
  }

  const monthly = Array.from(monthMap.entries())
    .map(([key, data]) => {
      const [yearStr, monthStr] = key.split("-")
      const year = Number(yearStr)
      const month = Number(monthStr)
      return { month: key, year, monthLabel: `${monthNames[month - 1]} ${year}`, revenue: data.revenue, expenses: data.expenses, profit: data.revenue - data.expenses }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  const grandTotalForChannel = channelData.reduce((sum, c) => sum + toNumber(c._sum.total), 0)
  const byChannel = channelData.map((c) => ({
    channel: c.channel ?? "UNKNOWN",
    total: toNumber(c._sum.total),
    count: c._count,
    percentage: grandTotalForChannel > 0 ? (toNumber(c._sum.total) / grandTotalForChannel) * 100 : 0,
  }))

  const productMap = new Map<string, { name: string; total: number; qty: number }>()
  for (const item of productData) {
    const existing = productMap.get(item.itemId) ?? { name: item.itemName, total: 0, qty: 0 }
    existing.total += toNumber(item.subtotal)
    existing.qty += toNumber(item.quantity)
    productMap.set(item.itemId, existing)
  }
  const topProducts = Array.from(productMap.entries())
    .map(([productId, data]) => ({ productId, productName: data.name, total: data.total, qty: data.qty }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const dayMap = new Map<string, { revenue: number; expenses: number }>()
  for (const order of dailyOrders) {
    const ts = order.postedAt!
    const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")}`
    const entry = dayMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry.revenue += toNumber(order.total)
    dayMap.set(key, entry)
  }
  for (const purchase of dailyPurchases) {
    const key = `${purchase.date.getFullYear()}-${String(purchase.date.getMonth() + 1).padStart(2, "0")}-${String(purchase.date.getDate()).padStart(2, "0")}`
    const entry = dayMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry.expenses += toNumber(purchase.totalAmount)
    dayMap.set(key, entry)
  }
  const byDay = Array.from(dayMap.entries())
    .map(([date, data]) => ({ date, revenue: data.revenue, expenses: data.expenses, profit: data.revenue - data.expenses }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    summary: { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses, totalSales: orderAgg._count },
    monthly,
    byChannel,
    topProducts,
    byDay,
  }
}

type ActivityEntry = {
  id: string
  tokoId: string
  actorId: string
  action: string
  entityType: string
  entityId: string | null
  metadata: Prisma.JsonValue | null
  createdAt: string
}

export async function listActivity(
  ctx: AuthContext,
  query: { limit?: number; cursor?: { createdAt: Date; id: string } },
): Promise<{ items: ActivityEntry[]; nextCursor?: string }> {
  const limit = query.limit ?? 50
  const where: Prisma.ActivityLogWhereInput = { tokoId: ctx.tokoId }
  const extendedWhere: Prisma.ActivityLogWhereInput = { ...where }

  if (query.cursor) {
    extendedWhere.OR = [
      { createdAt: { lt: query.cursor.createdAt } },
      { AND: [{ createdAt: query.cursor.createdAt }, { id: { lt: query.cursor.id } }] },
    ]
  }

  const logs = await prisma.activityLog.findMany({
    where: extendedWhere,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  })

  const hasMore = logs.length > limit
  const items = logs.slice(0, limit)

  return {
    items: items.map((l) => ({
      id: l.id,
      tokoId: l.tokoId,
      actorId: l.actorId,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    })),
    nextCursor: hasMore && items.length > 0
      ? Buffer.from(JSON.stringify({ createdAt: items[items.length - 1].createdAt, id: items[items.length - 1].id })).toString("base64url")
      : undefined,
  }
}

type DashboardData = {
  periodDays: number
  totalRevenue: string
  totalExpenses: string
  totalOrders: number
  netProfit: string
  pendingOrders: Array<{ id: string; number: string; customerName: string | null; total: string; createdAt: string }>
  recentActivity: Array<{ id: string; number: string; status: string; total: string; createdAt: string }>
}

export async function getDashboard(ctx: AuthContext): Promise<DashboardData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [orderStats, purchaseTotal, pendingOrders, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { tokoId: ctx.tokoId, status: "COMPLETED", postedAt: { gte: thirtyDaysAgo } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.purchase.aggregate({
      where: { tokoId: ctx.tokoId, date: { gte: thirtyDaysAgo }, status: "COMPLETED" },
      _sum: { totalAmount: true },
    }),
    prisma.order.findMany({
      where: { tokoId: ctx.tokoId, status: "CONFIRMED" },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, customerName: true, total: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { tokoId: ctx.tokoId },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, status: true, total: true, createdAt: true },
    }),
  ])

  return {
    periodDays: 30,
    totalRevenue: orderStats._sum.total?.toString() ?? "0",
    totalExpenses: purchaseTotal._sum.totalAmount?.toString() ?? "0",
    totalOrders: orderStats._count,
    netProfit: new Prisma.Decimal(orderStats._sum.total ?? 0).minus(purchaseTotal._sum.totalAmount ?? 0).toString(),
    pendingOrders: pendingOrders.map((o) => ({ id: o.id, number: o.number, customerName: o.customerName, total: o.total.toString(), createdAt: o.createdAt.toISOString() })),
    recentActivity: recentOrders.map((o) => ({ id: o.id, number: o.number, status: o.status, total: o.total.toString(), createdAt: o.createdAt.toISOString() })),
  }
}
