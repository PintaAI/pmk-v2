"use client"

import { Eraser, ShoppingBag, Trash2 } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatCurrency, getCartRows, getCartSummary } from "./helpers"
import type { CartItem, CartRow, CashierProduct } from "./types"
import { useProductImage } from "@/hooks/use-product-image"

type CartDrawerProps = {
  open: boolean
  products: CashierProduct[]
  cart: CartItem[]
  onChangeQuantity: (productId: string, priceTierId: string, quantity: number) => void
  onCheckout: () => void
  onClearCart: () => void
  onOpenChange: (open: boolean) => void
}

export function CartDrawer({
  open,
  products,
  cart,
  onChangeQuantity,
  onCheckout,
  onClearCart,
  onOpenChange,
}: CartDrawerProps) {
  const cartRows = getCartRows(cart, products)
  const cartSummary = getCartSummary(cartRows)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto h-[90dvh] max-h-[90dvh] max-w-md overflow-hidden rounded-t-[1.75rem] border-border/80 bg-background">
        <DrawerHeader className="p-3 pb-2 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                  <ShoppingBag className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <DrawerTitle>Keranjang kasir</DrawerTitle>
                  <DrawerDescription className="text-xs">
                    {cartSummary.quantity} item siap checkout
                  </DrawerDescription>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:text-destructive"
              disabled={cartRows.length === 0}
              onClick={onClearCart}
            >
              <Eraser />
              <span className="sr-only">Kosongkan keranjang</span>
            </Button>
          </div>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-2">
          {cartRows.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="rounded-2xl border border-dashed bg-muted/20 p-5 text-center">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm ring-1 ring-border">
                  <ShoppingBag className="size-4" />
                </div>
                <p className="font-medium">Keranjang masih kosong</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pilih produk dari tab Kasir dulu.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1 rounded-2xl border bg-muted/20">
              <div className="grid gap-1.5 p-1.5">
                <AnimatePresence initial={false} mode="popLayout">
                  {cartRows.map((row) => (
                    <CartRowCard
                      key={`${row.product.id}-${row.priceTierId}`}
                      row={row}
                      onChangeQuantity={onChangeQuantity}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </div>
        <DrawerFooter className="gap-2 border-t bg-background/95 p-3">
          <div className="rounded-2xl border bg-muted/20 p-2.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span>Total</span>
              <span>{cartSummary.quantity} item</span>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <p className="text-[0.68rem] leading-snug text-muted-foreground">
                Periksa qty sebelum lanjut pembayaran.
              </p>
              <span className="shrink-0 text-xl font-semibold leading-none tracking-[-0.04em] tabular-nums">
                {formatCurrency(cartSummary.total)}
              </span>
            </div>
          </div>
          <Button
            type="button"
            disabled={cartRows.length === 0}
            onClick={onCheckout}
            className="h-10 rounded-2xl text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
          >
            Checkout
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function CartRowCard({
  row,
  onChangeQuantity,
}: {
  row: CartRow
  onChangeQuantity: (productId: string, priceTierId: string, quantity: number) => void
}) {
  const { product, priceTierId, priceTierName, quantity, unitPrice } = row
  const resolvedImageUrl = useProductImage(product.imageUrl)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, scale: 0.96, filter: "blur(2px)" }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.7 }}
      className="rounded-2xl border bg-background p-2.5 shadow-sm"
    >
      <div className="flex gap-2.5">
        <div className="relative size-10 shrink-0">
          <div className="flex size-full items-center justify-center overflow-hidden rounded-xl bg-muted text-[0.68rem] font-semibold text-muted-foreground">
            {resolvedImageUrl ? (
              <div
                className="size-full bg-cover bg-center"
                style={{ backgroundImage: `url(${resolvedImageUrl})` }}
                role="img"
                aria-label={product.name}
              />
            ) : (
              product.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={quantity}
              initial={{ y: -8, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 8, opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 650, damping: 30 }}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground px-1.5 py-0.5 text-[0.62rem] font-semibold leading-none tabular-nums text-background ring-2 ring-background"
            >
              {quantity}x
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {priceTierName} · {formatCurrency(unitPrice)}
              </p>
            </div>
            <p className="shrink-0 text-right text-xs font-semibold tabular-nums">
              {formatCurrency(unitPrice * quantity)}
            </p>
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive transition hover:bg-destructive/20"
              onClick={() => onChangeQuantity(product.id, priceTierId, quantity - 1)}
            >
              <Trash2 className="size-3.5" />
              <span className="sr-only">Kurangi item</span>
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
