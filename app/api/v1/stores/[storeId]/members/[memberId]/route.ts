import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { removeMember } from "@/server/domain/stores/store-service"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ storeId: string; memberId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, memberId } = await params
    const ctx = await requireStoreOwner(storeId)
    await removeMember(ctx, storeId, memberId)
    return apiSuccess({ deleted: true })
  } catch (e) {
    return handleApiError(e)
  }
}
