"use client"

import { useState, useRef, useActionState, useEffect } from "react"
import type { ChangeEvent } from "react"
import { Store, Plus, Upload, Loader2, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { useToko } from "@/components/providers/toko-provider"
import { useTokoImage } from "@/hooks/use-toko-image"
import { processImageForUpload } from "@/lib/image-processor"
import { createTokoAction, updateTokoAction, resetTokoDataAction, type TokoInfo } from "@/app/actions/toko-actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"

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

  return <TokoSettingsForm key={toko.id} toko={toko} refresh={refresh} />
}

function TokoSettingsForm({ toko, refresh }: { toko: TokoInfo; refresh: () => void }) {
  const { toast } = useToast()
  const initialImageUrl = useTokoImage(toko.imageUrl)
  const initialReceiptLogoUrl = useTokoImage(toko.receiptLogoUrl)
  const [name, setName] = useState(toko.name)
  const [address, setAddress] = useState(toko.address ?? "")
  const [phone, setPhone] = useState(toko.phone ?? "")
  const [operationalMode, setOperationalMode] = useState(toko.operationalMode)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [receiptLogoUrl, setReceiptLogoUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [modeSaving, setModeSaving] = useState(false)
  const [logoPending, setLogoPending] = useState(false)
  const [receiptLogoPending, setReceiptLogoPending] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmInput, setResetConfirmInput] = useState("")
  const [resetting, setResetting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const receiptLogoInputRef = useRef<HTMLInputElement>(null)

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
    formData.set("name", toko.name)
    formData.set("address", toko.address ?? "")
    formData.set("phone", toko.phone ?? "")
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

  async function handleReceiptLogoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.currentTarget.value = ""

    const preview = URL.createObjectURL(file)
    setReceiptLogoUrl(preview)
    setReceiptLogoPending(true)
    setMessage(null)

    const { file: processed } = await processImageForUpload(file).catch(() => ({ file }))

    const formData = new FormData()
    formData.set("name", toko.name)
    formData.set("address", toko.address ?? "")
    formData.set("phone", toko.phone ?? "")
    formData.set("receiptLogo", processed)

    const result = await updateTokoAction(null, formData)
    if (result.success) {
      setReceiptLogoUrl(null)
      refresh()
      toast("success", "Logo nota berhasil diupload.")
    } else {
      toast("error", result.error)
    }
    setReceiptLogoPending(false)
  }

  async function handleSaveProfile() {
    const nextName = name.trim()
    const nextAddress = address.trim()
    const nextPhone = phone.trim()
    const hasChanges = nextName !== toko.name || nextAddress !== (toko.address ?? "") || nextPhone !== (toko.phone ?? "")

    if (!nextName || !hasChanges) return
    setSaving(true)
    setMessage(null)

    const formData = new FormData()
    formData.set("name", nextName)
    formData.set("address", nextAddress)
    formData.set("phone", nextPhone)

    const result = await updateTokoAction(null, formData)
    if (result.success) {
      refresh()
      toast("success", "Nama toko berhasil diperbarui.")
    } else {
      toast("error", result.error)
    }
    setSaving(false)
  }

  async function handleSaveOperationalMode(nextMode: "CASHIER_ONLY" | "SIMPLE_INVENTORY" | "WITH_INVENTORY") {
    if (nextMode === toko.operationalMode) return
    setOperationalMode(nextMode)
    setModeSaving(true)

    const formData = new FormData()
    formData.set("name", toko.name)
    formData.set("address", toko.address ?? "")
    formData.set("phone", toko.phone ?? "")
    formData.set("operationalMode", nextMode)

    const result = await updateTokoAction(null, formData)
    if (result.success) {
      refresh()
      toast("success", nextMode === "CASHIER_ONLY" ? "Mode Kasir saja aktif." : nextMode === "SIMPLE_INVENTORY" ? "Mode stok simple aktif." : "Mode Kasir + stok detail aktif.")
    } else {
      setOperationalMode(toko.operationalMode)
      toast("error", result.error)
    }
    setModeSaving(false)
  }

  const displayImage = imageUrl || initialImageUrl
  const displayReceiptLogo = receiptLogoUrl || initialReceiptLogoUrl

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

      <div className="rounded-2xl border bg-muted/20 p-3">
        <div className="flex items-center gap-3">
          <label className="group relative cursor-pointer shrink-0" aria-label="Ganti logo nota">
            <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded-xl bg-white text-black ring-1 ring-border">
              {displayReceiptLogo ? (
                <img src={displayReceiptLogo} alt="Logo nota" className="max-h-full max-w-full object-contain" />
              ) : displayImage ? (
                <img src={displayImage} alt="Logo toko" className="max-h-full max-w-full object-contain opacity-70" />
              ) : (
                <Store className="size-5" />
              )}
            </div>
            <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors group-hover:bg-muted">
              {receiptLogoPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Upload className="size-3" />
              )}
            </span>
            <input
              ref={receiptLogoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleReceiptLogoSelect}
              className="hidden"
              disabled={receiptLogoPending}
            />
          </label>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Logo nota</p>
            <p className="text-xs text-muted-foreground">
              Upload versi hitam-putih yang ramah thermal printer. Jika kosong, struk memakai logo toko.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Profil Struk</p>
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama toko"
            minLength={2}
            maxLength={80}
            disabled={saving}
          />
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Alamat toko untuk struk"
            maxLength={160}
            disabled={saving}
          />
          <div className="flex gap-2">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nomor telepon / WhatsApp"
              maxLength={32}
              disabled={saving}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSaveProfile}
              disabled={
                saving ||
                !name.trim() ||
                (name.trim() === toko.name && address.trim() === (toko.address ?? "") && phone.trim() === (toko.phone ?? ""))
              }
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Simpan"}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
        <div>
          <p className="text-sm font-semibold">Mode Operasional</p>
          <p className="text-xs text-muted-foreground">
            Pilih cara kerja stok yang paling cocok untuk toko.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => handleSaveOperationalMode("CASHIER_ONLY")}
            disabled={modeSaving}
            className={`rounded-xl border p-3 text-left text-sm transition ${
              operationalMode === "CASHIER_ONLY"
                ? "border-foreground bg-background shadow-sm"
                : "border-border bg-background/50 hover:bg-background"
            }`}
          >
            <span className="font-semibold">Kasir saja</span>
            <span className="mt-1 block text-xs text-muted-foreground">Jual menu tanpa tracking stok.</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveOperationalMode("SIMPLE_INVENTORY")}
            disabled={modeSaving}
            className={`rounded-xl border p-3 text-left text-sm transition ${
              operationalMode === "SIMPLE_INVENTORY"
                ? "border-foreground bg-background shadow-sm"
                : "border-border bg-background/50 hover:bg-background"
            }`}
          >
            <span className="font-semibold">Stok simple</span>
            <span className="mt-1 block text-xs text-muted-foreground">Belanja total saja, produksi tambah stok produk.</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveOperationalMode("WITH_INVENTORY")}
            disabled={modeSaving}
            className={`rounded-xl border p-3 text-left text-sm transition ${
              operationalMode === "WITH_INVENTORY"
                ? "border-foreground bg-background shadow-sm"
                : "border-border bg-background/50 hover:bg-background"
            }`}
          >
            <span className="font-semibold">Stok detail</span>
            <span className="mt-1 block text-xs text-muted-foreground">Tracking bahan, movement, dan produksi lengkap.</span>
          </button>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Zona Berbahaya</p>
            <p className="text-xs text-muted-foreground">
              Reset akan menghapus semua data transaksi, inventaris, produksi, dan penjualan toko.
              Data profil toko (nama, alamat, logo) tidak akan terhapus.
            </p>
          </div>
        </div>
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogTrigger
            render={
              <Button variant="destructive" size="sm" className="w-full">
                <Trash2 className="mr-2 size-4" />
                Reset Semua Data
              </Button>
            }
          />
          <DialogContent role="alertdialog">
            <DialogHeader>
              <DialogTitle>Reset Semua Data Toko</DialogTitle>
              <DialogDescription>
                Tindakan ini <strong>tidak dapat dibatalkan</strong>. Semua data berikut akan dihapus permanen:
              </DialogDescription>
            </DialogHeader>
            <ul className="ml-5 list-disc space-y-0.5 text-xs text-muted-foreground">
              <li>Produk &amp; harga</li>
              <li>Bahan baku &amp; konversi satuan</li>
              <li>Riwayat belanja &amp; produksi</li>
              <li>Riwayat penjualan &amp; pesanan</li>
              <li>Riwayat pergerakan stok</li>
            </ul>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Ketik <strong className="text-foreground">hapus {toko.name.toLowerCase()}</strong> untuk konfirmasi.
              </p>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder={`hapus ${toko.name.toLowerCase()}`}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-0 placeholder:text-muted-foreground/50 focus:border-foreground/50"
                disabled={resetting}
              />
            </div>
            <DialogFooter>
              <DialogClose
                render={
                  <Button variant="outline" size="sm" disabled={resetting}>
                    Batal
                  </Button>
                }
              />
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  resetConfirmInput.toLowerCase().trim() !==
                  `hapus ${toko.name.toLowerCase()}`
                }
                onClick={async () => {
                  setResetting(true)
                  const result = await resetTokoDataAction()
                  if (result.success) {
                    setResetDialogOpen(false)
                    setResetConfirmInput("")
                    refresh()
                    toast("success", "Semua data toko berhasil direset.")
                  } else {
                    toast("error", result.error)
                  }
                  setResetting(false)
                }}
              >
                {resetting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                {resetting ? "Mereset..." : "Reset Data"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {message && (
        <p className={`text-xs ${message.type === "error" ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
          {message.text}
        </p>
      )}
    </div>
  )
}
