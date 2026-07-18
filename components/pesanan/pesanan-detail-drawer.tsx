"use client"

import { useState } from "react"
import { Package, User, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { useMobile } from "@/hooks/use-mobile"
import { useToast } from "@/components/ui/toast"
import {
  cancelPesananAction,
  completePesananAction,
  updateStatusPengirimanAction,
  updateStatusPembayaranAction,
} from "@/app/actions/pesanan-actions"
import { SaleChannel } from "@/server/domain/types"
import { formatCurrency, formatQty, formatDate } from "./types"
import type { PesananItem } from "./types"

type Props = {
  pesanan: PesananItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  productNames: Record<string, string>
}

const channelLabels: Record<SaleChannel, string> = {
  CASHIER: "Kasir",
  RESELLER: "Reseller",
  ONLINE: "Online",
}

export function PesananDetailDrawer({ pesanan, open, onOpenChange, onSuccess, productNames }: Props) {
  const isMobile = useMobile()
  const { toast } = useToast()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState("")
  const [showConvert, setShowConvert] = useState(false)

  const isDibatalkan = Boolean(pesanan.cancelledAt)
  const isSelesai = pesanan.statusPengiriman === "DIKIRIM" && pesanan.statusPembayaran === "DIBAYAR"

  async function handleAction(action: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    setIsPending(true)
    setError("")
    try {
      const result = await action()
      if (result.success) {
        toast("success", successMsg)
        onOpenChange(false)
        onSuccess()
      } else {
        setError(result.error ?? "Gagal")
        toast("error", result.error ?? "Gagal")
      }
    } finally {
      setIsPending(false)
    }
  }

  const content = (
    <div className="flex flex-col gap-4">
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Package className="size-4 text-muted-foreground" />
          {pesanan.kode}
        </div>
        {pesanan.namaPelanggan && (
          <div className="flex items-center gap-2 text-sm">
            <User className="size-4 text-muted-foreground" />
            {pesanan.namaPelanggan}
            {pesanan.kontak && <span className="text-xs text-muted-foreground">({pesanan.kontak})</span>}
          </div>
        )}
        {pesanan.catatan && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <FileText className="mt-0.5 size-3 shrink-0" />
            {pesanan.catatan}
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold">{formatCurrency(pesanan.total)}</span>
        </div>
      </div>

      <div className="flex gap-2">
        {isDibatalkan ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            Dibatalkan
          </span>
        ) : null}
        {!isDibatalkan ? (
          <>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          pesanan.statusPengiriman === "DIKIRIM"
            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
            : "bg-muted text-muted-foreground"
        }`}>
          {pesanan.statusPengiriman === "DIKIRIM" ? "Dikirim" : "Belum Dikirim"}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          pesanan.statusPembayaran === "DIBAYAR"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-muted text-muted-foreground"
        }`}>
          {pesanan.statusPembayaran === "DIBAYAR" ? "Dibayar" : "Belum Dibayar"}
        </span>
          </>
        ) : null}
      </div>

      {pesanan.items.length > 0 && (
        <div className="rounded-xl border bg-muted/20">
          <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Item Pesanan
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Produk</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Harga</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {pesanan.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{productNames[item.productId] ?? item.productId}</td>
                  <td className="px-4 py-2 text-right">{formatQty(item.qty)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!isDibatalkan && pesanan.statusPengiriman === "BELUM" && (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction(() => updateStatusPengirimanAction(pesanan.id, "DIKIRIM"), "Pesanan ditandai dikirim.")}
          >
            {isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Tandai Dikirim
          </Button>
        )}
        {!isDibatalkan && pesanan.statusPembayaran === "BELUM" && (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction(() => updateStatusPembayaranAction(pesanan.id, "DIBAYAR"), "Pesanan ditandai dibayar.")}
          >
            {isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Tandai Dibayar
          </Button>
        )}
        {!isDibatalkan && !isSelesai && (
          <>
            {!showConvert ? (
              <Button
                variant="default"
                size="sm"
                disabled={isPending}
                onClick={() => setShowConvert(true)}
              >
                Selesaikan Pesanan
              </Button>
            ) : (
              <div className="flex flex-wrap gap-1">
                {Object.entries(channelLabels).map(([channel, label]) => (
                  <Button
                    key={channel}
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleAction(() => completePesananAction(pesanan.id, channel as SaleChannel), "Pesanan selesai dan tercatat sebagai transaksi.")}
                  >
                    {isPending && <Loader2 className="mr-1 size-3 animate-spin" />}
                    {label}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
        {!isDibatalkan && !isSelesai && (
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction(() => cancelPesananAction(pesanan.id), "Pesanan dibatalkan.")}
          >
            {isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Batalkan
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
        Dibuat {formatDate(pesanan.tanggal)}
      </p>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onClose={() => onOpenChange(false)}>
        <DrawerContent className="mx-auto h-[85dvh] max-h-[85dvh] max-w-lg overflow-hidden">
          <DrawerHeader>
            <DrawerTitle>{pesanan.kode}</DrawerTitle>
            <DrawerDescription>
              {pesanan.namaPelanggan ?? "Pesanan"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pesanan.kode}</DialogTitle>
          <DialogDescription>
            {pesanan.namaPelanggan ?? "Pesanan"}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
