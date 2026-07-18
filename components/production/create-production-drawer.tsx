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
import { createProductionAction } from "@/app/actions/production-actions"
import { BrushCleaning, Factory, Search, X } from "lucide-react"
import { buildCustomUnitConfigs, canCycleUnit, fromBaseQty, getNextCompatibleUnit, toBaseQty } from "@/lib/units"
import type { CustomUnitConversion, UnitKind } from "@/lib/units"
import type { OperationalMode } from "@/server/domain/types"

type BahanItem = { id: string; name: string; stockQty: string; unit: string; unitKind?: UnitKind; alternativeUnits: CustomUnitConversion[] }
type ProductItem = { id: string; name: string }

type DraftBahanItem = {
  id: number
  bahanId: string
  bahanName: string
  unit: string
  inputUnit: string
  search: string
  qty: string
}

type DraftProductItem = {
  id: number
  productId: string
  productName: string
  search: string
  qty: string
}

type ProductionDraft = {
  note: string
  bahanItems: DraftBahanItem[]
  productItems: DraftProductItem[]
}

type ProductionBahanPreset = {
  id: string
  name: string
  items: Omit<DraftBahanItem, "id">[]
}

type Props = {
  bahanList: BahanItem[]
  productList: ProductItem[]
  operationalMode: OperationalMode
}

const STORAGE_KEY = "pmk:create-production-draft"
const PRESET_STORAGE_KEY = "pmk:create-production-bahan-presets"

function createDraftBahanItem(id: number): DraftBahanItem {
  return {
    id,
    bahanId: "",
    bahanName: "",
    unit: "",
    inputUnit: "",
    search: "",
    qty: "",
  }
}

function createDraftProductItem(id: number): DraftProductItem {
  return {
    id,
    productId: "",
    productName: "",
    search: "",
    qty: "",
  }
}

function createDefaultDraft(): ProductionDraft {
  return {
    note: "",
    bahanItems: [createDraftBahanItem(1)],
    productItems: [createDraftProductItem(1)],
  }
}

function readStoredDraft() {
  if (typeof window === "undefined") return createDefaultDraft()

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return createDefaultDraft()

    const parsed = JSON.parse(stored) as ProductionDraft
    if (
      !Array.isArray(parsed.bahanItems) ||
      parsed.bahanItems.length === 0 ||
      !Array.isArray(parsed.productItems) ||
      parsed.productItems.length === 0
    ) {
      return createDefaultDraft()
    }

    return parsed
  } catch {
    return createDefaultDraft()
  }
}

function readStoredPresets() {
  if (typeof window === "undefined") return []

  try {
    const stored = window.localStorage.getItem(PRESET_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored) as ProductionBahanPreset[]
    if (!Array.isArray(parsed)) return []

    return parsed.filter((preset) =>
      Boolean(preset.id && preset.name && Array.isArray(preset.items) && preset.items.length)
    )
  } catch {
    return []
  }
}

function isBahanComplete(item: DraftBahanItem) {
  return Boolean(item.bahanId && item.qty)
}

function isProductComplete(item: DraftProductItem) {
  return Boolean(item.productId && item.qty)
}

function getBahanMatches(bahanList: BahanItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return bahanList.slice(0, 6)

  return bahanList
    .filter((bahan) => bahan.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 6)
}

function getProductMatches(productList: ProductItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return productList.slice(0, 6)

  return productList
    .filter((product) => product.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 6)
}

function getNextId(items: { id: number }[]) {
  return Math.max(...items.map((item) => item.id)) + 1
}

function createPresetName() {
  const date = new Date()
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)

  return `Preset ${datePart} ${timePart}`
}

function wrapProductionAction(_prev: unknown, formData: FormData) {
  const bahanIds = formData.getAll("bahanId") as string[]
  const bahanQtys = formData.getAll("bahanQty") as string[]
  const bahanUnits = formData.getAll("bahanUnit") as string[]
  const productIds = formData.getAll("productId") as string[]
  const productQtys = formData.getAll("productQty") as string[]

  return createProductionAction({
    note: (formData.get("note") as string) || undefined,
    bahanItems: bahanIds.map((id, i) => ({
      bahanId: id,
      qtyUsed: bahanQtys[i] || "0",
      unit: bahanUnits[i] || undefined,
    })),
    productItems: productIds.map((id, i) => ({
      productId: id,
      qtyProduced: productQtys[i] || "0",
    })),
  })
}

