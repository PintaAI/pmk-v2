import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { updateOrderPayment } from "@/server/domain/orders/order-service"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ storeId: string; orderId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, orderId } = await params
    const ctx = await requireStoreMembership(storeId)
    const body = await req.json()
    const order = await updateOrderPayment(ctx, orderId, body)
    return apiSuccess(order)
  } catch (e) {
    return handleApiError(e)
  }
}
