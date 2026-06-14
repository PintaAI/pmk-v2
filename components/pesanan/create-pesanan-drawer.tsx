"use client"

import { useEffect, useRef, useState, useActionState } from "react"
import { useActionParam } from "@/hooks/use-action-param"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createPesananAction } from "@/app/actions/pesanan-actions"
import { Plus, Search, X, ClipboardList } from "lucide-react"
import type { ProductOption } from "./types"

type DraftItem = {
  id: number
  productId: string
  productName: string
  search: string
  qty: string
  unitPrice: string
}

type PesananDraft = {
  namaPelanggan: string
  kontak: string
  catatan: string
  items: DraftItem[]
}

type Props = {
  productList: ProductOption[]
}

const STORAGE_KEY = "pmk:create-pesanan-draft"

function createDraftItem(id: number): DraftItem {
  return {
    id,
    productId: "",
    productName: "",
    search: "",
    qty: "",
    unitPrice: "",
  }
}

function createDefaultDraft(): PesananDraft {
  return {
    namaPelanggan: "",
    kontak: "",
    catatan: "",
    items: [createDraftItem(1)],
  }
}

function readStoredDraft() {
  if (typeof window === "undefined") return createDefaultDraft()

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return createDefaultDraft()

    const parsed = JSON.parse(stored) as PesananDraft
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return createDefaultDraft()
    }

    return parsed
  } catch {
    return createDefaultDraft()
  }
}

function isItemComplete(item: DraftItem) {
  return Boolean(item.productId && item.qty)
}

