import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireAuth } from "@/server/api/auth-context"

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requireAuth()
    return apiSuccess({ id: ctx.actorId, tokoId: ctx.tokoId, role: ctx.role })
  } catch (e) {
    return handleApiError(e)
  }
}
