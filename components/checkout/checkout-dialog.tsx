"use client"

import * as React from "react"
import { Banknote, QrCode, CreditCard, Wallet, Copy, Check, Loader2 } from "lucide-react"

import { QrisDisplay } from "@/components/qris/qris-display"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useQris } from "@/hooks/use-qris"
import { useBank } from "@/hooks/use-bank"
import { convertToDynamic } from "@/lib/qris"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/components/cashier/helpers"
import { paymentMethodLabels, paymentMethods, cashDenominations } from "@/components/cashier/constants"
import type { CartRow, PaymentMethod } from "@/components/cashier/types"

const paymentIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="size-4" />,
  qris: <QrCode className="size-4" />,
  transfer: <CreditCard className="size-4" />,
  ewallet: <Wallet className="size-4" />,
}

type CheckoutDialogProps = {
  open: boolean
  cartRows: CartRow[]
  total: number
  printerStatusLabel?: string
  isConfirming?: boolean
  errorMessage?: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (paymentMethod: PaymentMethod, amountPaid: number, customerName: string, deliveryFee: number) => void | Promise<void>
  onSaveAsPesanan?: () => void
}

export function CheckoutDialog({
  open,
  cartRows,
  total,
  printerStatusLabel,
  isConfirming = false,
  errorMessage,
  onOpenChange,
  onConfirm,
  onSaveAsPesanan,
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash")
  const [amountPaid, setAmountPaid] = React.useState(0)
  const [customerName, setCustomerName] = React.useState("")
  const [deliveryFee, setDeliveryFee] = React.useState(0)
  const [prevOpen, setPrevOpen] = React.useState(open)
  const { staticQRIS, merchantName, merchantCity } = useQris()
  const { bankInfo, hasBankInfo } = useBank()
  const [copied, setCopied] = React.useState(false)

  if (open && !prevOpen) {
    setPaymentMethod("cash")
    setAmountPaid(0)
    setCustomerName("")
    setDeliveryFee(0)
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  const grandTotal = total + deliveryFee
  const change = amountPaid > grandTotal ? amountPaid - grandTotal : 0
  const isCash = paymentMethod === "cash"
  const isQris = paymentMethod === "qris"
  const isTransfer = paymentMethod === "transfer"
  const dynamicQris = React.useMemo(() => {
    if (!isQris || !staticQRIS || grandTotal <= 0) return null

    try {
      return convertToDynamic(staticQRIS, grandTotal)
    } catch {
      return null
    }
  }, [isQris, staticQRIS, grandTotal])

  const copyBankInfo = React.useCallback(() => {
    if (!bankInfo) return
    const text = [
      `Bank: ${bankInfo.bankName}`,
      `No. Rek: ${bankInfo.accountNumber}`,
      `a.n. ${bankInfo.accountHolder}`,
      "",
      `Total: ${formatCurrency(grandTotal)}`,
    ].join("\n")
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }, [bankInfo, grandTotal])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isConfirming && !nextOpen) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-0 sm:max-w-md"
        showCloseButton={!isConfirming}
      >
        <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <DialogTitle>Pilih pembayaran</DialogTitle>
          <DialogDescription>
            Total: {formatCurrency(grandTotal)} · {cartRows.length} item
          </DialogDescription>
          {printerStatusLabel && (
            <p className="text-xs font-medium text-muted-foreground">{printerStatusLabel}</p>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Nama customer</span>
              <Input
                placeholder="Nama pelanggan"
                value={customerName}
                disabled={isConfirming}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Ongkir</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Rp
                </span>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={deliveryFee || ""}
                  disabled={isConfirming}
                  onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value) || 0))}
                  className="pl-8"
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((method) => (
              <Button
                key={method}
                type="button"
                variant={paymentMethod === method ? "default" : "outline"}
                className="justify-start gap-2"
                disabled={isConfirming}
                onClick={() => setPaymentMethod(method)}
              >
                {paymentIcons[method]}
                {paymentMethodLabels[method]}
              </Button>
            ))}
          </div>

          {isCash && (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Jumlah dibayar</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none select-none">
                      Rp
                    </span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={amountPaid || ""}
                      disabled={isConfirming}
                      onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  {amountPaid > 0 && (
                    <Button type="button" variant="ghost" size="sm" disabled={isConfirming} onClick={() => setAmountPaid(0)}>
                      Reset
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cashDenominations.map((denom) => {
                    const newAmount = amountPaid + denom
                    const isOvershoot = isCash && newAmount > grandTotal && amountPaid >= grandTotal
                    const rupiahStyle: Record<number, React.CSSProperties> = {
                      1000: { backgroundColor: "#f4f4f5", borderColor: "#d4d4d8", color: "#3f3f46" },
                      2000: { backgroundColor: "#e0f2fe", borderColor: "#bae6fd", color: "#0369a1" },
                      5000: { backgroundColor: "#fef3c7", borderColor: "#fde68a", color: "#92400e" },
                      10000: { backgroundColor: "#f3e8ff", borderColor: "#d8b4fe", color: "#7e22ce" },
                      20000: { backgroundColor: "#d1fae5", borderColor: "#a7f3d0", color: "#047857" },
                      50000: { backgroundColor: "#dbeafe", borderColor: "#bfdbfe", color: "#1d4ed8" },
                      100000: { backgroundColor: "#fecaca", borderColor: "#fca5a5", color: "#b91c1c" },
                    }
                    return (
                      <Button
                        key={denom}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isConfirming || isOvershoot}
                        onClick={() => setAmountPaid(amountPaid + denom)}
                        style={rupiahStyle[denom]}
                      >
                        {formatCurrency(denom)}
                      </Button>
                    )
                  })}
                  <Button
                    type="button"
                    variant={amountPaid === grandTotal ? "default" : "secondary"}
                    size="sm"
                    disabled={isConfirming}
                    onClick={() => setAmountPaid(grandTotal)}
                  >
                    Uang Pas
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ongkir</span>
                    <span className="font-medium">{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 text-sm">
                  <span className="text-muted-foreground">Grand total</span>
                  <span className="font-semibold">{formatCurrency(grandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dibayar</span>
                  <span className={amountPaid > 0 ? "font-medium" : "text-muted-foreground/50"}>
                    {amountPaid > 0 ? formatCurrency(amountPaid) : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 text-sm font-bold">
                  <span>{amountPaid >= grandTotal ? "Kembali" : "Kurang"}</span>
                  <span className={amountPaid >= grandTotal ? "text-emerald-600" : "text-destructive"}>
                    {formatCurrency(amountPaid >= grandTotal ? change : grandTotal - amountPaid)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {isQris && (
            <div className="space-y-3">
              {dynamicQris ? (
                <>
                  <div className="rounded-xl border bg-muted/20 p-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide">Scan QRIS</p>
                    <p className="mt-1 text-2xl font-bold">{formatCurrency(grandTotal)}</p>
                    {(merchantName || merchantCity) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[merchantName, merchantCity].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <QrisDisplay payload={dynamicQris} />
                  <p className="text-center text-xs text-muted-foreground">
                    Minta pelanggan scan QR ini, lalu tekan konfirmasi setelah pembayaran diterima.
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm">
                  <p className="font-semibold">QRIS belum dikonfigurasi</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Buka tombol pengaturan di header, lalu upload gambar QRIS statis merchant terlebih dahulu.
                  </p>
                </div>
              )}
            </div>
          )}

          {isTransfer && (
            <div className="space-y-3">
              {hasBankInfo ? (
                <>
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-0.5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <p className="font-semibold">{bankInfo!.bankName}</p>
                        <p className="text-sm text-muted-foreground">{bankInfo!.accountNumber}</p>
                        <p className="text-xs text-muted-foreground">a.n. {bankInfo!.accountHolder}</p>
                      </div>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs text-muted-foreground">Total transfer</p>
                      <p className="text-lg font-bold">{formatCurrency(grandTotal)}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={isConfirming}
                    onClick={copyBankInfo}
                  >
                    {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                    {copied ? "Tersalin" : "Salin info rekening"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Copy info rekening dan kirimkan ke pelanggan. Konfirmasi setelah transfer diterima.
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm">
                  <p className="font-semibold">Info rekening belum diisi</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Buka tombol pengaturan di header, lalu masukkan data rekening bank terlebih dahulu.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex w-full flex-col gap-2">
            {errorMessage ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}
            <Button
              type="button"
              disabled={isConfirming || (isCash && amountPaid < grandTotal) || (isQris && !dynamicQris) || (isTransfer && !hasBankInfo)}
              onClick={() => {
                void onConfirm(paymentMethod, isCash ? amountPaid : grandTotal, customerName, deliveryFee)
              }}
              className="font-medium"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memproses transaksi...
                </>
              ) : (
                <>Konfirmasi pembayaran ({formatCurrency(isCash ? amountPaid : grandTotal)})</>
              )}
            </Button>
            {onSaveAsPesanan && (
              <Button
                type="button"
                variant="outline"
                disabled={isConfirming}
                onClick={() => onSaveAsPesanan()}
                className="font-medium"
              >
                Simpan sebagai Pesanan
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
