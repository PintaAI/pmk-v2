import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership, requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { getItem, updateItem, deleteItem, archiveItem } from "@/server/domain/items/item-service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storeId: string; itemId: string }> }) {
  try {
    const { storeId, itemId } = await params
    const ctx = await requireStoreMembership(storeId)
    const item = await getItem(ctx, itemId)
    return apiSuccess(item)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ storeId: string; itemId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, itemId } = await params
    const ctx = await requireStoreMembership(storeId)
    const body = await req.json()
    const item = await updateItem(ctx, itemId, {
      name: body.name,
      unit: body.unit,
      unitKind: body.unitKind,
      baseUnit: body.baseUnit,
      imageUrl: body.imageUrl,
      isActive: body.isActive,
    })
    return apiSuccess(item)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ storeId: string; itemId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, itemId } = await params
    const ctx = await requireStoreOwner(storeId)
    await deleteItem(ctx, itemId)
    return apiSuccess({ deleted: true })
  } catch (e) {
    return handleApiError(e)
  }
}
