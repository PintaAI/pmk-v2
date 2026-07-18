"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { LayoutDashboard, LayoutGrid, ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMobile } from "@/hooks/use-mobile"
import { usePlusAction, type ActionType } from "@/components/providers/plus-action-context"
import { useActionParam } from "@/hooks/use-action-param"
import { bottomNavItems } from "./nav"
import { useToko } from "@/components/providers/toko-provider"
import type { OperationalMode } from "@/server/domain/types"

function getPlusAction(pathname: string, tab: string | null, operationalMode: OperationalMode): { type: ActionType; label: string } | null {
  if (pathname === "/") {
    return { type: "quick-actions", label: "Aksi" }
  }
  if (pathname.startsWith("/cashier")) {
    return { type: "open-cart", label: "Keranjang" }
  }
  if (pathname.startsWith("/inventory")) {
    if (operationalMode === "CASHIER_ONLY") return { type: "quick-actions", label: "Aksi" }
    const currentTab = tab || "current"
    if (currentTab === "belanja") return { type: "create-belanja", label: "Belanja" }
    return { type: "create-bahan", label: "Bahan" }
  }
  if (pathname.startsWith("/production")) {
    if (operationalMode === "CASHIER_ONLY") return { type: "create-product", label: "Produk" }
    const currentTab = tab || "products"
    if (currentTab === "products") return { type: "create-product", label: "Produk" }
    if (currentTab === "history") return { type: "create-production", label: "Produksi" }
  }
  if (pathname.startsWith("/pesanan")) {
    return { type: "create-pesanan", label: "Pesanan" }
  }
  return { type: "quick-actions", label: "Aksi" }
}

function getPlusActionAccent(type: ActionType) {
  if (type === "quick-actions") {
    return "from-zinc-900 to-zinc-700 text-white shadow-[0_14px_34px_rgba(0,0,0,0.22)] dark:from-zinc-100 dark:to-white dark:text-zinc-950"
  }
  if (type === "create-product") {
    return "from-emerald-500 to-teal-600 shadow-[0_14px_34px_rgba(16,185,129,0.34)]"
  }
  if (type === "create-bahan") {
    return "from-sky-500 to-cyan-600 shadow-[0_14px_34px_rgba(14,165,233,0.32)]"
  }
  if (type === "create-belanja") {
    return "from-violet-500 to-purple-600 shadow-[0_14px_34px_rgba(139,92,246,0.32)]"
  }
  if (type === "open-cart") {
    return "from-amber-500 to-orange-600 shadow-[0_14px_34px_rgba(245,158,11,0.34)]"
  }
  if (type === "create-pesanan") {
    return "from-rose-500 to-pink-600 shadow-[0_14px_34px_rgba(244,63,94,0.32)]"
  }
  return "from-foreground to-foreground shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
}

export function BottomNav() {
  const isMobile = useMobile()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { openAction } = useActionParam()
  const { toko } = useToko()

  const tab = searchParams.get("tab")
  const operationalMode = toko?.operationalMode ?? "WITH_INVENTORY"
  const plusAction = getPlusAction(pathname, tab, operationalMode)
  const visibleBottomNavItems = operationalMode === "CASHIER_ONLY"
    ? bottomNavItems.map((item, index) => index === 4
      ? { ...item, label: "Laporan", href: "/reports", icon: LayoutDashboard }
      : item)
    : bottomNavItems
  const { cartCount } = usePlusAction()

  if (!isMobile) return null

  const hasCartCount = plusAction?.type === "open-cart" && cartCount > 0
  const PlusIcon = plusAction?.type === "open-cart"
    ? ShoppingCart
    : plusAction?.type === "quick-actions"
      ? LayoutGrid
      : bottomNavItems[2].icon

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-4 md:hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background via-background/95 to-transparent" />
      <div className="relative mx-auto grid max-w-md grid-cols-5 items-center gap-1 rounded-[1.65rem] border border-border/70 bg-background/90 p-1.5 shadow-[0_-10px_34px_rgba(0,0,0,0.08),0_10px_28px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:bg-card/90">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
        {visibleBottomNavItems.map((item, index) => {
          const Icon = item.icon
          const isAdd = index === 2
          const isActive = isNavItemActive(pathname, item.href)
          const activePlusAccent =
            plusAction?.type ? getPlusActionAccent(plusAction.type) : "shadow-[0_16px_46px_rgba(14,165,233,0.42)]"

          if (isAdd) {
            if (plusAction) {
              return (
                <button
                  key={index}
                  type="button"
                  aria-label={`Tambah ${plusAction.label}`}
                  data-cart-target={plusAction.type === "open-cart" ? "" : undefined}
                  onClick={() => openAction(plusAction.type)}
                  className="group relative flex min-w-0 flex-col items-center gap-1 rounded-[1.3rem] px-1 py-1 text-[10px] font-semibold text-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span
                    className={cn(
                      "relative -mt-4 flex size-12 items-center justify-center rounded-[1.1rem] bg-gradient-to-br text-white ring-4 ring-background transition duration-200 group-active:translate-y-0.5 group-active:scale-95 dark:ring-card",
                      activePlusAccent
                    )}
                  >
                    <PlusIcon className="size-5" />
                    {hasCartCount && (
                      <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background dark:ring-card">
                        {cartCount}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate leading-none text-muted-foreground transition-colors group-active:text-foreground">
                    {plusAction.label}
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={index}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="group relative flex min-w-0 flex-col items-center gap-1 rounded-[1.3rem] px-1 py-1 text-[10px] font-semibold text-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span
                  className={cn(
                    "relative -mt-4 flex size-12 items-center justify-center rounded-[1.1rem] bg-gradient-to-br from-foreground to-foreground text-background shadow-[0_14px_34px_rgba(0,0,0,0.22)] ring-4 ring-background transition duration-200 group-active:translate-y-0.5 group-active:scale-95 dark:ring-card",
                    isActive && activePlusAccent
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="max-w-full truncate leading-none text-muted-foreground">{item.label}</span>
              </Link>
            )
          }

          return (
            <Link
              key={index}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex min-w-0 flex-col items-center gap-1 rounded-[1.2rem] px-1 py-1.5 text-[10px] font-medium text-muted-foreground outline-none transition duration-200 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98]",
                isActive && "text-foreground"
              )}
            >
              <span
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-2xl transition duration-200",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-transparent group-hover:bg-muted"
                )}
              >
                {isActive && <span className="absolute -top-1.5 h-1 w-1 rounded-full bg-foreground" />}
                <Icon className="size-4" />
              </span>
              <span className="max-w-full truncate leading-none">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
