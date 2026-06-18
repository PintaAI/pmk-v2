"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  CashierCard,
  CartDrawer,
  FlyToCartProvider,
  getCartRows,
  getCartSummary,
  type CartItem,
  type PaymentMethod,
} from "@/components/cashier"
import {
  CheckoutDialog,
  ThermalReceipt,
  type ThermalReceiptData,
} from "@/components/checkout"
import {
  useBtPrint,
  BtPrintDialog,
  isNativeApp,
  type BtPreparedState,
} from "@/components/printer"
import { formatEscPosCurrency, type EscPosReceipt } from "@/lib/escpos-print"
import { paymentMethodLabels } from "@/components/cashier/constants"
import { usePlusAction } from "@/components/providers/plus-action-context"
import { useToko } from "@/components/providers/toko-provider"
import { useActionParam } from "@/hooks/use-action-param"
import { getCashierProducts, checkoutCartAction } from "@/app/actions/cashier-actions"
import { saveCartAsPesananAction } from "@/app/actions/pesanan-actions"

const queryKeys = {
  cashierProducts: ["cashier", "products"],
}

const CART_DRAFT_STORAGE_KEY = "pmk.cashier.cart"

export default function CashierPage() {
  return (
    <Suspense fallback={null}>
      <CashierContent />
    </Suspense>
  )
}

function CashierContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [, startTransition] = React.useTransition()

  const [cart, setCart] = React.useState<CartItem[]>(getStoredCartDraft)
  const [activePriceTierId, setActivePriceTierId] = React.useState<string>("")
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = React.useState(false)
  const [receiptToPrint, setReceiptToPrint] = React.useState<ThermalReceiptData | null>(null)
  const receiptToRetry = React.useRef<EscPosReceipt | null>(null)
  const shouldRefreshAfterPrint = React.useRef(false)

  const { setCartCount } = usePlusAction()
  const { toko } = useToko()
  const { actionType, closeAction } = useActionParam()

  const isCartDrawerOpen = actionType === "open-cart"

  const closeCartDrawer = React.useCallback(() => {
    if (actionType === "open-cart") closeAction()
  }, [actionType, closeAction])

  const handleCartOpenChange = React.useCallback((open: boolean) => {
    if (!open) closeCartDrawer()
  }, [closeCartDrawer])

  const {
    printState,
    preparedState,
    prepareBluetoothPrinter,
    printPreparedOrBluetooth,
    printViaBluetooth,
    selectAndPrint,
    reset: resetBtPrint,
    disconnectPreparedPrinter,
  } = useBtPrint()

  const refreshDashboard = React.useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  const closeBtPrintDialog = React.useCallback(() => {
    resetBtPrint()
    if (shouldRefreshAfterPrint.current) {
      shouldRefreshAfterPrint.current = false
      refreshDashboard()
    }
  }, [refreshDashboard, resetBtPrint])

  const { data: products = [] } = useQuery({
    queryKey: queryKeys.cashierProducts,
    queryFn: getCashierProducts,
  })

  const resolvedPriceTierId = React.useMemo(() => {
    if (activePriceTierId) return activePriceTierId
    for (const product of products) {
      const defaultPrice = product.prices.find((p) => p.isDefault) ?? product.prices[0]
      if (defaultPrice) return defaultPrice.priceTierId
    }
    return activePriceTierId
  }, [products, activePriceTierId])

  const effectivePriceTierId = activePriceTierId || resolvedPriceTierId

  const cartRows = getCartRows(cart, products)
  const trackInventory = toko?.operationalMode !== "CASHIER_ONLY"

  React.useEffect(() => {
    saveCartDraft(cart)
  }, [cart])

  React.useEffect(() => {
    setCartCount(getCartSummary(cartRows).quantity)
  }, [cartRows, setCartCount])

  const checkoutMutation = useMutation({
    mutationFn: checkoutCartAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashierProducts })
      clearCartDraft()
      setCart([])
      closeCartDrawer()
    },
  })

  const saveAsPesananMutation = useMutation({
    mutationFn: saveCartAsPesananAction,
    onSuccess: () => {
      clearCartDraft()
      setCart([])
      closeCartDrawer()
      setIsCheckoutDialogOpen(false)
    },
  })

  const setCartQuantity = (productId: string, priceTierId: string, quantity: number) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    setCart((currentCart) => {
      const reservedQuantity = currentCart
        .filter((item) => item.productId === productId && item.priceTierId !== priceTierId)
        .reduce((total, item) => total + item.quantity, 0)
      const availableQty = Number(product.currentQty)
      const maxQuantity = trackInventory ? Math.max(0, availableQty - reservedQuantity) : Number.MAX_SAFE_INTEGER
      const nextQuantity = Math.max(0, Math.min(quantity, maxQuantity))
      const itemIndex = currentCart.findIndex(
        (item) => item.productId === productId && item.priceTierId === priceTierId
      )

      if (itemIndex === -1) {
        return nextQuantity === 0 ? currentCart : [...currentCart, { productId, priceTierId, quantity: nextQuantity }]
      }

      if (nextQuantity === 0) {
        return currentCart.filter((_, index) => index !== itemIndex)
      }

      return currentCart.map((item, index) =>
        index === itemIndex ? { ...item, quantity: nextQuantity } : item
      )
    })
  }

  const submitCart = () => {
    if (cart.length === 0) return
    closeCartDrawer()
    setIsCheckoutDialogOpen(true)
    if (isNativeApp()) {
      prepareBluetoothPrinter()
    }
  }

  const handleCheckoutOpenChange = (open: boolean) => {
    setIsCheckoutDialogOpen(open)
    if (!open && isNativeApp()) {
      disconnectPreparedPrinter()
    }
  }

  const handleCheckoutConfirm = (paymentMethod: PaymentMethod, amountPaid: number) => {
    setIsCheckoutDialogOpen(false)
    const rows = getCartRows(cart, products)
    const total = getCartSummary(rows).total
    const receipt: ThermalReceiptData = {
      id: crypto.randomUUID().slice(0, 8).toUpperCase(),
      rows,
      total,
      paymentMethod,
      amountPaid,
      createdAt: new Date().toISOString(),
    }
    const escpos: EscPosReceipt = {
      title: "Pempek Kasir",
      subtitle1: new Date(receipt.createdAt).toLocaleString("id-ID"),
      subtitle2: `#${receipt.id}`,
      items: rows.map(({ product, quantity, unitPrice }) => ({
        left: `${product.name} ${quantity}x`,
        right: formatEscPosCurrency(unitPrice * quantity),
      })),
      total: formatEscPosCurrency(total),
      paymentMethod: paymentMethodLabels[paymentMethod],
      amountPaid: formatEscPosCurrency(amountPaid),
      change: formatEscPosCurrency(Math.max(0, amountPaid - total)),
      footer: "Terima kasih",
    }
    const payload = { cart, paymentMethod, amountPaid }
    setReceiptToPrint(receipt)
    receiptToRetry.current = escpos
    checkoutMutation.mutate(payload, {
      onSuccess: () => {
        if (isNativeApp()) {
          shouldRefreshAfterPrint.current = true
          printPreparedOrBluetooth(escpos)
        } else {
          window.setTimeout(() => {
            window.print()
            refreshDashboard()
          }, 150)
        }
      },
    })
  }

  const handleSaveAsPesanan = () => {
    setIsCheckoutDialogOpen(false)
    const rows = getCartRows(cart, products)
    saveAsPesananMutation.mutate({
      items: rows.map((row) => ({
        productId: row.product.id,
        qty: row.quantity,
        priceTierId: row.priceTierId,
      })),
    })
  }

  if (products.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-146px)] min-h-0 flex-col md:h-[calc(100dvh-4rem)]">
        <div className="relative isolate px-1 md:mb-2 md:space-y-2 md:pt-1">
          <div className="pointer-events-none absolute -left-8 -top-10 -z-10 size-36 rounded-full" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[0.65rem] font-semibold uppercase text-background">
                <ShoppingCart className="size-3.5" />
              </span>
              <h1 className="truncate text-xl font-semibold tracking-tight md:text-3xl">Kasir</h1>
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center">
            <p className="text-lg font-semibold">Belum ada produk</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {trackInventory
                ? "Tambahkan produk dan harga di tab Produksi sebelum menggunakan kasir."
                : "Tambahkan menu dan harga sebelum menggunakan kasir."}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <FlyToCartProvider>
      <div className="flex h-[calc(100dvh-146px)] min-h-0 flex-col md:h-[calc(100dvh-4rem)]">
        <div className="relative isolate px-1 md:mb-2 md:space-y-2 md:pt-1">
          <div className="pointer-events-none absolute -left-8 -top-10 -z-10 size-36 rounded-full" />
          <div className="flex items-start justify-between gap-3">
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[0.65rem] font-semibold uppercase text-background">
                <ShoppingCart className="size-3.5" />
              </span>
              <h1 className="truncate text-xl font-semibold tracking-tight md:text-3xl">Kasir</h1>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CashierCard
            products={products}
            cart={cart}
            activePriceTierId={effectivePriceTierId}
            trackInventory={trackInventory}
            onPriceTierChange={setActivePriceTierId}
            onChangeQuantity={setCartQuantity}
          />
        </div>

        <CartDrawer
          open={isCartDrawerOpen}
          products={products}
          cart={cart}
          onChangeQuantity={setCartQuantity}
          onCheckout={submitCart}
          onClearCart={() => setCart([])}
          onOpenChange={handleCartOpenChange}
        />

        <CheckoutDialog
          open={isCheckoutDialogOpen}
          cartRows={cartRows}
          total={getCartSummary(cartRows).total}
          printerStatusLabel={getPrinterStatusLabel(preparedState)}
          onOpenChange={handleCheckoutOpenChange}
          onConfirm={handleCheckoutConfirm}
          onSaveAsPesanan={cart.length > 0 ? handleSaveAsPesanan : undefined}
        />

        <ThermalReceipt receipt={receiptToPrint} />

        <BtPrintDialog
          state={printState}
          onSelect={(address) => {
            if (receiptToRetry.current) {
              selectAndPrint(address, receiptToRetry.current)
            }
          }}
          onClose={closeBtPrintDialog}
          onRetry={() => {
            const receipt = receiptToRetry.current
            if (receipt) {
              printViaBluetooth(receipt)
            }
          }}
        />
      </div>
    </FlyToCartProvider>
  )
}

