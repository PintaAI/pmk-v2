import type { ReactNode } from "react"

type PageHeaderProps = {
  title: string
  subtitle?: string
  icon?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, subtitle, icon, children }: PageHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
