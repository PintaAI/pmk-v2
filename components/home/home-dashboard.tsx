import Link from "next/link"
import { ArrowDown, ArrowUp, Package, ShoppingCart, Cog, DollarSign, Layers, ClipboardList, Receipt, Factory, Boxes, Archive } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Stats } from "@/components/stats"
import { HomeDashboardHeading } from "./home-dashboard-heading"
import type { OperationalMode } from "@/generated/prisma/client"

type ActivityItem = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  metadata: unknown
  createdAt: string
}

type HomeDashboardProps = {
  activity: ActivityItem[]
  gross: number
  expense: number
  net: number
  pesananPending?: number
  operationalMode: OperationalMode
}

const activityConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  created_bahan: { icon: Package, label: "Bahan baru" },
  updated_bahan: { icon: Package, label: "Bahan diperbarui" },
  deleted_bahan: { icon: Package, label: "Bahan dihapus" },
  created_product: { icon: Layers, label: "Produk baru" },
  updated_product: { icon: Layers, label: "Produk diperbarui" },
  archived_product: { icon: Layers, label: "Produk diarsipkan" },
  created_belanja: { icon: ShoppingCart, label: "Belanja baru" },
  created_production: { icon: Cog, label: "Produksi baru" },
  created_sale: { icon: DollarSign, label: "Penjualan baru" },
  created_pesanan: { icon: ClipboardList, label: "Pesanan baru" },
  pesanan_dikirim: { icon: ClipboardList, label: "Pesanan dikirim" },
  pesanan_dibayar: { icon: ClipboardList, label: "Pesanan dibayar" },
  pesanan_converted: { icon: DollarSign, label: "Pesanan dikonversi" },
  cancelled_pesanan: { icon: ClipboardList, label: "Pesanan dibatalkan" },
}

function getActivityConfig(item: ActivityItem) {
  const metadata = getMetadata(item.metadata)

  if (item.action === "created_belanja" && metadata.simpleMode) {
    return { icon: ShoppingCart, label: "Belanja simple" }
  }

  if (item.action === "created_production" && metadata.simpleMode) {
    return { icon: Cog, label: "Tambah stok produksi" }
  }

  return (
    activityConfig[item.action] ?? {
      icon: Package,
      label: item.action.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    }
  )
}

