import type { Prisma } from '@/generated/prisma/client'
import type { PrismaTx } from './prisma-tx'

type LogActivityInput = {
  tokoId: string
  actorId: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Prisma.InputJsonValue
}

export async function logActivity(tx: PrismaTx, input: LogActivityInput) {
  return tx.activityLog.create({
    data: {
      tokoId: input.tokoId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  })
}
