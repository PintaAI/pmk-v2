import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { getProduction } from "@/server/domain/production/production-service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storeId: string; productionId: string }> }) {
  try {
    const { storeId, productionId } = await params
    const ctx = await requireStoreMembership(storeId)
    const production = await getProduction(ctx, productionId)
    return apiSuccess(production)
  } catch (e) {
    return handleApiError(e)
  }
}
