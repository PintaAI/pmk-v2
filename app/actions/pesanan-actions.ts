'use server'

import { revalidatePath } from 'next/cache'
import { SaleChannel } from '@/generated/prisma/client'
import { getUserAndTokoId } from '@/lib/toko'
import { toActionResult } from '@/lib/action-result'
import {
  createPesanan,
  updateStatusPengiriman,
  updateStatusPembayaran,
  cancelPesanan,
  convertToSale,
  type CreatePesananInput,
} from '@/server/services/pesanan-service'

export async function createPesananAction(input: CreatePesananInput) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const pesanan = await createPesanan(input, userId, tokoId)
    revalidatePath('/pesanan')
    return pesanan
  })
}

export async function updateStatusPengirimanAction(pesananId: string, status: 'BELUM' | 'DIKIRIM') {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const result = await updateStatusPengiriman(pesananId, status, userId, tokoId)
    revalidatePath('/pesanan')
    return result
  })
}

export async function updateStatusPembayaranAction(pesananId: string, status: 'BELUM' | 'DIBAYAR') {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const result = await updateStatusPembayaran(pesananId, status, userId, tokoId)
    revalidatePath('/pesanan')
    return result
  })
}

export async function cancelPesananAction(pesananId: string) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const result = await cancelPesanan(pesananId, userId, tokoId)
    revalidatePath('/pesanan')
    return result
  })
}

export async function convertToSaleAction(pesananId: string, channel: SaleChannel) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const result = await convertToSale(pesananId, channel, userId, tokoId)
    revalidatePath('/pesanan')
    revalidatePath('/cashier')
    revalidatePath('/production')
    revalidatePath('/inventory')
    revalidatePath('/')
    return result
  })
}

export async function saveCartAsPesananAction(input: CreatePesananInput) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const pesanan = await createPesanan(input, userId, tokoId)
    revalidatePath('/pesanan')
    revalidatePath('/cashier')
    return pesanan
  })
}
