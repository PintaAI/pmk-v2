"use client"

import Link from "next/link"
import { ChevronRight, Factory, LayoutGrid, Receipt, ShoppingCart } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useActionParam } from "@/hooks/use-action-param"
import { cn } from "@/lib/utils"
import type { OperationalMode } from "@/server/domain/types"

function getQuickActions(operationalMode: OperationalMode) {
  if (operationalMode === "CASHIER_ONLY") {
    return [
      {
        label: "Mulai Penjualan",
        description: "Buka kasir dan pilih produk",
        href: "/cashier",
        icon: ShoppingCart,
        accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      },
    ]
  }

  if (operationalMode === "SIMPLE_INVENTORY") {
    return [
      {
        label: "Catat Belanja",
        description: "Simpan total pengeluaran",
        href: "/inventory?action=create-belanja",
        icon: Receipt,
        accent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
      },
      {
        label: "Tambah Stok",
        description: "Catat hasil produksi produk",
        href: "/production?tab=history&action=create-production",
        icon: Factory,
        accent: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
      },
      {
        label: "Mulai Penjualan",
        description: "Buka kasir dan pilih produk",
        href: "/cashier",
        icon: ShoppingCart,
        accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      },
    ]
  }

  return [
    {
      label: "Catat Belanja",
      description: "Beli dan tambah stok bahan",
      href: "/inventory?action=create-belanja",
      icon: Receipt,
      accent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    {
      label: "Catat Produksi",
      description: "Ubah bahan menjadi produk",
      href: "/production?tab=history&action=create-production",
      icon: Factory,
      accent: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    },
    {
      label: "Mulai Penjualan",
      description: "Buka kasir dan pilih produk",
      href: "/cashier",
      icon: ShoppingCart,
      accent: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
  ]
}

export function QuickActionDrawer({ operationalMode }: { operationalMode: OperationalMode }) {
  const { actionType, closeAction } = useActionParam()
  const isOpen = actionType === "quick-actions"
  const quickActions = getQuickActions(operationalMode)

  return (
    <Drawer open={isOpen} onClose={closeAction}>
      <DrawerContent className="mx-auto max-h-[90dvh] max-w-md overflow-hidden rounded-t-[1.75rem] border-border/80 bg-background pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <DrawerHeader className="p-3 pb-2 text-left">
          <div className="flex items-center gap-2 text-left">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <LayoutGrid className="size-3.5" />
            </span>
            <div className="min-w-0">
              <DrawerTitle>Mau melakukan apa?</DrawerTitle>
              <DrawerDescription className="text-xs">
                {operationalMode === "CASHIER_ONLY"
                  ? "Mode kasir aktif. Mulai dari penjualan baru."
                  : operationalMode === "SIMPLE_INVENTORY"
                  ? "Catat belanja, stok, atau mulai penjualan."
                  : "Pilih satu aktivitas utama untuk dilanjutkan."}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="mx-3 grid gap-1.5 rounded-2xl border bg-muted/20 p-1.5">
          {quickActions.map((action) => {
            const Icon = action.icon

            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-2xl border bg-background p-2.5 text-left shadow-sm transition hover:bg-muted/40 active:scale-[0.99]"
              >
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", action.accent)}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{action.description}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
              </Link>
            )
          })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
