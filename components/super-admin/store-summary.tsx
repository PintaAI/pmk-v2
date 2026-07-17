import {
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  PackageCheck,
  ReceiptText,
  Store,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type StoreSummary = {
  id: string
  name: string
  address: string | null
  operationalMode: string
  createdAt: string
  revenue: number
  revenueToday: number
  dailyRate: number
  expenses: number
  transactionCount: number
  memberCount: number
  activeProductCount: number
}

type GlobalSummary = {
  revenue: number
  revenueToday: number
  dailyRate: number
  storeCount: number
  userCount: number
  transactionCount: number
}

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

const compactCurrency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 1,
})

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
})

const modeLabels: Record<string, string> = {
  CASHIER_ONLY: "Kasir",
  SIMPLE_INVENTORY: "Inventori sederhana",
  WITH_INVENTORY: "Inventori penuh",
}

export function StorePerformanceSummary({
  global,
  stores,
}: {
  global: GlobalSummary
  stores: StoreSummary[]
}) {
  const globalStats = [
    {
      label: "Revenue sepanjang waktu",
      value: currency.format(global.revenue),
      detail: `${global.transactionCount.toLocaleString("id-ID")} transaksi selesai`,
      icon: CircleDollarSign,
    },
    {
      label: "Revenue hari ini",
      value: currency.format(global.revenueToday),
      detail: "Hari berjalan, zona waktu Jakarta",
      icon: ArrowUpRight,
    },
    {
      label: "Daily rate",
      value: currency.format(global.dailyRate),
      detail: "Rata-rata sejak penjualan pertama",
      icon: TrendingUp,
    },
    {
      label: "Jaringan aktif",
      value: `${global.storeCount} toko`,
      detail: `${global.userCount} pengguna terdaftar`,
      icon: Store,
    },
  ]

  return (
    <section className="mb-8 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {globalStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.label}
              className={index === 0 ? "border-0 bg-foreground text-background ring-0" : "border-0 bg-card/80 ring-1 ring-foreground/10"}
            >
              <CardContent className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${index === 0 ? "text-background/60" : "text-muted-foreground"}`}>
                    {stat.label}
                  </p>
                  <p className="mt-2 truncate text-xl font-semibold tracking-tight">{stat.value}</p>
                  <p className={`mt-1 text-xs ${index === 0 ? "text-background/55" : "text-muted-foreground"}`}>
                    {stat.detail}
                  </p>
                </div>
                <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${index === 0 ? "bg-background/10" : "bg-primary/10 text-primary"}`}>
                  <Icon className="size-4" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Portofolio toko</p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">Kinerja per toko</h2>
          </div>
          <Badge variant="outline">{stores.length} toko</Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {stores.map((store, index) => {
            const difference = store.revenue - store.expenses
            return (
              <Card key={store.id} className="border-0 bg-card/80 ring-1 ring-foreground/10 backdrop-blur">
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-heading text-sm font-semibold text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{store.name}</CardTitle>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {store.address || "Alamat belum diisi"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{modeLabels[store.operationalMode] ?? store.operationalMode}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Metric icon={WalletCards} label="Total revenue" value={compactCurrency.format(store.revenue)} title={currency.format(store.revenue)} />
                    <Metric icon={ArrowUpRight} label="Hari ini" value={compactCurrency.format(store.revenueToday)} title={currency.format(store.revenueToday)} />
                    <Metric icon={TrendingUp} label="Daily rate" value={compactCurrency.format(store.dailyRate)} title={currency.format(store.dailyRate)} />
                    <Metric
                      icon={CircleDollarSign}
                      label="Revenue - belanja"
                      value={compactCurrency.format(difference)}
                      title={`${currency.format(store.revenue)} - ${currency.format(store.expenses)}`}
                      negative={difference < 0}
                    />
                  </div>

                  <div className="grid grid-cols-3 divide-x rounded-xl bg-muted/45 py-2.5 text-center">
                    <SmallMetric icon={ReceiptText} value={store.transactionCount} label="Transaksi" />
                    <SmallMetric icon={Users} value={store.memberCount} label="Anggota" />
                    <SmallMetric icon={PackageCheck} value={store.activeProductCount} label="Produk aktif" />
                  </div>

                  <div className="flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
                    <CalendarDays className="size-3" />
                    Dibuat {dateFormatter.format(new Date(store.createdAt))}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {stores.length === 0 ? (
            <Card className="border-dashed bg-transparent lg:col-span-2">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Belum ada toko yang dibuat.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  title,
  negative = false,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  title: string
  negative?: boolean
}) {
  return (
    <div className="min-w-0" title={title}>
      <p className="flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
        <Icon className="size-3" /> {label}
      </p>
      <p className={`mt-1 truncate text-sm font-semibold ${negative ? "text-destructive" : ""}`}>{value}</p>
    </div>
  )
}

function SmallMetric({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <div className="px-2">
      <p className="flex items-center justify-center gap-1 text-sm font-semibold">
        <Icon className="size-3 text-muted-foreground" /> {value.toLocaleString("id-ID")}
      </p>
      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  )
}
