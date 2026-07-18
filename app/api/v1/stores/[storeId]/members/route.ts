import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { listMembers, addMember } from "@/server/domain/stores/store-service"
import { ValidationError } from "@/server/domain/errors"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreOwner(storeId)
    const members = await listMembers(ctx, storeId)
    return apiSuccess(members)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const { storeId } = await params
    const ctx = await requireStoreOwner(storeId)
    const { email } = await req.json()
    if (!email || typeof email !== "string") throw new ValidationError("Email is required")
    const member = await addMember(ctx, storeId, email)
    return apiSuccess(member)
  } catch (e) {
    return handleApiError(e)
  }
}
