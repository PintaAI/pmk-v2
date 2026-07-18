import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { postAdjustment } from "@/server/domain/inventory/inventory-service"
import { ValidationError } from "@/server/domain/errors"

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const idempotencyKey = req.headers.get("Idempotency-Key")
    const { storeId } = await params
    const ctx = await requireStoreOwner(storeId)
    const body = await req.json()
    if (!body.itemId || body.quantity === undefined || !body.reason) {
      throw new ValidationError("itemId, quantity, and reason are required")
    }

    const movement = await postAdjustment(
      ctx, body,
      idempotencyKey ? { key: idempotencyKey, payload: body } : undefined,
    )
    return apiSuccess(movement)
  } catch (e) {
    return handleApiError(e)
  }
}
