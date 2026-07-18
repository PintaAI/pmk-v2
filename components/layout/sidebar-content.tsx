"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Store } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import { signOut } from "@/lib/auth-client"
import { useToko } from "@/components/providers/toko-provider"
import { useTokoImage } from "@/hooks/use-toko-image"
import { navItems } from "./nav"

type SidebarContentProps = {
  onNavigate?: () => void
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { toko } = useToko()
  const imageUrl = useTokoImage(toko?.imageUrl ?? null)
  const visibleNavItems = navItems
    .filter((item) => toko?.operationalMode !== "CASHIER_ONLY" || item.href !== "/inventory")
    .map((item) => toko?.operationalMode === "CASHIER_ONLY" && item.href === "/production"
      ? { ...item, label: "Produk", description: "Kelola produk dan harga jual" }
      : item)

  async function handleSignOut() {
    await signOut()
    router.push('/auth')
  }

  return (
    <div className="flex min-h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-6 pb-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3"
        >
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-foreground text-background">
            {imageUrl ? (
              <img src={imageUrl} alt={toko?.name ?? "Toko"} className="size-full object-cover" />
            ) : (
              <Store className="size-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-none">{toko?.name ?? "Toko"}</p>
            <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Operasional toko
            </p>
          </div>
        </Link>
      </div>

      <div className="px-5">
        <div className="h-px w-full bg-gradient-to-r from-foreground/70 via-foreground/10 to-transparent" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-5">
        {visibleNavItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href)
          const Icon = item.icon

          return (
            <div key={item.href} className="relative">
              <div className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-foreground/30 via-foreground/8 to-transparent" />
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-md bg-foreground" />
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-gradient-to-r from-foreground/[0.07] to-transparent font-semibold text-foreground"
                    : "text-muted-foreground hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </div>
          )
        })}
      </nav>

      <div className="px-5 pb-5">
        <div className="h-px w-full bg-gradient-to-r from-foreground/70 via-foreground/10 to-transparent" />

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-1">
            {[...Array(4)].map((_, i) => (
              <span
                key={i}
                className="h-1 w-1 shrink-0 bg-foreground/70"
                style={{ opacity: 1 - i * 0.18 }}
              />
            ))}
          </div>
          <ThemeToggle />
        </div>

        <div className="h-px w-full bg-gradient-to-r from-foreground/70 via-foreground/10 to-transparent" />

        <button
          onClick={handleSignOut}
          className="mt-3 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-3" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  )
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
