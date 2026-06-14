import type { CartItem, CartRow, CashierProduct } from "./types"

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

export function getCartRows(cart: CartItem[], products: CashierProduct[]): CartRow[] {
  return cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId)
      if (!product) return null

      const priceEntry = product.prices.find((p) => p.priceTierId === item.priceTierId) ?? product.prices[0]
      if (!priceEntry) return null

      const availableQty = Number(product.currentQty)
      const quantity = Math.min(item.quantity, availableQty)

      return quantity > 0
        ? {
            product,
            priceTierId: priceEntry.priceTierId,
            priceTierCode: priceEntry.priceTierCode,
            priceTierName: priceEntry.priceTierName,
            quantity,
            unitPrice: priceEntry.price,
          }
        : null
    })
    .filter((item): item is CartRow => !!item)
}

export function getCartSummary(cartRows: CartRow[]) {
  return cartRows.reduce(
    (summary, item) => ({
      quantity: summary.quantity + item.quantity,
      total: summary.total + item.unitPrice * item.quantity,
    }),
    { quantity: 0, total: 0 }
  )
}
