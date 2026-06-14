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
import { useToast } from "@/components/ui/toast"
import { createProductAction } from "@/app/actions/product-actions"
import { processImageForUpload } from "@/lib/image-processor"
import { Boxes, BrushCleaning, Loader2 } from "lucide-react"

type PriceTier = {
  id: string
  name: string
}

type ProductDraft = {
  name: string
  currentQty: string
  prices: Record<string, string>
}

function createDefaultDraft(): ProductDraft {
  return {
    name: "",
    currentQty: "",
    prices: {},
  }
}

function parseRupiahInput(value: string) {
  return value.replace(/\D/g, "")
}

function formatRupiahInput(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || !value) return value

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(amount)
}

export function CreateProductDrawer({ priceTiers }: { priceTiers: PriceTier[] }) {
  const { actionType, closeAction } = useActionParam()
  const { toast } = useToast()
  const isOpen = actionType === "create-product"
  const [state, formAction, isPending] = useActionState(createProductAction, null)
  const [draft, setDraft] = useState(createDefaultDraft)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageProcessing, setImageProcessing] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const processedFileRef = useRef<File | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canSave =
    draft.name.trim().length > 0 &&
    priceTiers.length > 0 &&
    priceTiers.every((tier) => Number(draft.prices?.[tier.id]) > 0)

  useEffect(() => {
    if (state?.success) {
      window.setTimeout(() => {
        clearDraft()
      }, 0)
      toast("success", "Produk berhasil ditambahkan.")
      closeAction()
    } else if (state && !state.success) {
      toast("error", state.error)
    }
  // state is the only trigger; closeAction/toast vary per render but shouldn't retrigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function clearDraft() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
    setDraft(createDefaultDraft())
    processedFileRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ""
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
    const fd = new FormData(e.currentTarget)
    if (processedFileRef.current) {
      fd.set("imageFile", processedFileRef.current)
    }
    formAction(fd)
  }

  function updateName(value: string) {
    setDraft((prev) => ({ ...prev, name: value }))
  }

  function updateCurrentQty(value: string) {
    setDraft((prev) => ({ ...prev, currentQty: value }))
  }

  function updatePrice(priceTierId: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      prices: {
        ...prev.prices,
        [priceTierId]: parseRupiahInput(value),
      },
    }))
  }

  return (
    <Drawer open={isOpen} onClose={closeAction}>
      <DrawerContent className="mx-auto h-auto max-h-[90dvh] max-w-md overflow-hidden rounded-t-[1.75rem] border-border/80 bg-background">
        <DrawerHeader>
          <div className="flex items-center gap-2 text-left">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <Boxes className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <DrawerTitle>Produk Baru</DrawerTitle>
              <DrawerDescription className="sr-only">
                Form produk baru
              </DrawerDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Bersihkan form produk"
              onClick={clearDraft}
            >
              <BrushCleaning className="size-4" />
            </Button>
          </div>
        </DrawerHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-4 px-4 pb-4">
            <label className="flex min-w-0 flex-col gap-1.5">
              <Input
                name="name"
                required
                placeholder="Nama produk"
                value={draft.name ?? ""}
                onChange={(event) => updateName(event.target.value)}
              />
            </label>

            <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-muted text-xs font-semibold text-muted-foreground">
                {imageProcessing ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : previewUrl ? (
                  <div
                    className="size-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                    role="img"
                    aria-label="Preview gambar produk"
                  />
                ) : (
                  "IMG"
                )}
              </div>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Gambar produk
                </span>
                <Input
                  ref={fileInputRef}
                  type="file"
                  name="imageFile"
                  accept="image/*"
                  disabled={imageProcessing}
                  onChange={(event) => updateImageFile(event.target.files?.[0])}
                />
              </label>
            </div>

            <label className="flex min-w-0 flex-col gap-1.5">
              <Input
                name="currentQty"
                type="number"
                min="0"
                step="any"
                placeholder="Stok awal"
                value={draft.currentQty ?? ""}
                onChange={(event) => updateCurrentQty(event.target.value)}
              />
            </label>

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
                  <label
                    key={tier.id}
                    className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-2"
                  >
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

              {state && !state.success && (
                <p className="text-xs text-destructive">{state.error}</p>
              )}
            </div>
          </ScrollArea>

          <DrawerFooter>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>{priceTiers.length} tipe harga</span>
                <span className="font-medium text-foreground">
                  {priceTiers.filter((tier) => Number(draft.prices?.[tier.id]) > 0).length}/{priceTiers.length} terisi
                </span>
              </div>
            </div>
            <Button type="submit" disabled={isPending || !canSave || imageProcessing}>
              {isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              {isPending ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
