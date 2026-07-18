import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { getAnalytics } from "@/server/domain/reports/report-service"
import { validateDateFilter } from "@/scripts/migration-lib"

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)

    const url = new URL(req.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")

    const dateResult = validateDateFilter({ from, to })
    if ("error" in dateResult) {
      return apiSuccess({ summary: { totalRevenue: 0, totalExpenses: 0, netProfit: 0, totalSales: 0 }, monthly: [], byChannel: [], topProducts: [], byDay: [] })
    }

    const analytics = await getAnalytics(ctx, { fromDate: dateResult.fromDate, toDate: dateResult.toDate })
    return apiSuccess(analytics)
  } catch (e) {
    return handleApiError(e)
  }
}
