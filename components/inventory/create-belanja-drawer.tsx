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
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createBelanjaAction } from "@/app/actions/belanja-actions"
import { BrushCleaning, Plus, Receipt, Search, X, ArrowLeftRight } from "lucide-react"
import {
  buildCustomUnitConfigs,
  canCycleUnit,
  fromBaseQty,
  fromBaseUnitPrice,
  getNextCompatibleUnit,
  toBaseQty,
  toBaseUnitPrice,
} from "@/lib/units"
import type { CustomUnitConversion, UnitKind } from "@/lib/units"
import { badgeVariants } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { OperationalMode } from "@/server/domain/types"

type BahanItem = {
  id: string
  name: string
  unit: string
  unitKind?: UnitKind
  currentQty: string
  averageCost: string
  baseAverageCost: string
  alternativeUnits: CustomUnitConversion[]
}

type DraftItem = {
  id: number
  bahanId: string
  bahanName: string
  unit: string
  inputUnit: string
  search: string
  qty: string
  unitPrice: string
  unitPriceInput: string
  bought: boolean
}

type BelanjaDraft = {
  supplier: string
  note: string
  totalAmount: string
  items: DraftItem[]
}

type Props = {
  bahanList: BahanItem[]
  operationalMode: OperationalMode
}

const STORAGE_KEY = "pmk:create-belanja-draft"

function createDraftItem(id: number): DraftItem {
  return {
    id,
    bahanId: "",
    bahanName: "",
    unit: "",
    inputUnit: "",
    search: "",
    qty: "",
    unitPrice: "",
    unitPriceInput: "",
    bought: false,
  }
}

function createDefaultDraft(): BelanjaDraft {
  return {
    supplier: "",
    note: "",
    totalAmount: "",
    items: [createDraftItem(1)],
  }
}

function readStoredDraft() {
  if (typeof window === "undefined") return createDefaultDraft()

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return createDefaultDraft()

    const parsed = JSON.parse(stored) as BelanjaDraft
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return createDefaultDraft()
    }

    return { ...createDefaultDraft(), ...parsed }
  } catch {
    return createDefaultDraft()
  }
}

function isItemComplete(item: DraftItem) {
  return Boolean(item.bahanId && item.qty && item.unitPrice)
}

