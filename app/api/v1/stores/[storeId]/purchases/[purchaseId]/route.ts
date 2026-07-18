import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { getPurchase } from "@/server/domain/purchases/purchase-service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storeId: string; purchaseId: string }> }) {
  try {
    const { storeId, purchaseId } = await params
    const ctx = await requireStoreMembership(storeId)
    const purchase = await getPurchase(ctx, purchaseId)
    return apiSuccess(purchase)
  } catch (e) {
    return handleApiError(e)
  }
}