function getProductMatches(products: ProductOption[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return products.slice(0, 6)

  return products
    .filter((p) => p.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 6)
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

function wrapPesananAction(prev: unknown, formData: FormData) {
  const productIds = formData.getAll("productId") as string[]
  const qtys = formData.getAll("qty") as string[]
  const priceTierIds = formData.getAll("priceTierId") as string[]
  const unitPrices = formData.getAll("unitPrice") as string[]

  return createPesananAction({
    namaPelanggan: (formData.get("namaPelanggan") as string) || undefined,
    kontak: (formData.get("kontak") as string) || undefined,
    catatan: (formData.get("catatan") as string) || undefined,
    items: productIds.map((id, i) => ({
      productId: id,
      qty: qtys[i] || "0",
      priceTierId: priceTierIds[i] || undefined,
      customUnitPrice: unitPrices[i] || undefined,
    })),
  })
}

export function CreatePesananDrawer({ productList }: Props) {
  const { actionType, closeAction } = useActionParam()
  const isOpen = actionType === "create-pesanan"
  const [state, formAction, isPending] = useActionState(wrapPesananAction, null)
  const [draft, setDraft] = useState(readStoredDraft)
  const skipClosePersist = useRef(false)

  const canSave = draft.items.every(isItemComplete) && draft.items.length > 0
  const total = draft.items.reduce((sum, item) => {
    const qty = Number(item.qty) || 0
    const unitPrice = Number(item.unitPrice) || 0
    return sum + qty * unitPrice
  }, 0)

  useEffect(() => {
    if (state?.success) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY)
        skipClosePersist.current = true
        window.setTimeout(() => setDraft(createDefaultDraft()), 0)
      }
      closeAction()
    }
  // state is the only trigger; closeAction varies per render but shouldn't retrigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function saveDraftToStorage() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    }
  }

  function handleClose() {
    if (skipClosePersist.current) {
      skipClosePersist.current = false
    } else {
      saveDraftToStorage()
    }
    closeAction()
  }

  function addItem() {
    setDraft((prev) => {
      const nextId = Math.max(...prev.items.map((item) => item.id)) + 1
      return {
        ...prev,
        items: [...prev.items, createDraftItem(nextId)],
      }
    })
  }

  function removeItem(id: number) {
    setDraft((prev) => ({
      ...prev,
      items:
        prev.items.length === 1
          ? [createDraftItem(1)]
          : prev.items.filter((item) => item.id !== id),
    }))
  }

  function updateDraftField(field: "namaPelanggan" | "kontak" | "catatan", value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function updateItem(id: number, patch: Partial<DraftItem>) {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }))
  }

  function selectProduct(itemId: number, product: ProductOption) {
    const defaultPrice = product.prices.find((p) => p.isDefault) ?? product.prices[0]
    updateItem(itemId, {
      productId: product.id,
      productName: product.name,
      search: product.name,
      unitPrice: defaultPrice?.price ?? "",
    })
  }

  return (
    <Drawer open={isOpen} onClose={handleClose}>
      <DrawerContent className="h-dvh max-h-dvh!">
        <DrawerHeader>
          <div className="flex items-center gap-2 text-left">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <ClipboardList className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <DrawerTitle>Pesanan Baru</DrawerTitle>
              <DrawerDescription className="sr-only">
                Form pesanan baru
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-3 px-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <Input
                  name="namaPelanggan"
                  placeholder="Nama pelanggan"
                  value={draft.namaPelanggan}
                  onChange={(e) => updateDraftField("namaPelanggan", e.target.value)}
                />
              </label>
              <label className="min-w-0">
                <Input
                  name="kontak"
                  placeholder="No. HP / WA"
                  value={draft.kontak}
                  onChange={(e) => updateDraftField("kontak", e.target.value)}
                />
              </label>
            </div>
            <label>
              <Input
                name="catatan"
                placeholder="Catatan (opsional)"
                value={draft.catatan}
                onChange={(e) => updateDraftField("catatan", e.target.value)}
              />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Item
              </span>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="space-y-2 pb-4">
              {draft.items.map((item) => {
                const matches = getProductMatches(productList, item.search)
                const product = productList.find((p) => p.id === item.productId)
                const defaultPrice = product?.prices.find((p) => p.isDefault) ?? product?.prices[0]

                return (
                  <div key={item.id} className="relative">
                    <input type="hidden" name="productId" value={item.productId} />
                    <input type="hidden" name="priceTierId" value={defaultPrice?.priceTierId ?? ""} />
                    <input type="hidden" name="unitPrice" value={item.unitPrice} />
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5 sm:grid-cols-[minmax(0,5fr)_minmax(0,2fr)_minmax(0,2fr)]">
                      <div className="relative col-span-2 min-w-0 sm:col-span-1">
                        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Cari produk"
                          value={item.search}
                          onChange={(e) =>
                            updateItem(item.id, {
                              productId: "",
                              productName: "",
                              search: e.target.value,
                            })
                          }
                          className="pl-7"
                        />
                        {item.search && !item.productId && matches.length > 0 && (
                          <div className="absolute left-0 right-0 top-9 z-20 overflow-hidden rounded-lg border bg-popover shadow-md">
                            {matches.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => selectProduct(item.id, p)}
                                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm hover:bg-muted"
                              >
                                <span className="truncate">{p.name}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  Stok: {p.currentQty}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="relative min-w-0">
                        <Input
                          name="qty"
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="Qty"
                          value={item.qty}
                          onChange={(e) =>
                            updateItem(item.id, { qty: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex min-w-0 items-center text-sm text-muted-foreground">
                        {item.unitPrice ? formatRupiah(Number(item.unitPrice)) : "—"}
                      </div>

                      {draft.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="absolute -right-1 -top-1 z-10 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={addItem}>
                <Plus className="size-3" />
                Tambah Item
              </Button>
            </div>
          </ScrollArea>

          {state && !state.success && (
            <p className="px-4 pb-2 text-xs text-destructive">{state.error}</p>
          )}

          <DrawerFooter>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {draft.items.length} item
                </span>
                <span className="font-medium text-foreground">
                  {formatRupiah(total)}
                </span>
              </div>
            </div>
            <Button type="submit" disabled={isPending || !canSave}>
              {isPending ? "Menyimpan..." : "Simpan Pesanan"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
