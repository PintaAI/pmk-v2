import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership, requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { getStore, updateStore } from "@/server/domain/stores/store-service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const store = await getStore(ctx, storeId)
    return apiSuccess(store)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const { storeId } = await params
    const ctx = await requireStoreOwner(storeId)
    const body = await req.json()
    const store = await updateStore(ctx, storeId, {
      name: body.name,
      imageUrl: body.imageUrl,
      receiptLogoUrl: body.receiptLogoUrl,
      address: body.address,
      phone: body.phone,
      operationalMode: body.operationalMode,
    })
    return apiSuccess(store)
  } catch (e) {
    return handleApiError(e)
  }
}
