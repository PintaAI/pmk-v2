'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUserAndTokoId, getCurrentTokoId } from '@/lib/toko'
import { createSale } from '@/server/services/sales-service'
import { toActionResult } from '@/lib/action-result'
import { SaleChannel } from '@/generated/prisma/client'

export type GetCashierProductsResult = {
  id: string
  name: string
  imageUrl: string | null
  currentQty: number
  prices: Array<{
    priceTierId: string
    priceTierCode: string
    priceTierName: string
    price: number
    isDefault: boolean
  }>
}

export async function getCashierProducts(): Promise<GetCashierProductsResult[]> {
  const tokoId = await getCurrentTokoId()

  const products = await prisma.product.findMany({
    where: { tokoId, isActive: true },
    include: {
      prices: {
        include: {
          priceTier: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    currentQty: Number(product.currentQty),
    prices: product.prices.map((p) => ({
      priceTierId: p.priceTier.id,
      priceTierCode: p.priceTier.code,
      priceTierName: p.priceTier.name,
      price: Number(p.price),
      isDefault: p.priceTier.isDefault,
    })),
  }))
}

type CheckoutActionInput = {
  cart: Array<{
    productId: string
    priceTierId: string
    quantity: number
  }>
  paymentMethod: string
  amountPaid: number
}

export async function checkoutCartAction(input: CheckoutActionInput) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()

    if (!input.cart.length) {
      throw new Error('Keranjang belanja kosong')
    }

    const sale = await createSale(
      {
        channel: SaleChannel.CASHIER,
        paidAmount: input.amountPaid,
        note: `Checkout kasir · ${input.paymentMethod.toUpperCase()}`,
        items: input.cart.map((item) => ({
          productId: item.productId,
          qty: item.quantity,
          priceTierId: item.priceTierId,
        })),
      },
      userId,
      tokoId,
    )

    revalidatePath('/cashier')
    revalidatePath('/production')
    revalidatePath('/inventory')
    revalidatePath('/')

    return sale
  })
}
