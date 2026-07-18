'use server'

import { revalidatePath } from 'next/cache'
import { toActionResult } from '@/lib/action-result'
import { requireAuth } from '@/server/api/auth-context'
import { checkMaintenance } from '@/server/domain/maintenance-check'
import {
  createManualOrder,
  updateOrderPayment,
  updateOrderFulfillment,
  cancelOrder,
  completeOrder,
  type OrderDTO,
} from '@/server/domain/orders/order-service'

export type CreatePesananInput = {
  tanggal?: Date
  namaPelanggan?: string
  kontak?: string
  catatan?: string
  items: Array<{
    productId: string
    qty: string | number
    priceTierId?: string
    customUnitPrice?: string | number
  }>
}

export async function createPesananAction(input: CreatePesananInput): Promise<{ success: boolean; data?: OrderDTO; error?: string }> {
  return toActionResult(async () => {
    checkMaintenance()
    const ctx = await requireAuth()

    const order = await createManualOrder(ctx, {
      customerName: input.namaPelanggan,
      customerContact: input.kontak,
      note: input.catatan,
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.qty),
        priceTierId: item.priceTierId,
        customUnitPrice: item.customUnitPrice,
      })),
    })

    revalidatePath('/pesanan')
    return order
  })
}

export async function saveCartAsPesananAction(input: CreatePesananInput): Promise<{ success: boolean; data?: OrderDTO; error?: string }> {
  return toActionResult(async () => {
    checkMaintenance()
    const ctx = await requireAuth()

    const order = await createManualOrder(ctx, {
      customerName: input.namaPelanggan,
      customerContact: input.kontak,
      note: input.catatan,
      items: input.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.qty),
        priceTierId: item.priceTierId,
        customUnitPrice: item.customUnitPrice,
      })),
    })

    revalidatePath('/pesanan')
    revalidatePath('/cashier')
    return order
  })
}

const pengirimanToFulfillment: Record<string, string> = {
  BELUM: 'UNFULFILLED',
  DIKIRIM: 'SHIPPED',
}

const pembayaranToPayment: Record<string, string> = {
  BELUM: 'UNPAID',
  DIBAYAR: 'PAID',
}

export async function updateStatusPengirimanAction(pesananId: string, status: 'BELUM' | 'DIKIRIM'): Promise<{ success: boolean; data?: OrderDTO; error?: string }> {
  return toActionResult(async () => {
    checkMaintenance()
    const ctx = await requireAuth()
    const result = await updateOrderFulfillment(ctx, pesananId, {
      fulfillmentStatus: pengirimanToFulfillment[status],
    })
    revalidatePath('/pesanan')
    return result
  })
}

export async function updateStatusPembayaranAction(pesananId: string, status: 'BELUM' | 'DIBAYAR'): Promise<{ success: boolean; data?: OrderDTO; error?: string }> {
  return toActionResult(async () => {
    checkMaintenance()
    const ctx = await requireAuth()
    const result = await updateOrderPayment(ctx, pesananId, {
      paymentStatus: pembayaranToPayment[status],
    })
    revalidatePath('/pesanan')
    return result
  })
}

export async function cancelPesananAction(pesananId: string): Promise<{ success: boolean; data?: OrderDTO; error?: string }> {
  return toActionResult(async () => {
    checkMaintenance()
    const ctx = await requireAuth()
    const result = await cancelOrder(ctx, pesananId)
    revalidatePath('/pesanan')
    return result
  })
}

export async function completePesananAction(pesananId: string, channel: string): Promise<{ success: boolean; data?: OrderDTO; error?: string }> {
  return toActionResult(async () => {
    checkMaintenance()
    const ctx = await requireAuth()
    const result = await completeOrder(ctx, pesananId, {
      channel,
      paymentMethod: 'CASH',
    })
    revalidatePath('/pesanan')
    revalidatePath('/cashier')
    revalidatePath('/production')
    revalidatePath('/inventory')
    revalidatePath('/')
    return result
  })
}
