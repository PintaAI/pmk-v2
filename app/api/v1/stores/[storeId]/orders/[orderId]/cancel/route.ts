import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { cancelOrder } from "@/server/domain/orders/order-service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ storeId: string; orderId: string }> }) {
  try {
    checkMaintenance()
    const idempotencyKey = _req.headers.get("Idempotency-Key")
    const { storeId, orderId } = await params
    const ctx = await requireStoreMembership(storeId)
    const order = await cancelOrder(ctx, orderId, idempotencyKey ? { key: idempotencyKey, payload: { orderId } } : undefined)
    return apiSuccess(order)
  } catch (e) {
    return handleApiError(e)
  }
}