export function HomeDashboard({ activity, gross, expense, net, pesananPending = 0, operationalMode }: HomeDashboardProps) {
  return (
    <div className="flex h-[calc(100dvh-146px)] min-h-0 flex-col gap-2 md:h-[calc(100dvh-4rem)]">
      <div className="relative isolate space-y-2 px-1 pt-1 mb-2">
        <HomeDashboardHeading />

        <Stats
          main={1}
          items={[
            {
              label: "Omzet (30 Hari)",
              value: formatCurrency(gross),
              icon: DollarSign,
              valueClassName: "text-emerald-600",
            },
            {
              label: "Laba Bersih",
              value: formatCurrencyCompact(net),
              icon: net >= 0 ? ArrowUp : ArrowDown,
              iconClassName: net >= 0 ? "text-emerald-600" : "text-red-500",
              valueClassName: net >= 0 ? "text-emerald-600" : "text-red-500",
            },
            {
              label: "Biaya",
              value: formatCurrencyCompact(expense),
              icon: ArrowDown,
              iconClassName: "text-red-500",
              valueClassName: "text-red-500",
            },
            pesananPending > 0 ? {
              label: "Pesanan Pending",
              value: pesananPending.toString(),
              icon: ClipboardList,
              iconClassName: "text-orange-500",
              valueClassName: "text-orange-500",
            } : null,
          ].filter((item): item is NonNullable<typeof item> => item !== null)}
        />
      </div>

      <QuickActionStrip operationalMode={operationalMode} />

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Activity
        </p>

        {activity.length ? (
          <ScrollArea className="mt-3 min-h-0 flex-1 rounded-xl border bg-muted/20 md:rounded-3xl">
            {activity.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ScrollArea>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
            <div className="m-auto rounded-xl border border-dashed bg-muted/20 p-6 text-center md:rounded-3xl">
              <p className="font-medium">Belum ada aktivitas</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Aktivitas akan muncul setelah user membuat bahan, produk, belanja, produksi, atau sale.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function QuickActionStrip({ operationalMode }: { operationalMode: OperationalMode }) {
  const isCashierOnly = operationalMode === "CASHIER_ONLY"
  const isSimpleMode = operationalMode === "SIMPLE_INVENTORY"
  const actions = getHomeQuickActions(operationalMode)

  return (
    <section className="px-1">
      <div className="mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Quick Actions
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isCashierOnly
            ? "Mode kasir saja: hanya aksi penjualan ditampilkan."
            : isSimpleMode
              ? "Mode simple: belanja total dan tambah stok produk langsung."
              : "Mode detail: semua fitur operasional tersedia."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon

          return (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl border bg-background p-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/30 hover:shadow-md active:translate-y-0"
            >
              <span className={`mb-3 flex size-9 items-center justify-center rounded-xl ${action.accent}`}>
                <Icon className="size-4" />
              </span>
              <span className="block text-sm font-semibold leading-tight">{action.label}</span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">{action.description}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function getHomeQuickActions(operationalMode: OperationalMode) {
  if (operationalMode === "CASHIER_ONLY") {
    return [
      {
        label: "Keranjang Kasir",
        description: "Buka cart penjualan",
        href: "/cashier?action=open-cart",
        icon: ShoppingCart,
        accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      },
    ]
  }

  if (operationalMode === "SIMPLE_INVENTORY") {
    return [
      {
        label: "Belanja Simple",
        description: "Total belanja saja",
        href: "/inventory?action=create-belanja",
        icon: Receipt,
        accent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
      },
      {
        label: "Tambah Stok",
        description: "Bulk add produk",
        href: "/production?tab=history&action=create-production",
        icon: Factory,
        accent: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
      },
      {
        label: "Produk Baru",
        description: "Katalog & harga",
        href: "/production?action=create-product",
        icon: Boxes,
        accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      },
      {
        label: "Keranjang Kasir",
        description: "Buka cart penjualan",
        href: "/cashier?action=open-cart",
        icon: ShoppingCart,
        accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      },
    ]
  }

  return [
    {
      label: "Belanja Bahan",
      description: "Pembelian bahan",
      href: "/inventory?action=create-belanja",
      icon: Receipt,
      accent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    {
      label: "Bahan Baru",
      description: "Tambah stok awal",
      href: "/inventory?action=create-bahan",
      icon: Archive,
      accent: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    },
    {
      label: "Produksi Baru",
      description: "Bahan keluar, produk masuk",
      href: "/production?tab=history&action=create-production",
      icon: Factory,
      accent: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    },
    {
      label: "Produk Baru",
      description: "Katalog & harga",
      href: "/production?action=create-product",
      icon: Boxes,
      accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Keranjang Kasir",
      description: "Buka cart penjualan",
      href: "/cashier?action=open-cart",
      icon: ShoppingCart,
      accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
  ]
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const value = formatActivityValue(item)
  const config = getActivityConfig(item)
  const Icon = config.icon

  return (
    <div className="flex w-full items-center gap-2 border-b px-3 py-2 last:border-b-0 md:gap-3 md:px-4 md:py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 md:gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{config.label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatActivityDetail(item)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {value ? (
            <p
              className={`text-sm font-medium tabular-nums ${
                value.startsWith("-") ? "text-red-500" : "text-emerald-600"
              }`}
            >
              {value}
            </p>
          ) : null}
          <time className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</time>
        </div>
      </div>
    </div>
  )
}

function formatActivityDetail(item: ActivityItem) {
  const metadata = getMetadata(item.metadata)

  if (item.action === "created_sale") {
    return [metadata.channel, metadata.invoiceNumber].filter(Boolean).join(" · ") || item.entityType
  }

  if (item.action === "created_belanja") {
    if (metadata.simpleMode) return "Total belanja tanpa detail bahan"
    return metadata.itemsCount ? `${metadata.itemsCount} item` : item.entityType
  }

  if (item.action === "created_production") {
    const bahanCount = metadata.bahanItemsCount
    const productCount = metadata.productItemsCount

    if (metadata.simpleMode) return `${productCount || 0} produk ditambah`

    if (bahanCount || productCount) {
      return `${bahanCount || 0} bahan · ${productCount || 0} produk`
    }
  }

  if (item.action === "created_pesanan") {
    return metadata.kode ? `${metadata.kode} · ${metadata.itemsCount || 0} item` : item.entityType
  }

  if (item.action === "pesanan_converted") {
    return metadata.kode ? `${metadata.kode} → ${metadata.saleInvoiceNumber || ''}` : item.entityType
  }

  if (metadata.kode) {
    return metadata.kode
  }

  return `${item.entityType}${item.entityId ? ` #${item.entityId.slice(0, 8)}` : ""}`
}

function formatActivityValue(item: ActivityItem) {
  const metadata = getMetadata(item.metadata)
  const totalAmount = metadata.totalAmount

  if (typeof totalAmount !== "string" && typeof totalAmount !== "number") return null

  const value = formatCurrency(totalAmount)

  if (item.action === "created_belanja") return `-${value}`

  return value
}

function getMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}

  return metadata as Record<string, string | number | boolean | null>
}

function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
}

function formatCurrencyCompact(value: number) {
  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`
  }
  if (value >= 1_000) {
    return `Rp${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}rb`
  }
  return formatCurrency(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
