import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { archiveItem } from "@/server/domain/items/item-service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ storeId: string; itemId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, itemId } = await params
    const ctx = await requireStoreOwner(storeId)
    const item = await archiveItem(ctx, itemId)
    return apiSuccess(item)
  } catch (e) {
    return handleApiError(e)
  }
}
