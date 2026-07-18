'use server'

import { revalidatePath } from 'next/cache'
import { getUserAndTokoId, getCurrentTokoId } from '@/lib/toko'
import { toActionResult } from '@/lib/action-result'
import { checkoutOrder } from '@/server/domain/orders/order-service'
import { checkMaintenance } from '@/server/domain/maintenance-check'
import { listItems } from '@/server/domain/items/item-service'

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

  const products = await listItems({ actorId: "", tokoId, role: "STAFF" }, { type: "PRODUCT", isActive: true })

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    currentQty: Number(product.currentQty),
    prices: product.prices.map((p) => ({
      priceTierId: p.priceTierId,
      priceTierCode: p.priceTierCode,
      priceTierName: p.priceTierName,
      price: Number(p.price),
      isDefault: p.isDefault,
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
  customerName?: string
  deliveryFee?: number
}

export async function checkoutCartAction(input: CheckoutActionInput) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()

    if (!input.cart.length) {
      throw new Error('Keranjang belanja kosong')
    }

    const order = await checkoutOrder(
      { actorId: userId, tokoId, role: "STAFF" },
      {
        cart: input.cart.map((item) => ({
          productId: item.productId,
          priceTierId: item.priceTierId,
          quantity: item.quantity,
        })),
        paymentMethod: input.paymentMethod,
        amountPaid: input.amountPaid,
        customerName: input.customerName,
        deliveryFee: input.deliveryFee,
      }
    )

    revalidatePath('/cashier')
    revalidatePath('/production')
    revalidatePath('/inventory')
    revalidatePath('/')

    return order
  })
}
