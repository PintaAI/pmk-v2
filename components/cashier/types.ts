export type PaymentMethod = "cash" | "qris" | "transfer" | "ewallet"

export type CashierProduct = {
  id: string
  name: string
  imageUrl: string | null
  currentQty: number
  prices: CashierProductPrice[]
}

export type CashierProductPrice = {
  priceTierId: string
  priceTierCode: string
  priceTierName: string
  price: number
  isDefault: boolean
}

export type CartItem = {
  productId: string
  priceTierId: string
  quantity: number
}

export type CartRow = {
  product: CashierProduct
  priceTierId: string
  priceTierCode: string
  priceTierName: string
  quantity: number
  unitPrice: number
}

export type CheckoutPayload = {
  cart: CartItem[]
  paymentMethod: PaymentMethod
  amountPaid: number
}
