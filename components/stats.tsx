import type { LucideIcon } from "lucide-react"

type StatItem = {
  label: string
  value: string
  detail?: string
  icon?: LucideIcon
  iconClassName?: string
  valueClassName?: string
}

type StatsProps = {
  items: StatItem[]
  main?: number
}

function StatBlock({ item, className }: { item: StatItem; className?: string }) {
  return (
    <div className={`relative min-w-0 pl-3 ${className ?? ""}`}>
      <div className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-foreground/50 via-foreground/10 to-transparent" />
      <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        {item.icon ? <item.icon className={`size-3 shrink-0 ${item.iconClassName ?? ""}`} /> : null}
        <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em]">{item.label}</p>
      </div>
      <p className={`mt-1 text-[2rem] font-semibold leading-none tracking-[-0.05em] tabular-nums sm:text-4xl ${item.valueClassName ?? ""}`}>
        {item.value}
      </p>
      {item.detail ? (
        <p className="mt-1 text-[0.68rem] leading-none text-muted-foreground">{item.detail}</p>
      ) : null}
    </div>
  )
}

export function Stats({ items, main = 1 }: StatsProps) {
  const mainItems = items.slice(0, main)
  const asideItems = items.slice(main)

  if (main >= items.length) {
    return (
      <div className="grid w-full gap-3">
        <div className="grid grid-cols-3 gap-5">
          {items.map((item, i) => (
            <StatBlock key={item.label} item={item} className={i === items.length - 1 && items.length === 2 ? "col-span-2" : ""} />
          ))}
        </div>
        <DecorativeFooter count={items.length} asideItems={asideItems} />
      </div>
    )
  }

  return (
    <div className="grid w-full gap-3">
      {mainItems.length === 1 ? (
        <StatBlock item={mainItems[0]} />
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {mainItems.map((item, i) => (
            <StatBlock key={item.label} item={item} className={i === mainItems.length - 1 && mainItems.length === 2 ? "col-span-2" : ""} />
          ))}
        </div>
      )}

      <DecorativeFooter count={items.length} asideItems={asideItems} />
    </div>
  )
}

function DecorativeFooter({ count, asideItems }: { count: number; asideItems: StatItem[] }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        {[...Array(count)].map((_, i) => (
          <span
            key={i}
            className="h-1 w-1 shrink-0 bg-foreground/70"
            style={{ opacity: 1 - i * 0.14 }}
          />
        ))}
        {asideItems.length > 0 && (
          <div className="ml-auto flex items-center gap-x-3 gap-y-1 text-xs tabular-nums">
            {asideItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                {item.icon ? <item.icon className={`size-3 shrink-0 text-muted-foreground ${item.iconClassName ?? ""}`} /> : null}
                <span className={`font-medium ${item.valueClassName ?? ""}`}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-px w-full bg-gradient-to-r from-foreground/70 via-foreground/10 to-transparent" />
    </div>
  )
}