function getPrinterStatusLabel(state: BtPreparedState) {
  if (state.phase === "preparing") return `Menyiapkan printer ${state.deviceName}...`
  if (state.phase === "ready") return `Printer siap: ${state.deviceName}`
  if (state.phase === "failed") return "Printer tersimpan belum siap, pilih manual setelah konfirmasi"
  return undefined
}

function getStoredCartDraft(): CartItem[] {
  if (typeof window === "undefined") return []

  try {
    const stored = window.localStorage.getItem(CART_DRAFT_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isValidCartDraftItem)
  } catch {
    return []
  }
}

function saveCartDraft(cart: CartItem[]) {
  if (typeof window === "undefined") return

  if (cart.length === 0) {
    clearCartDraft()
    return
  }

  window.localStorage.setItem(CART_DRAFT_STORAGE_KEY, JSON.stringify(cart))
}

function clearCartDraft() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(CART_DRAFT_STORAGE_KEY)
}

function isValidCartDraftItem(item: unknown): item is CartItem {
  if (!item || typeof item !== "object") return false

  const cartItem = item as CartItem
  return (
    typeof cartItem.productId === "string" &&
    typeof cartItem.priceTierId === "string" &&
    typeof cartItem.quantity === "number" &&
    Number.isFinite(cartItem.quantity) &&
    cartItem.quantity > 0
  )
}
