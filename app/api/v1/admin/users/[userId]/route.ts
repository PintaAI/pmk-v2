import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireSuperAdmin } from "@/lib/super-admin"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { deleteUser } from "@/server/domain/admin/admin-service"
import { ValidationError } from "@/server/domain/errors"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    checkMaintenance()
    const actor = await requireSuperAdmin()
    const { userId } = await params
    const body = await req.json()
    if (!body.confirmation || typeof body.confirmation !== "string") {
      throw new ValidationError("Confirmation is required")
    }
    await deleteUser(userId, actor.id)
    return apiSuccess({ deleted: true })
  } catch (e) {
    return handleApiError(e)
  }
}
