import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { upsertItemUnitConversions } from "@/server/domain/items/item-service"
import { ValidationError } from "@/server/domain/errors"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ storeId: string; itemId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, itemId } = await params
    const ctx = await requireStoreMembership(storeId)
    const { conversions } = await req.json()
    if (!Array.isArray(conversions)) throw new ValidationError("conversions must be an array")
    const item = await upsertItemUnitConversions(ctx, itemId, conversions)
    return apiSuccess(item)
  } catch (e) {
    return handleApiError(e)
  }
}
