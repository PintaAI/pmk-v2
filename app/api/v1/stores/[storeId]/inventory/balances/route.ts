import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { listBalances } from "@/server/domain/inventory/inventory-service"

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const url = new URL(req.url)
    const balances = await listBalances(ctx, {
      type: url.searchParams.get("type") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      active: url.searchParams.get("active") !== null ? url.searchParams.get("active") === "true" : undefined,
    })
    return apiSuccess(balances)
  } catch (e) {
    return handleApiError(e)
  }
}
