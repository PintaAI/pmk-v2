import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { resetStore } from "@/server/domain/stores/store-service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const { storeId } = await params
    const ctx = await requireStoreOwner(storeId)
    await resetStore(ctx, storeId)
    return apiSuccess({ reset: true })
  } catch (e) {
    return handleApiError(e)
  }
}
