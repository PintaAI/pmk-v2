"use client"

import * as React from "react"
import { BarChart3, CalendarDays, Printer, ReceiptText, RefreshCcw } from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"

import {
  getDailyClosingRecapAction,
  logClosingPrintAction,
  type DailyClosingRecap,
} from "@/app/actions/closing-actions"
import { formatCurrency } from "@/components/cashier/helpers"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ClosingDialogProps = {
  open: boolean
  printerStatusLabel?: string
  onOpenChange: (open: boolean) => void
  onPrint: (recap: DailyClosingRecap) => void
}

const paymentRows = [
  ["Tunai", "cash"],
  ["QRIS", "qris"],
  ["Transfer", "transfer"],
  ["E-Wallet", "ewallet"],
  ["Lainnya", "other"],
] as const

export function ClosingDialog({ open, printerStatusLabel, onOpenChange, onPrint }: ClosingDialogProps) {
  const recapQuery = useQuery({
    queryKey: ["closingan", "daily-recap"],
    queryFn: getDailyClosingRecapAction,
    enabled: open,
  })
  const printMutation = useMutation({
    mutationFn: logClosingPrintAction,
    onSuccess: (result) => {
      if (result.success) {
        onPrint(result.data)
      }
    },
  })

  const recap = recapQuery.data?.success ? recapQuery.data.data : null
  const error = recapQuery.data?.success === false ? recapQuery.data.error : null
  const printError = printMutation.data?.success === false ? printMutation.data.error : null
  const isLoading = recapQuery.isLoading || recapQuery.isFetching

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <div className="relative isolate border-b bg-[radial-gradient(circle_at_20%_0%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_38%),linear-gradient(135deg,var(--popover),var(--muted))] p-4 pb-5">
          <div className="pointer-events-none absolute -right-10 -top-12 -z-10 size-32 rounded-full border border-foreground/10" />
          <DialogHeader>
            <div className="flex items-start gap-3 pr-8">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-foreground text-background shadow-sm">
                <ReceiptText className="size-5" />
              </span>
              <div>
                <DialogTitle>Closingan hari ini</DialogTitle>
                <DialogDescription className="mt-1">
                  Rekap penjualan harian untuk dicetak ke thermal printer.
                </DialogDescription>
                {printerStatusLabel ? (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">{printerStatusLabel}</p>
                ) : null}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="max-h-[68dvh] space-y-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Mengambil data closingan...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : recap ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Transaksi" value={String(recap.totalTransactions)} icon={<CalendarDays className="size-4" />} />
                <MetricCard label="Item Terjual" value={`${formatQty(recap.totalItems)}x`} icon={<BarChart3 className="size-4" />} />
              </div>

              <div className="rounded-3xl border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Penjualan Bersih</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(recap.netTotal)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{recap.dateLabel}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/40 px-3 py-2 text-right text-xs">
                    <p className="text-muted-foreground">Kasir</p>
                    <p className="font-semibold">{recap.cashierName}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                  <SummaryRow label="Omzet" value={formatCurrency(recap.grossTotal)} />
                  <SummaryRow label="Diskon" value={formatCurrency(recap.totalDiscount)} />
                </div>
              </div>

              <section className="rounded-3xl border bg-muted/20 p-3">
                <h3 className="text-sm font-semibold">Pembayaran</h3>
                <div className="mt-3 space-y-2">
                  {paymentRows.map(([label, key]) => (
                    <SummaryRow key={key} label={label} value={formatCurrency(recap.paymentBreakdown[key])} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border bg-card p-3 shadow-sm">
                <h3 className="text-sm font-semibold">Top 5 produk hari ini</h3>
                <p className="mt-1 text-xs text-muted-foreground">Diurutkan berdasarkan jumlah terjual.</p>
                <div className="mt-3 space-y-2">
                  {recap.topItems.length > 0 ? (
                    recap.topItems.map((item, index) => (
                      <div key={item.productId} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/30 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{index + 1}. {item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatQty(item.qty)}x terjual</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">{formatCurrency(item.total)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                      Belum ada penjualan hari ini.
                    </p>
                  )}
                </div>
              </section>

              {printError ? <p className="text-sm text-destructive">{printError}</p> : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="m-0 rounded-none">
          <Button type="button" variant="outline" onClick={() => recapQuery.refetch()} disabled={isLoading}>
            <RefreshCcw className="size-4" />
            Refresh
          </Button>
          <Button type="button" onClick={() => printMutation.mutate()} disabled={!recap || printMutation.isPending}>
            <Printer className="size-4" />
            {printMutation.isPending ? "Menyiapkan..." : "Print Closingan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function formatQty(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value)
}
