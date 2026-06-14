"use client"

import { useEffect, useState, useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { Archive, BrushCleaning, Pencil, Plus, Trash2, X, Loader2 } from "lucide-react"
import { createBahanAction, updateBahanAction, deleteBahanAction, type CreateBahanInput } from "@/app/actions/bahan-actions"
import { useActionParam } from "@/hooks/use-action-param"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import type { CustomUnitConversion, UnitKind } from "@/lib/units"

type BahanInventoryItem = {
  id: string
  name: string
  unit: string
  unitKind?: UnitKind
  currentQty: string
  averageCost: string
  alternativeUnits: CustomUnitConversion[]
}

type BahanDraft = {
  name: string
  unit: string
  currentQty: string
  averageCost: string
}

type AltUnitEntry = { id: number; unit: string; factor: string }

const unitOptions = [
  { label: "kg", description: "Berat" },
  { label: "g", description: "Gram" },
  { label: "l", description: "Liter" },
  { label: "ml", description: "Mili" },
  { label: "buah", description: "Item" },
  { label: "butir", description: "Telur" },
  { label: "ikat", description: "Ikat" },
  { label: "pcs", description: "Pcs" },
] as const

function createDefaultDraft(): BahanDraft {
  return { name: "", unit: "kg", currentQty: "", averageCost: "" }
}

function parseRupiahInput(value: string) {
  return value.replace(/\D/g, "")
}

function formatRupiahInput(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || !value) return value
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(amount)
}

function wrapBahanAction(_prev: unknown, formData: FormData) {
  const bahanId = formData.get("bahanId") as string
  const altUnits = formData.getAll("altUnit") as string[]
  const altFactors = formData.getAll("altFactor") as string[]

  const input: CreateBahanInput = {
    name: formData.get("name") as string,
    unit: formData.get("unit") as string,
    currentQty: (formData.get("currentQty") as string) || undefined,
    averageCost: (formData.get("averageCost") as string) || undefined,
    alternativeUnits: altUnits.length
      ? altUnits.map((unit, i) => ({
          unit,
          factor: altFactors[i] || "0",
        }))
      : undefined,
  }

  if (bahanId) {
    return updateBahanAction(bahanId, input)
  }
  return createBahanAction(input)
}

