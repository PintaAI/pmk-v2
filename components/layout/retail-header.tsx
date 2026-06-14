"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { SettingsIcon, Store } from "lucide-react"
import { SidebarTrigger } from "@/components/layout/sidebar-trigger"
import { navItems } from "./nav"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToko } from "@/components/providers/toko-provider"
import { useTokoImage } from "@/hooks/use-toko-image"

export function RetailHeader() {
  const pathname = usePathname()
  const { toko } = useToko()
  const imageUrl = useTokoImage(toko?.imageUrl ?? null)
  const currentPage = getCurrentPage(pathname)
  const Icon = currentPage.icon
  const isHome = pathname === "/"

  return (
    <header className="sticky top-0 z-30 px-1 backdrop-blur-xl md:hidden">
      <div className="flex h-16 items-center gap-3">
        <SidebarTrigger />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isHome ? (
            <>
              <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-background">
                {imageUrl ? (
                  <img src={imageUrl} alt={toko?.name ?? "Toko"} className="size-full object-cover" />
                ) : (
                  <Store className="size-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-none">{toko?.name ?? "Dashboard"}</p>
              </div>
            </>
          ) : (
            <>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-none">{currentPage.label}</p>
              </div>
            </>
          )}
        </div>

        <Link
          href="/settings"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        >
          <SettingsIcon className="size-5" />
        </Link>
      </div>
    </header>
  )
}

function getCurrentPage(pathname: string) {
  return [...navItems]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isNavItemActive(pathname, item.href)) ?? navItems[0]
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
