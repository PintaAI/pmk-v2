import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { deletePriceTier } from "@/server/domain/pricing/price-tier-service"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ storeId: string; tierId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, tierId } = await params
    const ctx = await requireStoreOwner(storeId)
    await deletePriceTier(ctx, tierId)
    return apiSuccess({ deleted: true })
  } catch (e) {
    return handleApiError(e)
  }
}