export function CreateProductionDrawer({ bahanList, productList, operationalMode }: Props) {
  const { actionType, closeAction } = useActionParam()
  const isOpen = actionType === "create-production"
  const [state, formAction, isPending] = useActionState(wrapProductionAction, null)
  const [draft, setDraft] = useState(readStoredDraft)
  const [bahanPresets, setBahanPresets] = useState<ProductionBahanPreset[]>(readStoredPresets)
  const [showNote, setShowNote] = useState(() => Boolean(draft.note))
  const skipClosePersist = useRef(false)
  const isSimpleMode = operationalMode === "SIMPLE_INVENTORY"

  const canSavePreset = !isSimpleMode && draft.bahanItems.some(isBahanComplete)
  const canSave =
    (isSimpleMode || draft.bahanItems.every(isBahanComplete)) &&
    draft.productItems.every(isProductComplete)

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

  function savePresetsToStorage(nextPresets: ProductionBahanPreset[]) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(nextPresets))
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

  function updateDraftField(field: "note", value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function addBahanItem() {
    setDraft((prev) => ({
      ...prev,
      bahanItems: [...prev.bahanItems, createDraftBahanItem(getNextId(prev.bahanItems))],
    }))
  }

  function addProductItem() {
    setDraft((prev) => ({
      ...prev,
      productItems: [...prev.productItems, createDraftProductItem(getNextId(prev.productItems))],
    }))
  }

  function removeBahanItem(id: number) {
    setDraft((prev) => ({
      ...prev,
      bahanItems:
        prev.bahanItems.length === 1
          ? [createDraftBahanItem(1)]
          : prev.bahanItems.filter((item) => item.id !== id),
    }))
  }

  function removeProductItem(id: number) {
    setDraft((prev) => ({
      ...prev,
      productItems:
        prev.productItems.length === 1
          ? [createDraftProductItem(1)]
          : prev.productItems.filter((item) => item.id !== id),
    }))
  }

  function clearItems() {
    setDraft((prev) => ({
      ...prev,
      bahanItems: [createDraftBahanItem(1)],
      productItems: [createDraftProductItem(1)],
    }))
  }

  function saveBahanPreset() {
    const items = draft.bahanItems
      .filter(isBahanComplete)
      .map(({ bahanId, bahanName, unit, inputUnit, search, qty }) => ({
        bahanId,
        bahanName,
        unit,
        inputUnit,
        search,
        qty,
      }))

    if (items.length === 0) return

    const name = createPresetName()

    const nextPresets = [
      {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
        name,
        items,
      },
      ...bahanPresets.filter((preset) => preset.name.toLowerCase() !== name.toLowerCase()),
    ].slice(0, 8)

    setBahanPresets(nextPresets)
    savePresetsToStorage(nextPresets)
  }

  function applyBahanPreset(preset: ProductionBahanPreset) {
    setDraft((prev) => ({
      ...prev,
      bahanItems: preset.items.map((item, index) => ({
        id: index + 1,
        ...item,
      })),
    }))
  }

  function removeBahanPreset(id: string) {
    const nextPresets = bahanPresets.filter((preset) => preset.id !== id)
    setBahanPresets(nextPresets)
    savePresetsToStorage(nextPresets)
  }

  function updateBahanItem(id: number, patch: Partial<DraftBahanItem>) {
    setDraft((prev) => ({
      ...prev,
      bahanItems: prev.bahanItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }))
  }

  function updateProductItem(id: number, patch: Partial<DraftProductItem>) {
    setDraft((prev) => ({
      ...prev,
      productItems: prev.productItems.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }))
  }

  function selectBahan(itemId: number, bahan: BahanItem) {
    updateBahanItem(itemId, {
      bahanId: bahan.id,
      bahanName: bahan.name,
      unit: bahan.unit,
      inputUnit: bahan.unit,
      search: bahan.name,
    })
  }

  function selectProduct(itemId: number, product: ProductItem) {
    updateProductItem(itemId, {
      productId: product.id,
      productName: product.name,
      search: product.name,
    })
  }

  function cycleBahanUnit(item: DraftBahanItem) {
    const bahan = bahanList.find((b) => b.id === item.bahanId)
    const currentUnit = item.inputUnit || item.unit
    const customUnitConfigs = bahan
      ? buildCustomUnitConfigs(bahan.unit, bahan.unitKind ?? "CUSTOM", bahan.alternativeUnits)
      : undefined
    const nextUnit = getNextCompatibleUnit(currentUnit, item.unit, customUnitConfigs)
    const nextQty = item.qty
      ? fromBaseQty(toBaseQty(item.qty, currentUnit, customUnitConfigs), nextUnit, customUnitConfigs).toString()
      : item.qty

    updateBahanItem(item.id, {
      inputUnit: nextUnit,
      qty: nextQty,
    })
  }

  return (
    <Drawer open={isOpen} onClose={handleClose}>
      <DrawerContent className="mx-auto h-dvh max-h-dvh! max-w-md overflow-hidden rounded-t-[1.75rem] border-border/80 bg-background">
        <DrawerHeader>
          <div className="flex items-center gap-2 text-left">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <Factory className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <DrawerTitle>{isSimpleMode ? "Tambah Stok Produksi" : "Produksi Baru"}</DrawerTitle>
              <DrawerDescription className="sr-only">
                Form produksi baru
              </DrawerDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Bersihkan item produksi"
                onClick={clearItems}
              >
                <BrushCleaning className="size-4" />
              </Button>
              {!showNote && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNote(true)}
                >
                  + Catatan
                </Button>
              )}
            </div>
          </div>
        </DrawerHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 space-y-4 px-4 pb-4">
            {showNote ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Catatan (opsional)
                </span>
                <Input
                  name="note"
                  placeholder="Produksi hari ini"
                  value={draft.note}
                  onChange={(event) => updateDraftField("note", event.target.value)}
                />
              </label>
            ) : (
              <input type="hidden" name="note" value={draft.note} />
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="space-y-5 pb-4">
              {!isSimpleMode && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Bahan Dipakai
                  </span>
                </div>

                {(canSavePreset || bahanPresets.length > 0) && (
                  <div className="space-y-2 rounded-xl border bg-muted/20 p-2">
                    {canSavePreset && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={saveBahanPreset}
                      >
                        Simpan Preset
                      </Button>
                    )}

                    {bahanPresets.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {bahanPresets.map((preset) => (
                          <span
                            key={preset.id}
                            className="inline-flex items-center overflow-hidden rounded-lg border bg-background text-xs shadow-xs"
                          >
                            <button
                              type="button"
                              onClick={() => applyBahanPreset(preset)}
                              className="px-2.5 py-1.5 text-left font-medium hover:bg-muted"
                            >
                              {preset.name}
                            </button>
                            <button
                              type="button"
                              aria-label={`Hapus preset ${preset.name}`}
                              onClick={() => removeBahanPreset(preset.id)}
                              className="border-l px-1.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {draft.bahanItems.map((item) => {
                  const matches = getBahanMatches(bahanList, item.search)
                  const inputUnit = item.inputUnit || item.unit
                  const selectedBahan = bahanList.find((b) => b.id === item.bahanId)
                  const customUnitConfigs = selectedBahan
                    ? buildCustomUnitConfigs(selectedBahan.unit, selectedBahan.unitKind ?? "CUSTOM", selectedBahan.alternativeUnits)
                    : undefined

                  return (
                    <div key={item.id}>
                      <input type="hidden" name="bahanId" value={item.bahanId} />
                      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-1.5">
                        <div className="relative min-w-0">
                          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Cari bahan"
                            value={item.search}
                            onChange={(event) =>
                              updateBahanItem(item.id, {
                                bahanId: "",
                                bahanName: "",
                                unit: "",
                                inputUnit: "",
                                search: event.target.value,
                              })
                            }
                            className="pl-7"
                          />
                          {item.search && !item.bahanId && matches.length > 0 && (
                            <div className="absolute left-0 right-0 top-9 z-20 overflow-hidden rounded-lg border bg-popover shadow-md">
                              {matches.map((bahan) => (
                                <button
                                  key={bahan.id}
                                  type="button"
                                  onClick={() => selectBahan(item.id, bahan)}
                                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm hover:bg-muted"
                                >
                                  <span className="truncate">{bahan.name}</span>
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    Stok {bahan.stockQty} {bahan.unit}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="relative min-w-0">
                          <Input
                            name="bahanQty"
                            type="number"
                            required
                            min="0"
                            step="any"
                            placeholder="Qty"
                            value={item.qty}
                            onChange={(event) =>
                              updateBahanItem(item.id, { qty: event.target.value })
                            }
                            className={inputUnit ? "pr-10" : ""}
                          />
                          <input type="hidden" name="bahanUnit" value={inputUnit} />
                          {inputUnit && (
                            <button
                              type="button"
                              disabled={!canCycleUnit(item.unit, customUnitConfigs)}
                              onClick={() => cycleBahanUnit(item)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:pointer-events-none"
                            >
                              {inputUnit}
                            </button>
                          )}
                        </div>

                        {draft.bahanItems.length > 1 && (
                          <button
                            type="button"
                            aria-label="Hapus bahan"
                            onClick={() => removeBahanItem(item.id)}
                            className="flex size-8 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={addBahanItem}>
                  + Tambah Bahan
                </Button>
              </section>
              )}

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {isSimpleMode ? "Produk Ditambah" : "Produk Dihasilkan"}
                  </span>
                </div>

                {draft.productItems.map((item) => {
                  const matches = getProductMatches(productList, item.search)

                  return (
                    <div key={item.id}>
                      <input type="hidden" name="productId" value={item.productId} />
                      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-1.5">
                        <div className="relative min-w-0">
                          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Cari produk"
                            value={item.search}
                            onChange={(event) =>
                              updateProductItem(item.id, {
                                productId: "",
                                productName: "",
                                search: event.target.value,
                              })
                            }
                            className="pl-7"
                          />
                          {item.search && !item.productId && matches.length > 0 && (
                            <div className="absolute left-0 right-0 top-9 z-20 overflow-hidden rounded-lg border bg-popover shadow-md">
                              {matches.map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => selectProduct(item.id, product)}
                                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-sm hover:bg-muted"
                                >
                                  <span className="truncate">{product.name}</span>
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    Produk
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <Input
                          name="productQty"
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="Qty"
                          value={item.qty}
                          onChange={(event) =>
                            updateProductItem(item.id, { qty: event.target.value })
                          }
                          className="min-w-0"
                        />

                        {draft.productItems.length > 1 && (
                          <button
                            type="button"
                            aria-label="Hapus produk"
                            onClick={() => removeProductItem(item.id)}
                            className="flex size-8 items-center justify-center rounded-lg border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={addProductItem}>
                  + Tambah Produk
                </Button>
              </section>

              {state && !state.success && (
                <p className="text-xs text-destructive">{state.error}</p>
              )}
              {isSimpleMode && (
                <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Mode simple langsung menambah stok produk. Tidak ada bahan dipakai atau movement bahan.
                </div>
              )}
            </div>
          </ScrollArea>

          <DrawerFooter>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>{isSimpleMode ? "Tanpa bahan" : `${draft.bahanItems.length} bahan dipakai`}</span>
                <span className="font-medium text-foreground">
                  {draft.productItems.length} produk {isSimpleMode ? "ditambah" : "dihasilkan"}
                </span>
              </div>
            </div>
            <Button type="submit" disabled={isPending || !canSave}>
              {isPending ? "Menyimpan..." : "Simpan Produksi"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
