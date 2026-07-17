"use client"

import { useState } from "react"
import { ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMobile } from "@/hooks/use-mobile"
import { useActionParam } from "@/hooks/use-action-param"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"

type BelanjaItem = {
  id: string
  bahanName: string
  unit: string
  qty: string
  unitPrice: string
  subtotal: string
}

type BelanjaRecord = {
  id: string
  date: string
  supplier: string | null
  note: string | null
  status: string
  totalAmount: string
  items: BelanjaItem[]
}

type DraftItem = {
  id: number
  bahanId: string
  bahanName: string
  qty: string
  unitPrice: string
  bought: boolean
}

type BelanjaDraft = {
  supplier: string
  note: string
  totalAmount?: string
  items: DraftItem[]
}

type DetailView =
  | { type: "saved"; data: BelanjaRecord }
  | { type: "draft"; data: BelanjaDraft }
  | null

type Props = {
  belanjaList: BelanjaRecord[]
}

const STORAGE_KEY = "pmk:create-belanja-draft"

function readStoredDraft() {
  if (typeof window === "undefined") return null

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored) as BelanjaDraft
    if (Array.isArray(parsed.items) && (parsed.items.some((item) => item.bahanId) || Number(parsed.totalAmount) > 0)) {
      return parsed
    }
  } catch {
    // ignore invalid localStorage draft
  }

  return null
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function BelanjaHistoryTab({ belanjaList }: Props) {
  const { openAction } = useActionParam()
  const [draft] = useState<BelanjaDraft | null>(readStoredDraft)
  const [detail, setDetail] = useState<DetailView>(null)

  if (belanjaList.length === 0 && !draft) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="m-auto rounded-xl border border-dashed bg-muted/20 p-6 text-center md:rounded-3xl">
          <p className="font-medium">Belum ada riwayat belanja</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Riwayat belanja akan muncul setelah kamu mencatat pembelian bahan.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-2">
      {draft && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Daftar Belanja
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border bg-white/60 md:rounded-3xl dark:bg-background/60">
            <DraftRow draft={draft} onClick={() => openAction("create-belanja")} />
          </div>
        </section>
      )}

      {belanjaList.length > 0 && (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Riwayat Belanja
          </p>
          <ScrollArea className="mt-3 min-h-0 flex-1 rounded-xl border bg-muted/20 md:rounded-3xl">
            {belanjaList.map((belanja) => (
              <BelanjaRow
                key={belanja.id}
                belanja={belanja}
                onClick={() => setDetail({ type: "saved", data: belanja })}
              />
            ))}
          </ScrollArea>
        </section>
      )}

      {detail && (
        <BelanjaDetailModal detail={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}

function DraftRow({ draft, onClick }: { draft: BelanjaDraft; onClick: () => void }) {
  const validItems = draft.items.filter((item) => item.bahanId)
  const isSimpleDraft = validItems.length === 0 && Number(draft.totalAmount) > 0
  const totalCost = isSimpleDraft ? Number(draft.totalAmount) : validItems.reduce(
    (total, item) => total + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0,
  )
  const boughtCount = validItems.filter((item) => item.bought).length

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 transition-colors hover:bg-amber-100/50 md:gap-3 md:px-4 md:py-3 dark:hover:bg-amber-900/20"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-200/60 dark:bg-amber-800/40">
        <ShoppingCart className="size-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 md:gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {draft.supplier || "Belanja"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {isSimpleDraft ? "Belanja simple" : `${boughtCount}/${validItems.length} item terbeli`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium tabular-nums">
            {formatRupiah(totalCost)}
          </p>
          <p className="text-xs text-muted-foreground">Daftar Belanja</p>
        </div>
      </div>
    </button>
  )
}

function BelanjaRow({ belanja, onClick }: { belanja: BelanjaRecord; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 transition-colors hover:bg-muted/30 md:gap-3 md:px-4 md:py-3"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20">
        <ShoppingCart className="size-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 md:gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {belanja.supplier || "Belanja"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {belanja.items.length > 0 ? `${belanja.items.length} item` : "Belanja simple"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium tabular-nums">
            {formatRupiah(Number(belanja.totalAmount))}
          </p>
          <time className="text-xs text-muted-foreground" suppressHydrationWarning>
            {formatDate(belanja.date)}
          </time>
        </div>
      </div>
    </button>
  )
}

function BelanjaDetailModal({
  detail,
  onClose,
}: {
  detail: DetailView
  onClose: () => void
}) {
  const isMobile = useMobile()

  if (!detail) return null

  const title = detail.type === "saved"
    ? detail.data.supplier || "Belanja"
    : "Draft Belanja"

  const description = detail.type === "saved"
    ? formatDate(detail.data.date)
    : "Belum disimpan ke database"

  if (isMobile) {
    return (
      <Drawer open onClose={onClose}>
        <DrawerContent className="mx-auto h-[85dvh] max-h-[85dvh] max-w-lg overflow-hidden">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <DetailBody detail={detail} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DetailBody detail={detail} />
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({ detail }: { detail: NonNullable<DetailView> }) {
  if (detail.type === "saved") {
    return <SavedDetail belanja={detail.data} />
  }
  return <DraftDetail draft={detail.data} />
}

function SavedDetail({ belanja }: { belanja: BelanjaRecord }) {
  const isSimpleBelanja = belanja.items.length === 0

  return (
    <div className="flex flex-col gap-3">
      {isSimpleBelanja ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          Belanja ini dicatat dalam mode simple, jadi tidak ada detail bahan atau movement stok bahan.
        </div>
      ) : (
        <ScrollArea className="max-h-[50vh] rounded-xl border bg-muted/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Bahan</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Harga</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {belanja.items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{item.bahanName}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {item.qty} {item.unit}
                  </td>
                  <td className="px-4 py-2 text-right">{formatRupiah(Number(item.unitPrice))}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatRupiah(Number(item.subtotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}

      {belanja.note && (
        <div className="rounded-lg bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {belanja.note}
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
        <span>Total</span>
        <span>{formatRupiah(Number(belanja.totalAmount))}</span>
      </div>
    </div>
  )
}

function DraftDetail({ draft }: { draft: BelanjaDraft }) {
  const validItems = draft.items.filter((item) => item.bahanId)
  const isSimpleDraft = validItems.length === 0 && Number(draft.totalAmount) > 0
  const totalCost = isSimpleDraft ? Number(draft.totalAmount) : validItems.reduce(
    (total, item) => total + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0),
    0,
  )
  const boughtCount = validItems.filter((item) => item.bought).length

  return (
    <div className="flex flex-col gap-3">
      {draft.supplier && (
        <div className="text-sm text-muted-foreground">Supplier: {draft.supplier}</div>
      )}

      {isSimpleDraft ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          Draft belanja simple hanya berisi total belanja.
        </div>
      ) : (
        <ScrollArea className="max-h-[50vh] rounded-xl border bg-muted/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Bahan</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Qty</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Harga</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {validItems.map((item) => {
                const subtotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0)
                return (
                  <tr
                    key={item.id}
                    className={cn("border-b last:border-b-0", item.bought && "opacity-50")}
                  >
                    <td className="px-4 py-2 font-medium">{item.bahanName}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{item.qty}</td>
                    <td className="px-4 py-2 text-right">
                      {formatRupiah(Number(item.unitPrice) || 0)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatRupiah(subtotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollArea>
      )}

      {draft.note && (
        <div className="rounded-lg bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {draft.note}
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
        <span>Total</span>
        <span>{formatRupiah(totalCost)}</span>
      </div>

      {!isSimpleDraft && (
        <div className="text-xs text-muted-foreground">
          {boughtCount}/{validItems.length} item terbeli
        </div>
      )}
    </div>
  )
}
