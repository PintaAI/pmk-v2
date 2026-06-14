"use client"

import { Store } from "lucide-react"
import { useToko } from "@/components/providers/toko-provider"
import { useTokoImage } from "@/hooks/use-toko-image"

export function HomeDashboardHeading() {
  const { toko } = useToko()
  const imageUrl = useTokoImage(toko?.imageUrl ?? null)

  return (
    <div className="hidden min-w-0 items-center gap-2 md:flex">
      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-background">
        {imageUrl ? (
          <img src={imageUrl} alt={toko?.name ?? "Toko"} className="size-full object-cover" />
        ) : (
          <Store className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight md:text-3xl">{toko?.name ?? "Dashboard"}</h1>
      </div>
    </div>
  )
}
