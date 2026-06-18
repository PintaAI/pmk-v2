"use client"

import { ShoppingBag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "./helpers"
import type { CartItem, CashierProduct } from "./types"
import { useFlyToCart } from "./cart-fly"
import { useProductImage } from "@/hooks/use-product-image"

type CashierCardProps = {
  products: CashierProduct[]
  cart: CartItem[]
  activePriceTierId: string
  trackInventory: boolean
  onPriceTierChange: (priceTierId: string) => void
  onChangeQuantity: (productId: string, priceTierId: string, quantity: number) => void
}

export function CashierCard({
  products,
  cart,
  activePriceTierId,
  trackInventory,
  onPriceTierChange,
  onChangeQuantity,
}: CashierCardProps) {
  const { flyToCart } = useFlyToCart()
  const uniquePriceTiers = getUniquePriceTiers(products)

  if (uniquePriceTiers.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center">
          <p className="font-medium">Belum ada harga</p>
          <p className="mt-2 text-sm text-muted-foreground">Tambahkan tipe harga (pricing) di pengaturan terlebih dahulu.</p>
        </div>
    )
  }

  return (
    <Tabs value={activePriceTierId} onValueChange={onPriceTierChange} className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <TabsList variant="line" className="h-8 w-full gap-1 bg-transparent p-0 text-xs md:w-fit md:shrink-0">
          {uniquePriceTiers.map((tier) => (
            <TabsTrigger
              key={tier.id}
              value={tier.id}
              className="h-8 rounded-none bg-transparent px-2.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-foreground after:opacity-100 after:transition-transform data-active:after:scale-x-100 dark:data-active:bg-transparent"
            >
              {tier.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center">
            <p className="font-medium">Belum ada produk</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {trackInventory ? "Tambahkan produk dan harga di tab Produksi." : "Tambahkan menu dan harga di pengaturan produk."}
            </p>
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {products.map((product) => {
                const cartItem = cart.find(
                  (item) => item.productId === product.id && item.priceTierId === activePriceTierId
                )
                const currentPrice = product.prices.find((p) => p.priceTierId === activePriceTierId)
                const quantity = cartItem?.quantity ?? 0
                const reservedQuantity = cart
                  .filter((item) => item.productId === product.id && item.priceTierId !== activePriceTierId)
                  .reduce((total, item) => total + item.quantity, 0)
                const availableQty = Number(product.currentQty)
                const isOutOfStock = trackInventory && availableQty <= 0
                const isMaxedOut = trackInventory && quantity + reservedQuantity >= availableQty
                const statusLabel = trackInventory
                  ? isOutOfStock ? "Habis" : isMaxedOut ? "Maks" : `${availableQty - reservedQuantity} stok`
                  : "Menu"

                return (
                  <CashierProductCard
                    key={`${product.id}-${activePriceTierId}`}
                    product={product}
                    price={currentPrice?.price ?? 0}
                    quantity={quantity}
                    isDisabled={isOutOfStock || isMaxedOut}
                    statusLabel={statusLabel}
                    onAdd={(element) => {
                      flyToCart(element)
                      onChangeQuantity(product.id, activePriceTierId, quantity + 1)
                    }}
                  />
                )
              })}
            </div>
          </ScrollArea>
        )}
      </section>
    </Tabs>
  )
}

function CashierProductCard({
  product,
  price,
  quantity,
  isDisabled,
  statusLabel,
  onAdd,
}: {
  product: CashierProduct
  price: number
  quantity: number
  isDisabled: boolean
  statusLabel: string
  onAdd: (element: HTMLElement) => void
}) {
  const resolvedImageUrl = useProductImage(product.imageUrl)

  return (
    <button
      type="button"
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
      disabled={isDisabled}
      onClick={(event) => onAdd(event.currentTarget)}
    >
      <div className="relative h-24 overflow-hidden bg-muted sm:h-36">
        {resolvedImageUrl ? (
          <div
            className="size-full bg-cover bg-center transition duration-300 group-hover:scale-105"
            style={{ backgroundImage: `url(${resolvedImageUrl})` }}
            role="img"
            aria-label={product.name}
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ShoppingBag className="size-7 sm:size-8" />
          </div>
        )}
        <Badge className="absolute left-1 top-1 border-0 bg-background/90 text-[10px] text-foreground shadow-sm sm:left-2 sm:top-2 sm:text-xs">
          {statusLabel}
        </Badge>
        {quantity > 0 ? (
          <Badge className="absolute bottom-1 right-1 border-0 bg-destructive text-[10px] text-background shadow-sm sm:bottom-2 sm:right-2 sm:text-xs">
            {quantity}x
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 p-2 sm:p-3">
        <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
          {product.name}
        </p>
        <p className="text-xs font-bold tabular-nums text-foreground sm:text-sm">
          {formatCurrency(price)}
        </p>
      </div>
    </button>
  )
}

function getUniquePriceTiers(products: CashierProduct[]): Array<{ id: string; name: string; sortOrder: number }> {
  const tiersMap = new Map<string, { id: string; name: string; sortOrder: number }>()

  for (const product of products) {
    for (const price of product.prices) {
      if (!tiersMap.has(price.priceTierId)) {
        tiersMap.set(price.priceTierId, {
          id: price.priceTierId,
          name: price.priceTierName,
          sortOrder: tiersMap.size,
        })
      }
    }
  }

  return Array.from(tiersMap.values()).sort((a, b) => a.sortOrder - b.sortOrder)
}
