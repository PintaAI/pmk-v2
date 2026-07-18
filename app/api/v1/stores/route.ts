import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireAuth } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { listStores, createStore } from "@/server/domain/stores/store-service"
import { ValidationError } from "@/server/domain/errors"

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requireAuth()
    const stores = await listStores({ actorId: ctx.actorId })
    return apiSuccess(stores)
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    checkMaintenance()
    const ctx = await requireAuth()
    const { name } = await req.json()
    if (!name || typeof name !== "string") throw new ValidationError("Name is required")
    const store = await createStore({ actorId: ctx.actorId }, name)
    return apiSuccess(store)
  } catch (e) {
    return handleApiError(e)
  }
}
