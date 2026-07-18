import { createHash } from "node:crypto"
import { Prisma } from "@/generated/prisma/client"
import type { PrismaTx } from "@/server/services/prisma-tx"
import { IdempotencyConflictError, ConflictError } from "@/server/domain/errors"

/**
 * Canonical payload hashing: sorted keys, stable JSON serialization.
 * Different key ordering produces the same hash.
 */
export function hashPayload(payload: unknown): string {
  let canonical: unknown = payload

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const sorted: Record<string, unknown> = {}
    const keys = Object.keys(payload as Record<string, unknown>).sort()
    for (const k of keys) {
      sorted[k] = hashPayloadNested((payload as Record<string, unknown>)[k])
    }
    canonical = sorted
  }

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

function hashPayloadNested(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {}
    const keys = Object.keys(value as Record<string, unknown>).sort()
    for (const k of keys) {
      sorted[k] = hashPayloadNested((value as Record<string, unknown>)[k])
    }
    return sorted
  }
  if (Array.isArray(value)) {
    return value.map(hashPayloadNested)
  }
  return value
}

export interface IdempotencyResult {
  replayed: boolean
  existingResult?: { status: string; body?: unknown }
}

/**
 * Within an existing Prisma transaction, atomically reserve idempotency.
 * Uses INSERT ON CONFLICT for safe initialization.
 * On "failed" status, detects retry and re-reserves.
 * Returns replay body if already completed.
 */
export async function atomicReserveIdempotency(
  tx: PrismaTx,
  tokoId: string,
  key: string,
  operation: string,
  actorId: string,
  requestHash: string,
): Promise<{ replayed: false } | { replayed: true; body: unknown }> {
  const now = new Date()

  // Try atomic upsert via raw query for true atomicity within the transaction
  // Insert with ON CONFLICT DO NOTHING, then re-read
  await tx.idempotencyRecord.upsert({
    where: { tokoId_key_operation: { tokoId, key, operation } },
    update: {}, // no-op on match
    create: {
      tokoId, key, operation, actorId, requestHash,
      status: "processing", createdAt: now, updatedAt: now,
    },
  })

  // Re-read to get definitive state
  const record = await tx.idempotencyRecord.findUniqueOrThrow({
    where: { tokoId_key_operation: { tokoId, key, operation } },
  })

  // If our hash doesn't match — changed payload conflict
  if (record.requestHash !== requestHash) {
    throw new IdempotencyConflictError()
  }

  // Completed — replay
  if (record.status === "completed" && record.responseRef) {
    return { replayed: true, body: JSON.parse(record.responseRef) }
  }

  // Failed from previous attempt — delete and re-reserve
  if (record.status === "failed") {
    await tx.idempotencyRecord.delete({
      where: { tokoId_key_operation: { tokoId, key, operation } },
    })
    await tx.idempotencyRecord.create({
      data: {
        tokoId, key, operation, actorId, requestHash,
        status: "processing", createdAt: now, updatedAt: now,
      },
    })
    return { replayed: false }
  }

  // Processing with different actor — concurrent conflict
  if (record.status === "processing" && record.actorId !== actorId) {
    throw new ConflictError("Request is currently being processed by another actor.")
  }

  // Processing by same actor — normal reservation
  return { replayed: false }
}

/**
 * Complete idempotency and store response. Must be part of same tx as business effects.
 */
export async function atomicCompleteIdempotency(
  tx: PrismaTx,
  tokoId: string,
  key: string,
  operation: string,
  responseBody: unknown,
): Promise<void> {
  await tx.idempotencyRecord.updateMany({
    where: { tokoId, key, operation },
    data: {
      status: "completed",
      responseRef: JSON.stringify(responseBody),
      updatedAt: new Date(),
    },
  })
}

/**
 * Mark idempotency as failed (still allows retry).
 */
export async function atomicFailIdempotency(
  tx: PrismaTx,
  tokoId: string,
  key: string,
  operation: string,
): Promise<void> {
  await tx.idempotencyRecord.updateMany({
    where: { tokoId, key, operation },
    data: { status: "failed", updatedAt: new Date() },
  })
}

/**
 * Standalone check — for route-level idempotency flow.
 * Prefer atomicReserveIdempotency in domain services that own the transaction.
 */
export async function checkAndInitIdempotency(
  tokoId: string,
  key: string,
  operation: string,
  actorId: string,
  payload: unknown,
): Promise<{ replayed: true; body: unknown } | { replayed: false }> {
  const requestHash = hashPayload(payload)
  const { prisma } = await import("@/lib/prisma")

  return prisma.$transaction(async (tx) => {
    return atomicReserveIdempotency(tx as PrismaTx, tokoId, key, operation, actorId, requestHash)
  })
}

/**
 * Standalone completion — for route-level flow.
 */
export async function completeIdempotency(
  tokoId: string,
  key: string,
  operation: string,
  responseBody: unknown,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  await prisma.idempotencyRecord.updateMany({
    where: { tokoId, key, operation },
    data: { status: "completed", responseRef: JSON.stringify(responseBody), updatedAt: new Date() },
  })
}

/**
 * Standalone failure — for route-level flow.
 */
export async function failIdempotency(
  tokoId: string,
  key: string,
  operation: string,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma")
  await prisma.idempotencyRecord.updateMany({
    where: { tokoId, key, operation },
    data: { status: "failed", updatedAt: new Date() },
  })
}
