"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useActionParam } from "@/hooks/use-action-param"
import { useSearchParams } from "next/navigation"
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
import { useToast } from "@/components/ui/toast"
import { updateProductAction, archiveProductAction } from "@/app/actions/product-actions"
import { useProductImage } from "@/hooks/use-product-image"
import { processImageForUpload } from "@/lib/image-processor"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToko } from "@/components/providers/toko-provider"
import { ProductCategoryField, type ProductCategoryOption } from "./product-category-field"

type ProductItem = {
  id: string
  name: string
  imageUrl: string | null
  category: ProductCategoryOption | null
  updatedAt: string
  currentQty: string
  isActive: boolean
  prices: Array<{
    priceTierId: string
    price: string
  }>
}

type PriceTier = {
  id: string
  name: string
}

function parseRupiahInput(value: string) {
  return value.replace(/\D/g, "")
}

function formatRupiahInput(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || !value) return value
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(amount)
}

export function EditProductDrawer({
  products,
  priceTiers,
  categories,
  onOptimisticUpdate,
  onSavingChange,
}: {
  products: ProductItem[]
  priceTiers: PriceTier[]
  categories: ProductCategoryOption[]
  onOptimisticUpdate: (product: ProductItem) => void
  onSavingChange: (productId: string | null) => void
}) {
  const { actionType, closeAction } = useActionParam()
  const { toast } = useToast()
  const { toko } = useToko()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const editId = searchParams.get("editId")
  const isOpen = actionType === "edit-product" && !!editId
  const product = products.find((p) => p.id === editId) ?? null
  const existingImageUrl = useProductImage(product?.imageUrl ?? null)

  const [isPending, startSaveTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    name: "",
    categoryId: "",
    categoryName: "",
    prices: {} as Record<string, string>,
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageProcessing, setImageProcessing] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const processedFileRef = useRef<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current
    wasOpenRef.current = isOpen

    if (product && justOpened) {
      const prices: Record<string, string> = {}
      product.prices.forEach((p) => {
        prices[p.priceTierId] = p.price
      })
      window.setTimeout(() => {
        setDraft({
          name: product.name,
          categoryId: product.category?.id ?? "",
          categoryName: product.category?.name ?? "",
          prices,
        })
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current)
          previewUrlRef.current = null
        }
        setPreviewUrl(null)
        processedFileRef.current = null
        if (fileInputRef.current) fileInputRef.current.value = ""
      }, 0)
    }
  }, [product, isOpen])

  function updateName(value: string) {
    setDraft((prev) => ({ ...prev, name: value }))
  }

  function updateCategory(categoryId: string, categoryName?: string) {
    setDraft((prev) => ({ ...prev, categoryId, categoryName: categoryName ?? "" }))
  }

  async function updateImageFile(file: File | undefined) {
    if (!file) return
    setImageProcessing(true)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    const objectUrl = URL.createObjectURL(file)
    previewUrlRef.current = objectUrl
    setPreviewUrl(objectUrl)

    const { file: processed } = await processImageForUpload(file).catch(() => ({ file }))
    processedFileRef.current = processed
    setImageProcessing(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!product || isPending) return

    const fd = new FormData(e.currentTarget)
    if (processedFileRef.current) {
      fd.set("imageFile", processedFileRef.current)
    }

    const optimisticProduct: ProductItem = {
      ...product,
      name: draft.name.trim(),
      category: draft.categoryId ? { id: draft.categoryId, name: draft.categoryName } : null,
      prices: priceTiers.map((tier) => ({
        priceTierId: tier.id,
        price: draft.prices[tier.id] ?? "0",
      })),
    }

    setSaveError(null)
    onSavingChange(product.id)

    startSaveTransition(async () => {
      onOptimisticUpdate(optimisticProduct)
      handleClose()

      try {
        const result = await updateProductAction(null, fd)
        if (!result.success) {
          setSaveError(result.error)
          reopenProduct(product.id)
          toast("error", result.error)
          return
        }

        if (toko?.id) {
          window.localStorage.removeItem(`pmk.cashier.products:${toko.id}`)
        }
        void queryClient.invalidateQueries({ queryKey: ["cashier", "products"] })
        toast("success", "Produk berhasil diperbarui.")
      } catch {
        const error = "Gagal memperbarui produk. Coba lagi."
        setSaveError(error)
        reopenProduct(product.id)
        toast("error", error)
      } finally {
        onSavingChange(null)
      }
    })
  }

  function updatePrice(priceTierId: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      prices: { ...prev.prices, [priceTierId]: parseRupiahInput(value) },
    }))
  }

  async function handleArchive() {
    if (!product) return
    setArchiving(true)
    try {
      const result = await archiveProductAction(product.id)
      if (result.success) {
        if (toko?.id) {
          window.localStorage.removeItem(`pmk.cashier.products:${toko.id}`)
        }
        await queryClient.invalidateQueries({ queryKey: ["cashier", "products"] })
        toast("success", "Produk berhasil diarsipkan.")
        closeAction()
      } else {
        toast("error", result.error)
      }
    } catch {
      toast("error", "Gagal mengarsipkan produk.")
    } finally {
      setArchiving(false)
    }
  }

  function handleClose() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("action")
    params.delete("editId")
    const query = params.toString()
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname)
  }

  function reopenProduct(productId: string) {
    const params = new URLSearchParams(window.location.search)
    params.set("action", "edit-product")
    params.set("editId", productId)
    window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}`)
  }

  const canSave =
    draft.name.trim().length > 0 &&
    priceTiers.length > 0 &&
    priceTiers.every((tier) => Number(draft.prices?.[tier.id]) > 0)

  const displayImageUrl = previewUrl ?? existingImageUrl
  const nameInputKey = product?.id ?? ""

  return (
    <Drawer open={isOpen} onClose={handleClose}>
      <DrawerContent className="mx-auto h-auto max-h-[90dvh] max-w-md overflow-hidden rounded-t-[1.75rem] border-border/80 bg-background">
        <DrawerHeader>
          <div className="flex items-center gap-2 text-left">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <Pencil className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <DrawerTitle>Edit Produk</DrawerTitle>
              <DrawerDescription className="sr-only">Form edit produk</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="productId" value={product?.id ?? ""} />
          <input type="hidden" name="expectedUpdatedAt" value={product?.updatedAt ?? ""} />

          <div className="shrink-0 space-y-4 px-4 pb-4">
            <label className="flex min-w-0 flex-col gap-1.5">
              <Input
                key={nameInputKey}
                name="name"
                required
                placeholder="Nama produk"
                value={draft.name ?? ""}
                onChange={(event) => updateName(event.target.value)}
              />
            </label>

            <ProductCategoryField
              categories={categories}
              value={draft.categoryId}
              onChange={updateCategory}
            />

            <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-muted text-xs font-semibold text-muted-foreground">
                {imageProcessing ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : displayImageUrl ? (
                  <div
                    className="size-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${displayImageUrl})` }}
                    role="img"
                    aria-label="Gambar produk"
                  />
                ) : (
                  "IMG"
                )}
              </div>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Gambar produk</span>
                <Input
                  ref={fileInputRef}
                  key={nameInputKey}
                  type="file"
                  name="imageFile"
                  accept="image/*"
                  disabled={imageProcessing}
                  onChange={(event) => updateImageFile(event.target.files?.[0])}
                />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Harga Produk
              </span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {priceTiers.filter((tier) => Number(draft.prices?.[tier.id]) > 0).length}/{priceTiers.length} terisi
              </span>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="space-y-2 pb-4">
              {priceTiers.map((tier) => {
                const price = draft.prices?.[tier.id] ?? ""
                return (
                  <label key={tier.id} className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-2">
                    <span className="truncate text-sm text-muted-foreground">{tier.name}</span>
                    <input type="hidden" name="priceTierId" value={tier.id} />
                    <input type="hidden" name={`price-${tier.id}`} value={price} />
                    <div className="relative min-w-0">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        Rp
                      </span>
                      <Input
                        inputMode="decimal"
                        required
                        placeholder="25.000"
                        value={formatRupiahInput(price)}
                        onChange={(event) => updatePrice(tier.id, event.target.value)}
                        className="h-8 rounded-lg pl-7 text-right tabular-nums"
                      />
                    </div>
                  </label>
                )
              })}

              {!priceTiers.length && (
                <p className="rounded-xl border border-dashed bg-background/70 p-3 text-sm text-muted-foreground">
                  Tambahkan pricing di Settings terlebih dahulu.
                </p>
              )}

              {saveError && (
                <p className="text-xs text-destructive">{saveError}</p>
              )}
            </div>
          </ScrollArea>

          <DrawerFooter>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleArchive}
                disabled={archiving}
              >
                <Trash2 className="size-4" />
                {archiving ? "Mengarsipkan..." : "Arsip"}
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending || !canSave}>
                {isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                {isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
