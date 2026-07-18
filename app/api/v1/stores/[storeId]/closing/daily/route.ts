import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { getDailyClosing } from "@/server/domain/closing/closing-service"

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const url = new URL(req.url)
    const date = url.searchParams.get("date") ?? undefined
    const recap = await getDailyClosing({ ...ctx, tokoId: storeId }, date)
    return apiSuccess(recap)
  } catch (e) {
    return handleApiError(e)
  }
}
