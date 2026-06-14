"use client"

import { useState, useRef, useActionState, useEffect } from "react"
import type { ChangeEvent } from "react"
import { Store, RefreshCw, Plus, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { useToko } from "@/components/providers/toko-provider"
import { useTokoImage } from "@/hooks/use-toko-image"
import { processImageForUpload } from "@/lib/image-processor"
import { createTokoAction, updateTokoAction } from "@/app/actions/toko-actions"

function wrapCreateToko(_prev: unknown, formData: FormData) {
  return createTokoAction(formData.get("name") as string)
}

function CreateTokoForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast()
  const [state, formAction, isPending] = useActionState(wrapCreateToko, null)
  const [name, setName] = useState("")

  useEffect(() => {
    if (state?.success) {
      onCreated()
      toast("success", "Toko berhasil dibuat.")
    } else if (state && !state.success) {
      toast("error", state.error)
    }
  }, [state?.success])

  return (
    <Card className="p-4">
      <form action={formAction} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Buat toko untuk mulai mengelola inventaris, penjualan, dan staff.
        </p>
        <Input
          name="name"
          required
          autoFocus
          placeholder="Nama toko..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={isPending || !name.trim()}>
          {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
          {isPending ? "Membuat..." : "Buat Toko"}
        </Button>
      </form>
      {state && !state.success && (
        <p className="mt-3 text-xs text-destructive">{state.error}</p>
      )}
    </Card>
  )
}

export function TokoSettings() {
  const { toko, isLoading, refresh } = useToko()
  const { toast } = useToast()
  const initialImageUrl = useTokoImage(toko?.imageUrl ?? null)
  const [name, setName] = useState(toko?.name ?? "")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [logoPending, setLogoPending] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (toko) setName(toko.name)
  }, [toko?.id])

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-4 w-32" />
      </div>
    )
  }

  if (!toko) {
    return <CreateTokoForm onCreated={refresh} />
  }

  async function handleLogoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.currentTarget.value = ""

    const preview = URL.createObjectURL(file)
    setImageUrl(preview)
    setLogoPending(true)
    setMessage(null)

    const { file: processed } = await processImageForUpload(file).catch(() => ({ file }))

    const formData = new FormData()
    formData.set("name", toko!.name)
    formData.set("image", processed)

    const result = await updateTokoAction(null, formData)
    if (result.success) {
      setImageUrl(null)
      refresh()
      toast("success", "Logo berhasil diupload.")
    } else {
      toast("error", result.error)
    }
    setLogoPending(false)
  }

  async function handleSaveName() {
    if (!name.trim() || name.trim() === toko?.name) return
    setSaving(true)
    setMessage(null)

    const formData = new FormData()
    formData.set("name", name.trim())

    const result = await updateTokoAction(null, formData)
    if (result.success) {
      refresh()
      toast("success", "Nama toko berhasil diperbarui.")
    } else {
      toast("error", result.error)
    }
    setSaving(false)
  }

  const displayImage = imageUrl || initialImageUrl

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="group relative cursor-pointer shrink-0" aria-label="Ganti logo toko">
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-foreground text-background">
            {displayImage ? (
              <img src={displayImage} alt={toko.name} className="size-full object-cover" />
            ) : (
              <Store className="size-6" />
            )}
          </div>
          <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors group-hover:bg-muted">
            {logoPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Upload className="size-3" />
            )}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleLogoSelect}
            className="hidden"
            disabled={logoPending}
          />
        </label>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{toko.name}</p>
          <p className="text-xs text-muted-foreground">Klik logo untuk mengganti</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Nama Toko</p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={80}
            disabled={saving}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleSaveName}
            disabled={saving || !name.trim() || name.trim() === toko.name}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Simpan"}
          </Button>
        </div>
      </div>

      {message && (
        <p className={`text-xs ${message.type === "error" ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
          {message.text}
        </p>
      )}
    </div>
  )
}
