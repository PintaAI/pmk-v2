"use client"

import { useRef, useState } from "react"
import jsQR from "jsqr"
import { QrCode, ImageUp, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useQris } from "@/hooks/use-qris"
import { normalizeQRIS, validateQRIS } from "@/lib/qris"

export function QrisSettings() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { hasQRIS, merchantName, merchantCity, setStaticQRIS, clearQRIS } = useQris()
  const [pendingPayload, setPendingPayload] = useState<string | null>(null)
  const [pendingInfo, setPendingInfo] = useState<{ merchantName?: string; merchantCity?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDecoding, setIsDecoding] = useState(false)

  async function handleFile(file: File) {
    setIsDecoding(true)
    setError(null)
    setPendingPayload(null)
    setPendingInfo(null)

    try {
      const payload = await decodeQRFromImage(file)
      const normalizedPayload = normalizeQRIS(payload)
      const validation = validateQRIS(normalizedPayload)

      if (!validation.valid) {
        throw new Error(validation.errors[0] ?? "QR yang diunggah bukan QRIS yang valid")
      }

      setPendingPayload(normalizedPayload)
      setPendingInfo({
        merchantName: validation.data?.merchantName,
        merchantCity: validation.data?.merchantCity,
      })
    } catch (decodeError) {
      setError(decodeError instanceof Error ? decodeError.message : "Gagal membaca gambar QRIS")
    } finally {
      setIsDecoding(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleSave() {
    if (pendingPayload) {
      setStaticQRIS(pendingPayload)
      setPendingPayload(null)
      setPendingInfo(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">QRIS</span>
        {hasQRIS && !pendingPayload && (
          <Badge variant="default" className="ml-auto text-[10px]">Tersimpan</Badge>
        )}
      </div>

      <div className="ml-3 space-y-3">
        {isDecoding && (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-xs">Membaca QR code&hellip;</span>
          </div>
        )}

        {!isDecoding && !hasQRIS && !pendingPayload && !error && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6">
            <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
              <QrCode className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Belum ada QRIS</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Upload gambar QRIS statis untuk generate nominal otomatis saat checkout.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <ImageUp className="size-3.5" />
              Upload QRIS
            </Button>
          </div>
        )}

        {hasQRIS && !pendingPayload && !error && (
          <div className="rounded-lg border bg-muted/10 p-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{merchantName ?? "QRIS tersimpan"}</p>
                {merchantCity && (
                  <p className="text-xs text-muted-foreground">{merchantCity}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <ImageUp className="size-3.5" />
                    Ganti
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive gap-1.5"
                    onClick={clearQRIS}
                  >
                    <Trash2 className="size-3.5" />
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {pendingPayload && pendingInfo && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <QrCode className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pendingInfo.merchantName ?? "QRIS valid"}</p>
                {pendingInfo.merchantCity && (
                  <p className="text-xs text-muted-foreground">{pendingInfo.merchantCity}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={handleSave} className="gap-1.5">
                    <CheckCircle2 className="size-3.5" />
                    Simpan
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setPendingPayload(null); setPendingInfo(null) }}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span>{error}</span>
              <div className="mt-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setError(null); fileInputRef.current?.click() }}
                  className="gap-1.5 h-7 text-xs"
                >
                  <ImageUp className="size-3" />
                  Coba lagi
                </Button>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
      </div>
    </div>
  )
}

async function decodeQRFromImage(file: File) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Browser tidak mendukung pembacaan gambar")

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height)

  if (!result?.data) {
    throw new Error("QR code tidak ditemukan pada gambar")
  }

  return result.data
}
