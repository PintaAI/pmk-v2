import { Prisma, SaleChannel } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePositive, requireText, toDecimal } from '@/lib/number'
import { logActivity } from './activity-service'
import { createSale } from './sales-service'

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

export async function createPesanan(input: CreatePesananInput, actorId: string, tokoId: string) {
  if (!input.items.length) {
    throw new Error('Pesanan harus memiliki minimal satu item.')
  }

  return prisma.$transaction(async (tx) => {
    const items = []

    for (const item of input.items) {
      const productId = requireText(item.productId, 'Product')
      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: {
          prices: {
            include: { priceTier: true },
          },
        },
      })
      const qty = requirePositive(item.qty, 'Item qty')
      const selectedPrice = getUnitPrice(product, item.priceTierId, item.customUnitPrice)

      items.push({
        productId,
        qty,
        priceTierId: selectedPrice.priceTierId,
        unitPrice: selectedPrice.unitPrice,
        subtotal: qty.mul(selectedPrice.unitPrice),
      })
    }

    const total = items.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0))
    const kode = await generateKode(tx, tokoId)

    const pesanan = await tx.pesanan.create({
      data: {
        tokoId,
        kode,
        tanggal: input.tanggal,
        namaPelanggan: input.namaPelanggan?.trim() || undefined,
        kontak: input.kontak?.trim() || undefined,
        catatan: input.catatan?.trim() || undefined,
        total,
        createdById: actorId,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
      },
    })

    await logActivity(tx, {
      tokoId,
      actorId,
      action: 'created_pesanan',
      entityType: 'Pesanan',
      entityId: pesanan.id,
      metadata: {
        kode,
        total: total.toString(),
        itemsCount: items.length,
      },
    })

    return pesanan
  })
}

export async function updateStatusPengiriman(pesananId: string, status: 'BELUM' | 'DIKIRIM', actorId: string, tokoId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pesanan.findUniqueOrThrow({ where: { id: pesananId, tokoId } })

    if (existing.statusPengiriman === status) {
      return existing
    }

    const pesanan = await tx.pesanan.update({
      where: { id: pesananId },
      data: { statusPengiriman: status },
    })

    await logActivity(tx, {
      tokoId,
      actorId,
      action: status === 'DIKIRIM' ? 'pesanan_dikirim' : 'pesanan_belum_dikirim',
      entityType: 'Pesanan',
      entityId: pesanan.id,
      metadata: { kode: existing.kode, statusPengiriman: status },
    })

    return pesanan
  })
}

export async function updateStatusPembayaran(pesananId: string, status: 'BELUM' | 'DIBAYAR', actorId: string, tokoId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pesanan.findUniqueOrThrow({ where: { id: pesananId, tokoId } })

    if (existing.statusPembayaran === status) {
      return existing
    }

    const pesanan = await tx.pesanan.update({
      where: { id: pesananId },
      data: { statusPembayaran: status },
    })

    await logActivity(tx, {
      tokoId,
      actorId,
      action: status === 'DIBAYAR' ? 'pesanan_dibayar' : 'pesanan_belum_dibayar',
      entityType: 'Pesanan',
      entityId: pesanan.id,
      metadata: { kode: existing.kode, statusPembayaran: status },
    })

    return pesanan
  })
}

export async function cancelPesanan(pesananId: string, actorId: string, tokoId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.pesanan.findUniqueOrThrow({ where: { id: pesananId, tokoId } })

    if (existing.statusPengiriman === 'DIKIRIM' && existing.statusPembayaran === 'DIBAYAR') {
      throw new Error('Pesanan sudah selesai tidak dapat dibatalkan')
    }

    const pesanan = await tx.pesanan.update({
      where: { id: pesananId },
      data: {
        statusPengiriman: 'DIKIRIM',
        statusPembayaran: 'DIBAYAR',
      },
    })

    await logActivity(tx, {
      tokoId,
      actorId,
      action: 'cancelled_pesanan',
      entityType: 'Pesanan',
      entityId: pesanan.id,
      metadata: { kode: existing.kode },
    })

    return pesanan
  })
}

export async function convertToSale(pesananId: string, channel: SaleChannel, actorId: string, tokoId: string) {
  return prisma.$transaction(async (tx) => {
    const pesanan = await tx.pesanan.findUniqueOrThrow({
      where: { id: pesananId, tokoId },
      include: {
        items: {
          include: { product: true },
        },
      },
    })

    if (pesanan.statusPengiriman === 'DIKIRIM' && pesanan.statusPembayaran === 'DIBAYAR') {
      throw new Error('Pesanan ini sudah selesai')
    }

    const sale = await createSale(
      {
        channel,
        customerName: pesanan.namaPelanggan ?? undefined,
        note: pesanan.catatan ?? `Konversi dari pesanan ${pesanan.kode}`,
        paidAmount: Number(pesanan.total),
        items: pesanan.items.map((item) => ({
          productId: item.productId,
          qty: Number(item.qty),
          customUnitPrice: Number(item.unitPrice),
        })),
      },
      actorId,
      tokoId,
    )

    await tx.pesanan.update({
      where: { id: pesananId },
      data: {
        statusPengiriman: 'DIKIRIM',
        statusPembayaran: 'DIBAYAR',
      },
    })

    await logActivity(tx, {
      tokoId,
      actorId,
      action: 'pesanan_converted',
      entityType: 'Pesanan',
      entityId: pesanan.id,
      metadata: {
        kode: pesanan.kode,
        saleInvoiceNumber: sale.invoiceNumber,
        channel,
      },
    })

    return sale
  })
}

function getUnitPrice(
  product: {
    prices: Array<{
      price: Prisma.Decimal
      priceTier: {
        id: string
        code: string
        name: string
        isDefault: boolean
      }
    }>
  },
  priceTierId?: string,
  customUnitPrice?: string | number,
) {
  if (customUnitPrice !== undefined) {
    return {
      priceTierId: null as string | null,
      unitPrice: toDecimal(customUnitPrice, 'Custom unit price'),
    }
  }

  const productPrice = priceTierId
    ? product.prices.find((item) => item.priceTier.id === priceTierId)
    : product.prices.find((item) => item.priceTier.isDefault) ?? product.prices[0]

  if (!productPrice) {
    throw new Error('Produk tidak memiliki harga yang dikonfigurasi.')
  }

  return {
    priceTierId: productPrice.priceTier.id,
    unitPrice: productPrice.price,
  }
}

async function generateKode(tx: Prisma.TransactionClient, tokoId: string) {
  const latest = await tx.pesanan.findFirst({
    where: { tokoId },
    orderBy: { kode: 'desc' },
    select: { kode: true },
  })

  const nextNumber = latest?.kode
    ? parseInt(latest.kode.replace('PSN-', ''), 10) + 1
    : 1

  return `PSN-${String(nextNumber).padStart(3, '0')}`
}
