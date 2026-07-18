import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { adjustTierPrices } from "@/server/domain/pricing/price-tier-service"
import { ValidationError } from "@/server/domain/errors"

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string; tierId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, tierId } = await params
    const ctx = await requireStoreOwner(storeId)
    const { percentage } = await req.json()
    if (typeof percentage !== "number") throw new ValidationError("percentage must be a number")
    const result = await adjustTierPrices(ctx, tierId, percentage)
    return apiSuccess(result)
  } catch (e) {
    return handleApiError(e)
  }
}
