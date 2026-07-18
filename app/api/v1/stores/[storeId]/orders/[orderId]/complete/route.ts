import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { completeOrder } from "@/server/domain/orders/order-service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string; orderId: string }> }) {
  try {
    checkMaintenance()
    const idempotencyKey = req.headers.get("Idempotency-Key")
    const { storeId, orderId } = await params
    const ctx = await requireStoreMembership(storeId)
    const body = await req.json()
    const order = await completeOrder(ctx, orderId, body, idempotencyKey ? { key: idempotencyKey, payload: body } : undefined)
    return apiSuccess(order)
  } catch (e) {
    return handleApiError(e)
  }
}
