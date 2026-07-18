// Backward-compatible thin adapter that delegates to the shared report service.
import type {
  MonthlyAnalytics,
  ChannelAnalytics,
  ProductAnalytics,
  DayAnalytics,
} from "@/server/domain/reports/report-service"

export type AnalyticsData = {
  summary: { totalRevenue: number; totalExpenses: number; netProfit: number; totalSales: number }
  monthly: MonthlyAnalytics[]
  byChannel: ChannelAnalytics[]
  topProducts: ProductAnalytics[]
  byDay: DayAnalytics[]
}

export type { MonthlyAnalytics, ChannelAnalytics, ProductAnalytics, DayAnalytics }

// Legacy compatibility export — prefer getAnalytics with AuthContext
export async function fetchAnalytics(tokoId: string) {
  const { getAnalytics } = await import("@/server/domain/reports/report-service")
  return getAnalytics({ actorId: "legacy", tokoId, role: "OWNER" })
}