export function CreateBahanDrawer({ bahanList }: { bahanList?: BahanInventoryItem[] }) {
  const { actionType, closeAction } = useActionParam()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const editId = searchParams.get("editId")
  const isCreate = actionType === "create-bahan"
  const isEdit = actionType === "edit-bahan" && !!editId
  const isOpen = isCreate || isEdit
  const bahan = isEdit ? bahanList?.find((b) => b.id === editId) ?? null : null

  const [state, formAction, isPending] = useActionState(wrapBahanAction, null)
  const [draft, setDraft] = useState(createDefaultDraft)
  const [altUnits, setAltUnits] = useState<AltUnitEntry[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canSave = draft.name.trim().length > 0 && draft.unit.trim().length > 0

  useEffect(() => {
    if (bahan && isEdit) {
      setDraft({
        name: bahan.name,
        unit: bahan.unit,
        currentQty: bahan.currentQty,
        averageCost: bahan.averageCost,
      })
      setAltUnits(
        bahan.alternativeUnits.map((au, i) => ({
          id: i,
          unit: au.unit,
          factor: String(au.factor),
        }))
      )
    }
  }, [bahan, isEdit])

  useEffect(() => {
    if (state?.success) {
      window.setTimeout(() => {
        if (isCreate) {
          setDraft(createDefaultDraft())
          setAltUnits([])
        }
      }, 0)
      toast("success", isCreate ? "Bahan berhasil ditambahkan." : "Bahan berhasil diperbarui.")
      closeAction()
    } else if (state && !state.success) {
      toast("error", state.error)
    }
  // state is the only trigger; closeAction/isCreate/toast vary per render but shouldn't retrigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function handleClose() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("action")
    params.delete("editId")
    const query = params.toString()
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname)
  }

  function clearDraft() {
    setDraft(createDefaultDraft())
    setAltUnits([])
  }

  function updateField(field: keyof BahanDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  function addAltUnit() {
    setAltUnits((prev) => [...prev, { id: Date.now(), unit: "", factor: "" }])
  }

  function removeAltUnit(id: number) {
    setAltUnits((prev) => prev.filter((u) => u.id !== id))
  }

  function updateAltUnit(id: number, patch: Partial<AltUnitEntry>) {
    setAltUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  async function handleDelete() {
    if (!bahan) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteBahanAction(bahan.id)
      if (!result.success) {
        setDeleteError(result.error)
        toast("error", result.error)
      } else {
        toast("success", "Bahan berhasil dihapus.")
        handleClose()
      }
    } catch {
      setDeleteError("Gagal menghapus bahan")
      toast("error", "Gagal menghapus bahan")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Drawer open={isOpen} onClose={handleClose}>
      <DrawerContent className="mx-auto h-auto max-h-[90dvh] max-w-md overflow-hidden rounded-t-[1.75rem] border-border/80 bg-background">
        <DrawerHeader>
          <div className="flex items-center gap-2 text-left">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              {isEdit ? <Pencil className="size-3.5" /> : <Archive className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <DrawerTitle>{isEdit ? "Edit Bahan" : "Bahan Baru"}</DrawerTitle>
              <DrawerDescription className="sr-only">
                {isEdit ? "Form edit bahan" : "Form bahan baru"}
              </DrawerDescription>
            </div>
            {!isEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Bersihkan form bahan"
                onClick={clearDraft}
              >
                <BrushCleaning className="size-4" />
              </Button>
            )}
          </div>
        </DrawerHeader>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          {isEdit && <input type="hidden" name="bahanId" value={bahan?.id ?? ""} />}

          <div className="space-y-4 px-4 pb-4">
            <Input
              name="name"
              required
              placeholder="Nama bahan"
              value={draft.name}
              onChange={(event) => updateField("name", event.target.value)}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Unit Bahan
                </span>
                <span className="text-xs text-muted-foreground">{draft.unit}</span>
              </div>
              <input type="hidden" name="unit" value={draft.unit} />
              <div className="grid grid-cols-4 gap-1.5">
                {unitOptions.map((unit) => {
                  const isSelected = draft.unit === unit.label

                  return (
                    <button
                      key={unit.label}
                      type="button"
                      onClick={() => updateField("unit", unit.label)}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-left transition-colors",
                        isSelected ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted"
                      )}
                    >
                      <span className="block text-sm font-semibold leading-none">{unit.label}</span>
                      <span className={cn("mt-1 block text-[0.65rem] leading-none", isSelected ? "text-background/70" : "text-muted-foreground")}>{unit.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Satuan Beli Lain
                </span>
                <span className="text-xs text-muted-foreground">opsional</span>
              </div>
              {altUnits.length > 0 && (
                <div className="space-y-1.5">
                  {altUnits.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-1.5">
                      <Input
                        placeholder="Satuan"
                        value={entry.unit}
                        onChange={(e) =>
                          updateAltUnit(entry.id, { unit: e.target.value })
                        }
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">
                        = 1 {draft.unit}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Isi"
                        value={entry.factor}
                        onChange={(e) =>
                          updateAltUnit(entry.id, { factor: e.target.value })
                        }
                        className="w-20 shrink-0"
                      />
                      <button
                        type="button"
                        onClick={() => removeAltUnit(entry.id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addAltUnit}
              >
                <Plus className="size-3" />
                Tambah Satuan Beli
              </Button>
              {altUnits.filter((u) => u.unit && u.factor).map((entry) => (
                <span key={entry.id}>
                  <input type="hidden" name="altUnit" value={entry.unit} />
                  <input type="hidden" name="altFactor" value={entry.factor} />
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="relative min-w-0">
                <Input
                  name="currentQty"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Stok awal"
                  value={draft.currentQty}
                  onChange={(event) => updateField("currentQty", event.target.value)}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {draft.unit}
                </span>
              </div>

              <div className="relative min-w-0">
                <input type="hidden" name="averageCost" value={draft.averageCost} />
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Rp
                </span>
                <Input
                  inputMode="decimal"
                  placeholder="Harga awal"
                  value={formatRupiahInput(draft.averageCost)}
                  onChange={(event) => updateField("averageCost", parseRupiahInput(event.target.value))}
                  className="pl-8"
                />
              </div>
            </div>

            {state && !state.success && (
              <p className="text-xs text-destructive">{state.error}</p>
            )}
            {deleteError && (
              <p className="text-xs text-destructive">{deleteError}</p>
            )}
          </div>

            <DrawerFooter>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>{isEdit ? "Stok saat ini" : "Stok awal"}</span>
                <span className="font-medium text-foreground">
                  {draft.currentQty || "0"} {draft.unit}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={deleting || isPending}
                >
                  <Trash2 className="size-4" />
                  {deleting ? "Menghapus..." : "Hapus"}
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={isPending || !canSave}>
                {isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Simpan Bahan"}
              </Button>
            </div>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
