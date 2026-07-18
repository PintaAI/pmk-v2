import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireSuperAdmin } from "@/lib/super-admin"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { resetUserPassword } from "@/server/domain/admin/admin-service"
import { ValidationError } from "@/server/domain/errors"

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    checkMaintenance()
    const actor = await requireSuperAdmin()
    const { userId } = await params
    const { password } = await req.json()
    if (!password || typeof password !== "string" || password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters")
    }
    await resetUserPassword(userId, password)
    return apiSuccess({ reset: true })
  } catch (e) {
    return handleApiError(e)
  }
}
