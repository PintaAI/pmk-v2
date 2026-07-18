import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { parsePagination } from "@/server/api/pagination"
import { requireStoreOwner } from "@/server/api/auth-context"
import { listActivity } from "@/server/domain/reports/report-service"

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreOwner(storeId)
    const { limit, cursor } = parsePagination(req)
    const result = await listActivity(ctx, { limit, cursor })
    return apiSuccess(result.items, { nextCursor: result.nextCursor })
  } catch (e) {
    return handleApiError(e)
  }
}
