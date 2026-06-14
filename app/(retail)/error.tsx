"use client"

import { useEffect } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Terjadi kesalahan</p>
          <p className="text-xs text-muted-foreground">
            {error.message || "Halaman tidak dapat dimuat. Silakan coba lagi."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={reset} className="gap-1.5">
          <RefreshCw className="size-3.5" />
          Coba lagi
        </Button>
      </div>
    </div>
  )
}
