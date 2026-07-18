import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { listItems, createItem } from "@/server/domain/items/item-service"

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const url = new URL(req.url)
    const items = await listItems(ctx, {
      type: url.searchParams.get("type") ?? undefined,
      isActive: url.searchParams.get("isActive") !== null ? url.searchParams.get("isActive") === "true" : undefined,
      search: url.searchParams.get("search") ?? undefined,
    })
    return apiSuccess(items)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const body = await req.json()
    const item = await createItem(ctx, {
      type: body.type,
      name: body.name,
      unit: body.unit,
      unitKind: body.unitKind,
      baseUnit: body.baseUnit,
      imageUrl: body.imageUrl,
      initialQty: body.initialQty,
      initialCost: body.initialCost,
      alternativeUnits: body.alternativeUnits,
      prices: body.prices,
    })
    return apiSuccess(item)
  } catch (e) {
    return handleApiError(e)
  }
}
