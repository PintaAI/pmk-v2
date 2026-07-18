import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { getOrder } from "@/server/domain/orders/order-service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storeId: string; orderId: string }> }) {
  try {
    const { storeId, orderId } = await params
    const ctx = await requireStoreMembership(storeId)
    const order = await getOrder(ctx, orderId)
    return apiSuccess(order)
  } catch (e) {
    return handleApiError(e)
  }
}
