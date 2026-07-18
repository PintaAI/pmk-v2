import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { logClosingPrint } from "@/server/domain/closing/closing-service"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    await logClosingPrint({ ...ctx, tokoId: storeId })
    return apiSuccess({ recorded: true })
  } catch (e) {
    return handleApiError(e)
  }
}
