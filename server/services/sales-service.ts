import { MovementDirection, MovementType, Prisma, SaleChannel } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePositive, requireText, toDecimal } from '@/lib/number'
import { logActivity } from './activity-service'
import { decreaseProductStock } from './inventory-service'
import type { PrismaTx } from './prisma-tx'

const transactionOptions = { timeout: 15_000 }

export type CreateSaleInput = {
  date?: Date
  channel: SaleChannel
  customerName?: string
  note?: string
  paidAmount?: string | number
  deliveryFee?: string | number
  trackInventory?: boolean
  items: Array<{
    productId: string
    qty: string | number
    priceTierId?: string
    customUnitPrice?: string | number
  }>
}

export async function createSale(input: CreateSaleInput, actorId: string, tokoId: string) {
  if (!input.items.length) {
    throw new Error('Penjualan harus memiliki minimal satu item.')
  }

  return prisma.$transaction((tx) => createSaleWithTx(tx, input, actorId, tokoId), transactionOptions)
}

export async function createSaleWithTx(tx: PrismaTx, input: CreateSaleInput, actorId: string, tokoId: string) {
  if (!input.items.length) {
    throw new Error('Penjualan harus memiliki minimal satu item.')
  }

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
    const qty = requirePositive(item.qty, 'Sale qty')
    const selectedPrice = getSaleUnitPrice(product, item.priceTierId, item.customUnitPrice)

    items.push({
      productId,
      qty,
      priceTierId: selectedPrice.priceTierId,
      priceTierCode: selectedPrice.priceTierCode,
      priceTierName: selectedPrice.priceTierName,
      unitPrice: selectedPrice.unitPrice,
      subtotal: qty.mul(selectedPrice.unitPrice),
    })
  }

  const subtotalAmount = items.reduce((total, item) => total.plus(item.subtotal), new Prisma.Decimal(0))
  const deliveryFee = input.deliveryFee === undefined ? new Prisma.Decimal(0) : toDecimal(input.deliveryFee, 'Delivery fee')
  if (deliveryFee.isNegative()) {
    throw new Error('Delivery fee tidak boleh negatif.')
  }
  const totalAmount = subtotalAmount.plus(deliveryFee)
  const invoiceNumber = `SALE-${Date.now()}`

  const sale = await tx.sale.create({
    data: {
      tokoId,
      invoiceNumber,
      date: input.date,
      channel: input.channel,
      customerName: input.customerName?.trim() || undefined,
      note: input.note?.trim() || undefined,
      totalAmount,
      paidAmount: input.paidAmount === undefined ? undefined : toDecimal(input.paidAmount, 'Paid amount'),
      createdById: actorId,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          priceTierId: item.priceTierId,
          priceTierCode: item.priceTierCode,
          priceTierName: item.priceTierName,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
      },
    },
  })

  if (input.trackInventory !== false) {
    for (const item of items) {
      await decreaseProductStock(tx, {
        tokoId,
        productId: item.productId,
        movementType: MovementType.PRODUCT_SALE,
        direction: MovementDirection.OUT,
        qty: item.qty,
        unitPrice: item.unitPrice,
        referenceType: 'Sale',
        referenceId: sale.id,
        createdById: actorId,
      })
    }
  }

  await logActivity(tx, {
    tokoId,
    actorId,
    action: 'created_sale',
    entityType: 'Sale',
    entityId: sale.id,
      metadata: {
        invoiceNumber,
        channel: input.channel,
        totalAmount: totalAmount.toString(),
        subtotalAmount: subtotalAmount.toString(),
        deliveryFee: deliveryFee.toString(),
        itemsCount: items.length,
        customerName: input.customerName?.trim() || null,
      },
  })

  return { id: sale.id, invoiceNumber }
}

function getSaleUnitPrice(
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
      priceTierId: null,
      priceTierCode: 'CUSTOM',
      priceTierName: 'Custom',
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
    priceTierCode: productPrice.priceTier.code,
    priceTierName: productPrice.priceTier.name,
    unitPrice: productPrice.price,
  }
}
