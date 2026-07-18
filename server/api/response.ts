import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import {
  ValidationError,
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InsufficientStockError,
  IdempotencyConflictError,
  MaintenanceError,
  InternalError,
} from "@/server/domain/errors"

function requestId(): string {
  return `req_${Math.random().toString(36).slice(2, 10)}`
}

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ data, meta: meta ?? {} })
}

export function apiError(status: number, code: string, message: string, details?: unknown): NextResponse {
  const rid = requestId()
  return NextResponse.json({ error: { code, message, details, requestId: rid } }, { status })
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthenticatedError) {
    return apiError(401, "UNAUTHENTICATED", error.message)
  }
  if (error instanceof ForbiddenError) {
    return apiError(403, "FORBIDDEN", error.message)
  }
  if (error instanceof NotFoundError) {
    return apiError(404, "NOT_FOUND", error.message)
  }
  if (error instanceof ValidationError) {
    return apiError(422, "VALIDATION", error.message, error.details)
  }
  if (error instanceof ConflictError) {
    return apiError(409, "CONFLICT", error.message)
  }
  if (error instanceof InsufficientStockError) {
    return apiError(409, "INSUFFICIENT_STOCK", error.message)
  }
  if (error instanceof IdempotencyConflictError) {
    return apiError(409, "IDEMPOTENCY_CONFLICT", error.message)
  }
  if (error instanceof MaintenanceError) {
    return apiError(503, "MIGRATION_IN_PROGRESS", error.message)
  }
  if (error instanceof InternalError) {
    return apiError(500, "INTERNAL", error.message)
  }
  if (error instanceof Error) {
    console.error("Unhandled API error:", error.message)
    return apiError(500, "INTERNAL", "An internal error occurred")
  }
  return apiError(500, "INTERNAL", "An unknown error occurred")
}

export function serializeDecimal(value: Prisma.Decimal | number | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  return new Prisma.Decimal(value).toString()
}

export function serializeDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  return new Date(value).toISOString()
}
