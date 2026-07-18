import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireSuperAdmin } from "@/lib/super-admin"
import { getAdminSummary } from "@/server/domain/admin/admin-service"

export async function GET(_req: NextRequest) {
  try {
    await requireSuperAdmin()
    const summary = await getAdminSummary()
    return apiSuccess(summary)
  } catch (e) {
    return handleApiError(e)
  }
}
