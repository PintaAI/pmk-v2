import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireSuperAdmin } from "@/lib/super-admin"
import { listAdminStores } from "@/server/domain/admin/admin-service"

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin()
    const stores = await listAdminStores()
    return apiSuccess(stores)
  } catch (e) {
    return handleApiError(e)
  }
}
