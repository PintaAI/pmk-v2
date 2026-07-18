import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership, requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { listPriceTiers, createPriceTier } from "@/server/domain/pricing/price-tier-service"
import { ValidationError } from "@/server/domain/errors"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const tiers = await listPriceTiers(ctx)
    return apiSuccess(tiers)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const { storeId } = await params
    const ctx = await requireStoreOwner(storeId)
    const { name } = await req.json()
    if (!name || typeof name !== "string") throw new ValidationError("Name is required")
    const tier = await createPriceTier(ctx, name)
    return apiSuccess(tier)
  } catch (e) {
    return handleApiError(e)
  }
}
