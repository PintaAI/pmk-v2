"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, Bluetooth, CheckCircle2, Loader2, RotateCw, SettingsIcon, Store, Trash2 } from "lucide-react"
import { SidebarTrigger } from "@/components/layout/sidebar-trigger"
import { navItems } from "./nav"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToko } from "@/components/providers/toko-provider"
import { useTokoImage } from "@/hooks/use-toko-image"
import { isNativeApp } from "@/components/printer"
import { usePrinter } from "@/components/providers/printer-provider"

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

        <PrinterStatusIndicator />

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

function PrinterStatusIndicator() {
  const {
    preparedState,
    printState,
    prepareBluetoothPrinter,
    listBluetoothPrinters,
    connectBluetoothPrinter,
    forgetBluetoothPrinter,
  } = usePrinter()
  const [open, setOpen] = React.useState(false)
  const [devices, setDevices] = React.useState<Array<{ name: string; address: string }>>([])
  const [isNative] = React.useState(isNativeApp)

  if (!isNative) return null

  const isPrinting = printState.phase === "printing"
  const isConnecting = printState.phase === "connecting"
  const isReady = preparedState.phase === "ready"
  const isPreparing = preparedState.phase === "preparing"
  const isFailed = preparedState.phase === "failed" || printState.phase === "error"
  const isBusy = isPrinting || isConnecting || isPreparing
  const status = getPrinterHeaderStatus({ preparedState, printState })
  const StatusIcon = status.icon

  const connectPrinter = async () => {
    const connectedSavedPrinter = await prepareBluetoothPrinter()
    if (connectedSavedPrinter) {
      setDevices([])
      return
    }

    const pairedDevices = await listBluetoothPrinters()
    const preferredPrinter = pairedDevices.find((device) => {
      const name = device.name.toUpperCase()
      return name.includes("MP-58") || name.includes("MP58")
    })

    if (preferredPrinter) {
      setDevices([])
      await connectBluetoothPrinter(preferredPrinter)
      return
    }

    setDevices(pairedDevices)
  }

  const selectPrinter = async (printer: { name: string; address: string }) => {
    setDevices([])
    await connectBluetoothPrinter(printer)
  }

  const clearPrinter = () => {
    setDevices([])
    void forgetBluetoothPrinter()
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50",
          isReady && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          isBusy && "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
          isFailed && "border-destructive/30 bg-destructive/10 text-destructive",
          !isReady && !isBusy && !isFailed && "border-border bg-background/60 text-muted-foreground",
        )}
        title={status.title}
      >
        {isBusy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Bluetooth className="size-3.5" />
        )}
        <span className="hidden min-[360px]:inline">{status.shortLabel}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl ring-1 ring-foreground/10">
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Printer Bluetooth</p>
          <div className="rounded-lg border bg-muted/35 p-3">
            <div className="flex items-start gap-3">
              <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", status.iconClassName)}>
                {isBusy ? <Loader2 className="size-4 animate-spin" /> : <StatusIcon className="size-4" />}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold leading-none">{status.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{status.description}</p>
              </div>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => void connectPrinter()}
            disabled={isBusy || isReady}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none transition hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <RotateCw className="size-4" />
            {isFailed ? "Coba hubungkan lagi" : "Minta izin & hubungkan"}
          </button>
          {devices.length > 0 ? (
            <div className="space-y-1 pt-1">
              <p className="px-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pilih printer</p>
              {devices.map((device) => (
                <button
                  key={device.address}
                  type="button"
                  onClick={() => void selectPrinter(device)}
                  className="w-full rounded-md px-2 py-2 text-left outline-none transition hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="block truncate text-sm font-medium">{device.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{device.address}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={clearPrinter}
            disabled={isBusy}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-destructive outline-none transition hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            Lupakan printer tersimpan
          </button>
        </div>
      ) : null}
    </div>
  )
}

function getPrinterHeaderStatus({
  preparedState,
  printState,
}: Pick<ReturnType<typeof usePrinter>, "preparedState" | "printState">) {
  if (printState.phase === "printing") {
    return {
      shortLabel: "Print",
      title: "Sedang mencetak",
      description: "Tunggu sampai struk selesai dikirim ke printer.",
      icon: Loader2,
      iconClassName: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    }
  }

  if (printState.phase === "connecting") {
    return {
      shortLabel: "Connect",
      title: `Menghubungkan ke ${printState.deviceName}`,
      description: "Pastikan printer menyala dan berada dekat perangkat.",
      icon: Loader2,
      iconClassName: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    }
  }

  if (preparedState.phase === "preparing") {
    return {
      shortLabel: "Check",
      title: `Menyiapkan ${preparedState.deviceName}`,
      description: "Koneksi printer sedang diperiksa sebelum digunakan.",
      icon: Loader2,
      iconClassName: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    }
  }

  if (preparedState.phase === "ready") {
    return {
      shortLabel: "Ready",
      title: `Printer siap: ${preparedState.deviceName}`,
      description: "Struk berikutnya akan dikirim langsung ke printer ini.",
      icon: CheckCircle2,
      iconClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    }
  }

  if (printState.phase === "error") {
    return {
      shortLabel: "Error",
      title: "Printer bermasalah",
      description: printState.message,
      icon: AlertTriangle,
      iconClassName: "bg-destructive/10 text-destructive",
    }
  }

  if (preparedState.phase === "failed") {
    return {
      shortLabel: "Offline",
      title: "Printer belum tersambung",
      description: "Coba hubungkan ulang, atau lupakan printer lalu pilih lagi saat mencetak.",
      icon: AlertTriangle,
      iconClassName: "bg-destructive/10 text-destructive",
    }
  }

  return {
    shortLabel: "Printer",
    title: "Printer belum aktif",
    description: "Pilih printer saat mencetak struk pertama. Header ini tidak meminta izin otomatis.",
    icon: Bluetooth,
    iconClassName: "bg-background text-muted-foreground ring-1 ring-border",
  }
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
