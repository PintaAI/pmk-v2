"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { ClipboardList, Package, Truck, Banknote, CheckCircle, XCircle } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TabsPageHeader } from "@/components/layout/tabs-page-header"
import { Stats } from "@/components/stats"
import { cn } from "@/lib/utils"
import { PesananDetailDrawer } from "./pesanan-detail-drawer"
import { CreatePesananDrawer } from "./create-pesanan-drawer"
import type { PesananItem, ProductOption } from "./types"
import { formatCurrency, formatDate } from "./types"

type Props = {
  pesananList: PesananItem[]
  productList: ProductOption[]
  productNames: Record<string, string>
}

export function PesananTabs({ pesananList, productList, productNames }: Props) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab") || "semua"
  const [detail, setDetail] = useState<PesananItem | null>(null)

  const active = pesananList.filter((p) => !p.cancelledAt)
  const pending = active.filter(
    (p) => p.statusPengiriman === "BELUM" || p.statusPembayaran === "BELUM"
  )
  const selesai = active.filter(
    (p) => p.statusPengiriman === "DIKIRIM" && p.statusPembayaran === "DIBAYAR"
  )
  const dibatalkan = pesananList.filter((p) => p.cancelledAt)

  function getFiltered() {
    switch (activeTab) {
      case "pending": return pending
      case "belum-dikirim": return active.filter((p) => p.statusPengiriman === "BELUM")
      case "belum-dibayar": return active.filter((p) => p.statusPembayaran === "BELUM")
      case "selesai": return selesai
      case "dibatalkan": return dibatalkan
      default: return pesananList
    }
  }

  const filtered = getFiltered()

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    const query = params.toString()
    window.history.replaceState(null, "", query ? `/pesanan?${query}` : "/pesanan")
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="h-[calc(100dvh-146px)] min-h-0 gap-2 md:h-[calc(100dvh-4rem)]">
      <TabsPageHeader
        title="Pesanan"
        icon={ClipboardList}
        tabs={[
          { value: "semua", label: "Semua", icon: ClipboardList },
          { value: "belum-dikirim", label: "Belum Dikirim", icon: Truck },
          { value: "belum-dibayar", label: "Belum Dibayar", icon: Banknote },
          { value: "selesai", label: "Selesai", icon: CheckCircle },
          { value: "dibatalkan", label: "Batal", icon: XCircle },
        ]}
      >
        <Stats
          main={2}
          items={[
            { label: "Total Pesanan", value: pesananList.length.toString(), icon: ClipboardList },
            { label: "Pending", value: pending.length.toString(), icon: Package },
            { label: "Selesai", value: selesai.length.toString(), icon: CheckCircle },
            { label: "Dibatalkan", value: dibatalkan.length.toString(), icon: XCircle },
          ]}
        />
      </TabsPageHeader>

      <TabsContent value={activeTab} className="flex min-h-0 flex-col">
        {filtered.length ? (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="mt-3 min-h-0 flex-1 rounded-xl border bg-muted/20 md:rounded-3xl">
              {filtered.map((pesanan) => (
                <PesananRow
                  key={pesanan.id}
                  pesanan={pesanan}
                  productNames={productNames}
                  onClick={() => setDetail(pesanan)}
                />
              ))}
            </ScrollArea>
          </section>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
            <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center md:rounded-3xl">
              <p className="font-medium">Belum ada pesanan</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Pesanan yang dibuat akan muncul di sini.
              </p>
            </div>
          </div>
        )}
      </TabsContent>

      {detail && (
        <PesananDetailDrawer
          pesanan={detail}
          open={!!detail}
          onOpenChange={(open) => !open && setDetail(null)}
          onSuccess={() => {
            setDetail(null)
            window.location.reload()
          }}
          productNames={productNames}
        />
      )}

      <CreatePesananDrawer productList={productList} />
    </Tabs>
  )
}

function PesananRow({
  pesanan,
  productNames,
  onClick,
}: {
  pesanan: PesananItem
  productNames: Record<string, string>
  onClick: () => void
}) {
  const itemsPreview = pesanan.items
    .slice(0, 2)
    .map((item) => `${productNames[item.productId] ?? "?"} ${item.qty}`)
    .join(", ")

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 transition-colors hover:bg-muted/30 md:gap-3 md:px-4 md:py-3"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20">
        <ClipboardList className="size-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 md:gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {pesanan.namaPelanggan || pesanan.kode}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {pesanan.kode} · {itemsPreview}{pesanan.items.length > 2 ? ` +${pesanan.items.length - 2}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-1">
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              pesanan.statusPengiriman === "DIKIRIM"
                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                : "bg-muted text-muted-foreground"
            )}>
              {pesanan.statusPengiriman === "DIKIRIM" ? "Dikirim" : "Belum"}
            </span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              pesanan.statusPembayaran === "DIBAYAR"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground"
            )}>
              {pesanan.statusPembayaran === "DIBAYAR" ? "Dibayar" : "Belum"}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium tabular-nums">
            {formatCurrency(pesanan.total)}
          </p>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            {formatDate(pesanan.tanggal)}
          </p>
        </div>
      </div>
    </button>
  )
}
