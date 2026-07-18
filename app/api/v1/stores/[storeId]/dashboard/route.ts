import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { getDashboard } from "@/server/domain/reports/report-service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const dashboard = await getDashboard(ctx)
    return apiSuccess(dashboard)
  } catch (e) {
    return handleApiError(e)
  }
}
