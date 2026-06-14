import { Loader2 } from "lucide-react"

export default function RetailLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <span className="text-xs">Memuat...</span>
      </div>
    </div>
  )
}
