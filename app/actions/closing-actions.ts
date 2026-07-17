'use server'

import { DocumentStatus, SaleChannel } from '@/generated/prisma/client'
import { toActionResult } from '@/lib/action-result'
import { prisma } from '@/lib/prisma'
import { getUserAndTokoId } from '@/lib/toko'
import { logActivity } from '@/server/services/activity-service'

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
  channelBreakdown: Record<SaleChannel, number>
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
    return buildDailyClosingRecap(tokoId, userId)
  })
}

export async function logClosingPrintAction() {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const recap = await buildDailyClosingRecap(tokoId, userId)

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

async function buildDailyClosingRecap(tokoId: string, userId: string): Promise<DailyClosingRecap> {
  const { start, end, label } = getJakartaDayRange(new Date())

  const [toko, user, sales] = await Promise.all([
    prisma.toko.findUniqueOrThrow({
      where: { id: tokoId },
      select: {
        name: true,
        imageUrl: true,
        receiptLogoUrl: true,
        address: true,
        phone: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    prisma.sale.findMany({
      where: {
        tokoId,
        status: DocumentStatus.COMPLETED,
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    }),
  ])

  const paymentBreakdown: Record<ClosingPaymentKey, number> = {
    cash: 0,
    qris: 0,
    transfer: 0,
    ewallet: 0,
    other: 0,
  }
  const channelBreakdown: Record<SaleChannel, number> = {
    [SaleChannel.CASHIER]: 0,
    [SaleChannel.RESELLER]: 0,
    [SaleChannel.ONLINE]: 0,
  }
  const itemSummary = new Map<string, { productId: string; name: string; qty: number; total: number }>()

  let grossTotal = 0
  let totalItems = 0

  for (const sale of sales) {
    const saleTotal = Number(sale.totalAmount)
    grossTotal += saleTotal
    channelBreakdown[sale.channel] += saleTotal
    paymentBreakdown[getPaymentKeyFromNote(sale.note)] += saleTotal

    for (const item of sale.items) {
      const qty = Number(item.qty)
      const subtotal = Number(item.subtotal)
      totalItems += qty

      const current = itemSummary.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        qty: 0,
        total: 0,
      }
      current.qty += qty
      current.total += subtotal
      itemSummary.set(item.productId, current)
    }
  }

  return {
    toko,
    dateLabel: label,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    closedAt: new Date().toISOString(),
    cashierName: user?.name || user?.email || 'Kasir',
    totalTransactions: sales.length,
    totalItems,
    grossTotal,
    totalDiscount: 0,
    netTotal: grossTotal,
    paymentBreakdown,
    channelBreakdown,
    topItems: Array.from(itemSummary.values())
      .sort((a, b) => b.qty - a.qty || b.total - a.total)
      .slice(0, 5),
  }
}

function getPaymentKeyFromNote(note: string | null): ClosingPaymentKey {
  const normalized = (note ?? '').toLowerCase()

  if (normalized.includes('cash')) return 'cash'
  if (normalized.includes('qris')) return 'qris'
  if (normalized.includes('transfer')) return 'transfer'
  if (normalized.includes('ewallet') || normalized.includes('e-wallet')) return 'ewallet'

  return 'other'
}

function getJakartaDayRange(now: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)

  const start = new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0))
  const end = new Date(Date.UTC(year, month - 1, day + 1, -7, 0, 0, 0))
  const label = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'full',
  }).format(now)

  return { start, end, label }
}
