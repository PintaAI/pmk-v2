import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { parsePagination } from "@/server/api/pagination"
import { requireStoreMembership } from "@/server/api/auth-context"
import { listMovements } from "@/server/domain/inventory/inventory-service"

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const url = new URL(req.url)
    const { limit, cursor } = parsePagination(req)
    const result = await listMovements(ctx, {
      itemId: url.searchParams.get("itemId") ?? undefined,
      movementType: url.searchParams.get("movementType") ?? undefined,
      sourceType: url.searchParams.get("sourceType") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      limit,
      cursor,
    })
    return apiSuccess(result.items, { nextCursor: result.nextCursor })
  } catch (e) {
    return handleApiError(e)
  }
}
