import { prisma } from "@/lib/prisma"

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

export interface AnalyticsData {
  summary: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    totalSales: number
  }
  monthly: MonthlyAnalytics[]
  byChannel: ChannelAnalytics[]
  topProducts: ProductAnalytics[]
  byDay: { date: string; revenue: number; expenses: number; profit: number }[]
}

function toNumber(value: unknown): number {
  if (value == null) return 0
  return Number(value)
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export async function fetchAnalytics(tokoId: string): Promise<AnalyticsData> {
  const baseFilter = { tokoId, status: "COMPLETED" as const }

  const [salesAgg, belanjaAgg, monthlySales, monthlyBelanja, channelData, productData, dailySales, dailyBelanja] =
    await Promise.all([
      prisma.sale.aggregate({
        where: baseFilter,
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.belanja.aggregate({
        where: baseFilter,
        _sum: { totalAmount: true },
      }),
      prisma.sale.findMany({
        where: baseFilter,
        select: { date: true, totalAmount: true },
        orderBy: { date: "asc" },
      }),
      prisma.belanja.findMany({
        where: baseFilter,
        select: { date: true, totalAmount: true },
        orderBy: { date: "asc" },
      }),
      prisma.sale.groupBy({
        by: ["channel"],
        where: baseFilter,
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.saleItem.findMany({
        where: { sale: baseFilter },
        select: {
          productId: true,
          product: { select: { name: true } },
          subtotal: true,
          qty: true,
        },
      }),
      prisma.sale.findMany({
        where: baseFilter,
        select: { date: true, totalAmount: true },
      }),
      prisma.belanja.findMany({
        where: baseFilter,
        select: { date: true, totalAmount: true },
      }),
    ])

  const totalRevenue = toNumber(salesAgg._sum.totalAmount)
  const totalExpenses = toNumber(belanjaAgg._sum.totalAmount)
  const totalSales = salesAgg._count

  const monthMap = new Map<string, { revenue: number; expenses: number }>()

  for (const sale of monthlySales) {
    const key = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}`
    const entry = monthMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry.revenue += toNumber(sale.totalAmount)
    monthMap.set(key, entry)
  }

  for (const belanja of monthlyBelanja) {
    const key = `${belanja.date.getFullYear()}-${String(belanja.date.getMonth() + 1).padStart(2, "0")}`
    const entry = monthMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry.expenses += toNumber(belanja.totalAmount)
    monthMap.set(key, entry)
  }

  const monthly = Array.from(monthMap.entries())
    .map(([key, data]) => {
      const [yearStr, monthStr] = key.split("-")
      const year = Number(yearStr)
      const month = Number(monthStr)
      return {
        month: key,
        year,
        monthLabel: `${monthNames[month - 1]} ${year}`,
        revenue: data.revenue,
        expenses: data.expenses,
        profit: data.revenue - data.expenses,
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  const grandTotalForChannel = channelData.reduce(
    (sum, c) => sum + toNumber(c._sum.totalAmount),
    0,
  )

  const byChannel: ChannelAnalytics[] = channelData.map((c) => ({
    channel: c.channel,
    total: toNumber(c._sum.totalAmount),
    count: c._count,
    percentage: grandTotalForChannel > 0 ? (toNumber(c._sum.totalAmount) / grandTotalForChannel) * 100 : 0,
  }))

  const productMap = new Map<string, { name: string; total: number; qty: number }>()
  for (const item of productData) {
    const existing = productMap.get(item.productId) ?? {
      name: item.product.name,
      total: 0,
      qty: 0,
    }
    existing.total += toNumber(item.subtotal)
    existing.qty += toNumber(item.qty)
    productMap.set(item.productId, existing)
  }

  const topProducts: ProductAnalytics[] = Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      total: data.total,
      qty: data.qty,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const dayMap = new Map<string, { revenue: number; expenses: number }>()
  for (const sale of dailySales) {
    const key = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}-${String(sale.date.getDate()).padStart(2, "0")}`
    const entry = dayMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry.revenue += toNumber(sale.totalAmount)
    dayMap.set(key, entry)
  }
  for (const belanja of dailyBelanja) {
    const key = `${belanja.date.getFullYear()}-${String(belanja.date.getMonth() + 1).padStart(2, "0")}-${String(belanja.date.getDate()).padStart(2, "0")}`
    const entry = dayMap.get(key) ?? { revenue: 0, expenses: 0 }
    entry.expenses += toNumber(belanja.totalAmount)
    dayMap.set(key, entry)
  }

  const byDay = Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      expenses: data.expenses,
      profit: data.revenue - data.expenses,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    summary: {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalSales,
    },
    monthly,
    byChannel,
    topProducts,
    byDay,
  }
}
