'use server'

import { toActionResult } from '@/lib/action-result'
import { getUserAndTokoId } from '@/lib/toko'
import { logActivity } from '@/server/services/activity-service'
import { prisma } from '@/lib/prisma'
import { getDailyClosing as getDomainDailyClosing } from '@/server/domain/closing/closing-service'
import { checkMaintenance } from '@/server/domain/maintenance-check'

export type ClosingPaymentKey = 'cash' | 'qris' | 'transfer' | 'ewallet' | 'other'

export type DailyClosingRecap = {
  toko: {
    name: string
    imageUrl: string | null
    receiptLogoUrl: string | null
    address: string | null
    phone: string | null
  }
  dateLabel: string
  startedAt: string
  endedAt: string
  closedAt: string
  cashierName: string
  totalTransactions: number
  totalItems: number
  grossTotal: number
  totalDiscount: number
  netTotal: number
  paymentBreakdown: Record<ClosingPaymentKey, number>
  channelBreakdown: Record<string, number>
  topItems: Array<{
    productId: string
    name: string
    qty: number
    total: number
  }>
}

export async function getDailyClosingRecapAction() {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const recap = await getDomainDailyClosing({ actorId: userId, tokoId })

    return {
      toko: recap.toko,
      dateLabel: recap.dateLabel,
      startedAt: recap.startedAt,
      endedAt: recap.endedAt,
      closedAt: recap.closedAt,
      cashierName: recap.cashierName,
      totalTransactions: recap.totalTransactions,
      totalItems: recap.totalItems,
      grossTotal: recap.grossTotal,
      totalDiscount: recap.totalDiscount,
      netTotal: recap.netTotal,
      paymentBreakdown: recap.paymentBreakdown as Record<ClosingPaymentKey, number>,
      channelBreakdown: recap.channelBreakdown as Record<string, number>,
      topItems: recap.topItems,
    }
  })
}

export async function logClosingPrintAction() {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()
    const recap = await getDomainDailyClosing({ actorId: userId, tokoId })

    await prisma.$transaction((tx) =>
      logActivity(tx, {
        tokoId,
        actorId: userId,
        action: 'printed_closingan',
        entityType: 'Closingan',
        metadata: {
          dateLabel: recap.dateLabel,
          totalTransactions: recap.totalTransactions,
          totalItems: recap.totalItems,
          grossTotal: recap.grossTotal,
          netTotal: recap.netTotal,
          paymentBreakdown: recap.paymentBreakdown,
          channelBreakdown: recap.channelBreakdown,
        },
      }),
    )

    return recap
  })
}
