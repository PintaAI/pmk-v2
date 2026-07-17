"use client"

import { useState, useEffect, useActionState } from "react"
import { Plus, Trash2, Loader2, Percent, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import {
  createPriceTierAction,
  listPriceTiersAction,
  adjustTierPricesAction,
  removePriceTierAction,
  type PriceTierItem,
} from "@/app/actions/price-tier-actions"

function wrapCreate(_prev: unknown, formData: FormData) {
  return createPriceTierAction({ name: formData.get("name") as string })
}

export function PriceTierSettings() {
  const { toast } = useToast()
  const [tiers, setTiers] = useState<PriceTierItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createState, createForm, isCreating] = useActionState(wrapCreate, null)
  const [name, setName] = useState("")
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  async function load() {
    setLoading(true)
    const result = await listPriceTiersAction()
    if (result.success) setTiers(result.data)
    else toast("error", result.error)
    setLoading(false)
  }

  useEffect(() => {
    listPriceTiersAction()
      .then((result) => {
        if (result.success) setTiers(result.data)
        else toast("error", result.error)
      })
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    if (createState?.success) {
      window.setTimeout(() => {
        setName("")
        load()
        toast("success", "Tipe harga berhasil ditambahkan.")
      }, 0)
    } else if (createState && !createState.success) {
      toast("error", createState.error)
    }
  // createState is the only trigger; load/toast vary per render but shouldn't retrigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createState])

  async function handleAdjust(tierId: string, rawPercent: string) {
    const pct = parseFloat(rawPercent)
    if (isNaN(pct) || pct === 0) return
    setAdjustingId(tierId)
    setMessage("")

    const result = await adjustTierPricesAction(tierId, pct)
    if (result.success) {
      setMessage(`Harga ${pct > 0 ? `naik ${pct}%` : `turun ${Math.abs(pct)}%`}.`)
      toast("success", `Harga ${pct > 0 ? `naik ${pct}%` : `turun ${Math.abs(pct)}%`}.`)
    } else {
      setMessage(result.error)
      toast("error", result.error)
    }
    setAdjustingId(null)
  }

  async function handleRemove(tierId: string) {
    setRemovingId(tierId)
    setMessage("")

    const result = await removePriceTierAction(tierId)
    if (result.success) {
      setTiers((prev) => prev.filter((t) => t.id !== tierId))
      toast("success", "Tipe harga berhasil dihapus.")
    } else {
      setMessage(result.error)
      toast("error", result.error)
    }
    setRemovingId(null)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border rounded-lg border">
        {tiers.map((tier) => (
          <div key={tier.id} className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium">{tier.name}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {tier.productCount} produk
              </p>
            </div>

            <AdjustForm
              tierId={tier.id}
              disabled={adjustingId === tier.id}
              onSubmit={handleAdjust}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(tier.id)}
              disabled={removingId === tier.id}
              title={tier.isDefault ? "Hapus dan pindahkan default ke tipe berikutnya" : "Hapus"}
            >
              {removingId === tier.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </Button>
          </div>
        ))}
      </div>

      {tiers.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Belum ada tipe harga. Tambahkan yang pertama.
        </p>
      )}

      <form action={createForm} className="flex items-center gap-2">
        <Input
          name="name"
          required
          placeholder="Grosir, Marketplace, Event..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 min-w-0 flex-1 text-sm"
        />
        <Button type="submit" size="sm" disabled={isCreating || !name.trim()}>
          {isCreating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Tambah
        </Button>
      </form>

      {createState && !createState.success && (
        <p className="text-xs text-destructive">{createState.error}</p>
      )}

      {message && !message.includes("berhasil") && (
        <p className="text-xs text-muted-foreground" aria-live="polite">{message}</p>
      )}
    </div>
  )
}

function AdjustForm({
  tierId,
  disabled,
  onSubmit,
}: {
  tierId: string
  disabled: boolean
  onSubmit: (tierId: string, value: string) => void
}) {
  const [value, setValue] = useState("")
  const [collapsed, setCollapsed] = useState(true)

  if (collapsed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground"
        onClick={() => setCollapsed(false)}
        title="Sesuaikan harga"
      >
        <Percent className="size-3.5" />
      </Button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className={cn("text-[10px] tabular-nums", value && !isNaN(parseFloat(value)) ? (parseFloat(value) >= 0 ? "text-emerald-600" : "text-destructive") : "text-muted-foreground")}>
        ±
      </span>
      <Input
        type="number"
        placeholder="10"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onSubmit(tierId, value)
            setValue("")
            setCollapsed(true)
          }
          if (e.key === "Escape") {
            setValue("")
            setCollapsed(true)
          }
        }}
        className="h-7 w-14 px-1.5 text-xs tabular-nums"
        autoFocus
        disabled={disabled}
      />
      <span className="text-xs text-muted-foreground">%</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        onClick={() => {
          onSubmit(tierId, value)
          setValue("")
          setCollapsed(true)
        }}
        disabled={disabled || !value || isNaN(parseFloat(value)) || parseFloat(value) === 0}
      >
        {disabled ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Minus className="size-3 rotate-45" />
        )}
      </Button>
    </div>
  )
}
