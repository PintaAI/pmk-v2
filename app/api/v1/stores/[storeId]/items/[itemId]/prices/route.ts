import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { upsertItemPrices } from "@/server/domain/items/item-service"
import { ValidationError } from "@/server/domain/errors"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ storeId: string; itemId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, itemId } = await params
    const ctx = await requireStoreMembership(storeId)
    const { prices } = await req.json()
    if (!Array.isArray(prices)) throw new ValidationError("prices must be an array")
    const item = await upsertItemPrices(ctx, itemId, prices)
    return apiSuccess(item)
  } catch (e) {
    return handleApiError(e)
  }
}