function getBahanMatches(bahanList: BahanItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return bahanList.slice(0, 6)

  return bahanList
    .filter((bahan) => bahan.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 6)
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
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

function getUnitPriceInput(item: DraftItem) {
  return formatRupiahInput(item.unitPriceInput ?? item.unitPrice)
}

function wrapBelanjaAction(prev: unknown, formData: FormData) {
  const bahanIds = formData.getAll("bahanId") as string[]
  const qtys = formData.getAll("qty") as string[]
  const unitPrices = formData.getAll("unitPrice") as string[]
  const units = formData.getAll("unit") as string[]

  return createBelanjaAction({
    supplier: (formData.get("supplier") as string) || undefined,
    note: (formData.get("note") as string) || undefined,
    totalAmount: (formData.get("totalAmount") as string) || undefined,
    items: bahanIds.map((id, i) => ({
      bahanId: id,
      qty: qtys[i] || "0",
      unit: units[i] || undefined,
      unitPrice: unitPrices[i] || "0",
    })),
  })
}

export function CreateBelanjaDrawer({ bahanList, operationalMode }: Props) {
  const { actionType, closeAction } = useActionParam()
  const isOpen = actionType === "create-belanja"
  const [state, formAction, isPending] = useActionState(wrapBelanjaAction, null)
  const [draft, setDraft] = useState(readStoredDraft)
  const [showNote, setShowNote] = useState(() => Boolean(draft.note))
  const skipClosePersist = useRef(false)
  const isSimpleMode = operationalMode === "SIMPLE_INVENTORY"

  const canSave = draft.items.every(isItemComplete)
  const canSaveSimple = Number(draft.totalAmount) > 0
  const boughtCount = draft.items.filter((item) => item.bought).length
  const totalCost = draft.items.reduce((total, item) => {
    const qty = Number(item.qty) || 0
    const unitPrice = Number(item.unitPrice) || 0

    return total + qty * unitPrice
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

  function clearItems() {
    setDraft((prev) => ({
      ...prev,
      items: [createDraftItem(1)],
    }))
  }

  function updateDraftField(field: "supplier" | "note" | "totalAmount", value: string) {
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

  function selectBahan(itemId: number, bahan: BahanItem) {
    updateItem(itemId, {
      bahanId: bahan.id,
      bahanName: bahan.name,
      unit: bahan.unit,
      inputUnit: bahan.unit,
      search: bahan.name,
      bought: false,
    })
  }

  function cycleItemUnit(item: DraftItem, bahan: BahanItem) {
    const currentUnit = item.inputUnit || bahan.unit
    const customUnitConfigs = buildCustomUnitConfigs(bahan.unit, bahan.unitKind ?? "CUSTOM", bahan.alternativeUnits)
    const nextUnit = getNextCompatibleUnit(currentUnit, bahan.unit, customUnitConfigs)
    const nextQty = item.qty
      ? fromBaseQty(toBaseQty(item.qty, currentUnit, customUnitConfigs), nextUnit, customUnitConfigs).toString()
      : item.qty
    const nextUnitPrice = item.unitPrice
      ? fromBaseUnitPrice(toBaseUnitPrice(item.unitPrice, currentUnit, customUnitConfigs), nextUnit, customUnitConfigs).toString()
      : item.unitPrice

    updateItem(item.id, {
      inputUnit: nextUnit,
      qty: nextQty,
      unitPrice: nextUnitPrice,
      unitPriceInput: nextUnitPrice,
      bought: false,
    })
  }

  if (isSimpleMode) {
    return (
      <Drawer open={isOpen} onClose={handleClose}>
        <DrawerContent className="h-dvh max-h-dvh!">
          <DrawerHeader>
            <div className="flex items-center gap-2 text-left">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                <Receipt className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <DrawerTitle>Belanja Simple</DrawerTitle>
                <DrawerDescription className="sr-only">
                  Form belanja simple
                </DrawerDescription>
              </div>
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
          </DrawerHeader>

          <form action={formAction} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Tempat belanja</span>
                <Input
                  name="supplier"
                  placeholder="Belanja dimana?"
                  value={draft.supplier}
                  onChange={(event) => updateDraftField("supplier", event.target.value)}
                />
              </label>

              <label className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Total belanja</span>
                <div className="relative">
                  <input type="hidden" name="totalAmount" value={draft.totalAmount} />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    inputMode="decimal"
                    required
                    placeholder="250.000"
                    value={formatRupiahInput(draft.totalAmount)}
                    onChange={(event) => updateDraftField("totalAmount", parseRupiahInput(event.target.value))}
                    className="h-14 pl-10 text-lg font-semibold tabular-nums"
                  />
                </div>
              </label>

              {showNote ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Catatan (opsional)
                  </span>
                  <Input
                    name="note"
                    placeholder="Belanja harian"
                    value={draft.note}
                    onChange={(event) => updateDraftField("note", event.target.value)}
                  />
                </label>
              ) : (
                <input type="hidden" name="note" value={draft.note} />
              )}

              <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                Mode simple hanya menyimpan total belanja. Stok bahan dan movement bahan tidak berubah.
              </div>
            </div>

            {state && !state.success && (
              <p className="px-4 pb-2 text-xs text-destructive">{state.error}</p>
            )}

            <DrawerFooter>
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Total</span>
                  <span className="font-medium text-foreground">
                    {formatRupiah(Number(draft.totalAmount) || 0)}
                  </span>
                </div>
              </div>
              <Button type="submit" disabled={isPending || !canSaveSimple}>
                {isPending ? "Menyimpan..." : "Simpan Belanja"}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Drawer open={isOpen} onClose={handleClose}>
      <DrawerContent className="h-dvh max-h-dvh!">
        <DrawerHeader>
          <div className="flex items-center gap-2 text-left">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <Receipt className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <DrawerTitle>Belanja Baru</DrawerTitle>
              <DrawerDescription className="sr-only">
                Form belanja baru
              </DrawerDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Bersihkan item belanja"
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
            <label className="flex min-w-0 flex-col gap-1.5">
              <Input
                name="supplier"
                placeholder="Belanja dimana?"
                value={draft.supplier}
                onChange={(event) => updateDraftField("supplier", event.target.value)}
              />
            </label>

            {showNote ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Catatan (opsional)
                </span>
                <Input
                  name="note"
                  placeholder="Belanja harian"
                  value={draft.note}
                  onChange={(event) => updateDraftField("note", event.target.value)}
                />
              </label>
            ) : (
              <input type="hidden" name="note" value={draft.note} />
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Item Belanja
              </span>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="space-y-2 pb-4">
              {draft.items.map((item) => {
                const isComplete = isItemComplete(item)
                const matches = getBahanMatches(bahanList, item.search)
                const bahan = bahanList.find((b) => b.id === item.bahanId)
                const unit = item.unit || bahan?.unit || ""
                const inputUnit = item.inputUnit || unit
                const customUnitConfigs = bahan
                  ? buildCustomUnitConfigs(bahan.unit, bahan.unitKind ?? "CUSTOM", bahan.alternativeUnits)
                  : undefined

                return (
                  <div
                    key={item.id}
                    className="relative data-[checked=true]:opacity-65"
                    data-checked={item.bought}
                  >
                    <input type="hidden" name="bahanId" value={item.bahanId} />
                    <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5 sm:grid-cols-[2rem_minmax(0,5fr)_minmax(0,2fr)_minmax(0,3fr)]">
                      <Checkbox
                        disabled={!isComplete}
                        checked={item.bought}
                        aria-label={item.bought ? "Tandai belum dibeli" : "Tandai sudah dibeli"}
                        onClick={() =>
                          updateItem(item.id, { bought: !item.bought })
                        }
                        className="size-8 rounded-lg"
                      />

                      <div className="relative col-span-2 min-w-0 sm:col-span-1">
                        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Cari bahan"
                          value={item.search}
                          readOnly={item.bought}
                          onChange={(event) =>
                            updateItem(item.id, {
                              bahanId: "",
                              bahanName: "",
                              unit: "",
                              inputUnit: "",
                              search: event.target.value,
                              bought: false,
                            })
                          }
                          className={`pl-7 ${item.bought ? "bg-muted/50 text-muted-foreground line-through" : ""}`}
                        />
                        {item.search && !item.bahanId && !item.bought && matches.length > 0 && (
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
                                  {bahan.currentQty} {bahan.unit}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="relative col-start-2 min-w-0 sm:col-start-auto">
                        <Input
                          name="qty"
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="Qty"
                          value={item.qty}
                          readOnly={item.bought}
                          onChange={(event) =>
                            updateItem(item.id, {
                              qty: event.target.value,
                              bought: false,
                            })
                          }
                          className={`${inputUnit ? "pr-10" : ""} ${item.bought ? "bg-muted/50 text-muted-foreground line-through" : ""}`}
                        />
                        <input type="hidden" name="unit" value={inputUnit} />
                        {inputUnit && (
                          <button
                            type="button"
                            disabled={!canCycleUnit(unit, customUnitConfigs) || item.bought}
                            onClick={() => bahan && cycleItemUnit(item, bahan)}
                            className={cn(
                              badgeVariants({ variant: inputUnit !== unit ? "default" : "secondary" }),
                              "absolute right-1 top-1/2 -translate-y-1/2 gap-0.5 text-xs [&>svg]:size-2.5!"
                            )}
                          >
                            {inputUnit}
                            <ArrowLeftRight className="size-2.5" />
                          </button>
                        )}
                      </div>
                       <div className="relative min-w-0">
                        <input type="hidden" name="unitPrice" value={item.unitPrice} />
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          Rp
                        </span>
                        <Input
                          inputMode="decimal"
                          required
                          placeholder={bahan?.baseAverageCost
                            ? formatRupiahInput(fromBaseUnitPrice(bahan.baseAverageCost, inputUnit, customUnitConfigs).toString())
                            : "25.000"
                          }
                          value={getUnitPriceInput(item)}
                          readOnly={item.bought}
                          onChange={(event) => {
                            const unitPrice = parseRupiahInput(event.target.value)

                            updateItem(item.id, {
                              unitPrice,
                              unitPriceInput: unitPrice,
                              bought: false,
                            })
                          }}
                          className={`min-w-0 pl-8 ${item.bought ? "bg-muted/50 text-muted-foreground line-through" : ""}`}
                        />
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
                  {boughtCount}/{draft.items.length} terbeli
                </span>
                <span className="font-medium text-foreground">
                  {formatRupiah(totalCost)}
                </span>
              </div>
            </div>
            <Button type="submit" disabled={isPending || !canSave}>
              {isPending ? "Menyimpan..." : "Simpan Belanja"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
