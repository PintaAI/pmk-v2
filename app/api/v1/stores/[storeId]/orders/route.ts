import { NextRequest } from "next/server"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { parsePagination } from "@/server/api/pagination"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { listOrders, createManualOrder } from "@/server/domain/orders/order-service"

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const { limit, cursor } = parsePagination(req)
    const url = new URL(req.url)
    const result = await listOrders(ctx, {
      status: url.searchParams.get("status") ?? undefined,
      paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
      fulfillmentStatus: url.searchParams.get("fulfillmentStatus") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      customerSearch: url.searchParams.get("customerSearch") ?? undefined,
      limit,
      cursor,
    })
    return apiSuccess(result.items, { nextCursor: result.nextCursor })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const idempotencyKey = req.headers.get("Idempotency-Key")
    const { storeId } = await params
    const ctx = await requireStoreMembership(storeId)
    const body = await req.json()
    const order = await createManualOrder(ctx, body, idempotencyKey ? { key: idempotencyKey, payload: body } : undefined)
    return apiSuccess(order)
  } catch (e) {
    return handleApiError(e)
  }
}
