import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireSuperAdmin } from "@/lib/super-admin"
import { listAdminUsers } from "@/server/domain/admin/admin-service"

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin()
    const url = new URL(req.url)
    const users = await listAdminUsers({ search: url.searchParams.get("search") ?? undefined })
    return apiSuccess(users)
  } catch (e) {
    return handleApiError(e)
  }
}
