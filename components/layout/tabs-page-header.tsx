"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

type TabsPageHeaderItem = {
  value: string
  label: string
  icon: LucideIcon
}

type TabsPageHeaderProps = {
  title: string
  icon: LucideIcon
  tabs: TabsPageHeaderItem[]
  children?: ReactNode
}

export function TabsPageHeader({ title, icon: Icon, tabs, children }: TabsPageHeaderProps) {
  return (
    <div className="relative isolate min-w-0 space-y-2 overflow-hidden px-1 pt-1 mb-2">
      <div className="pointer-events-none absolute -left-8 -top-10 -z-10 size-36 rounded-full " />
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-[0.65rem] font-semibold uppercase text-background">
          <Icon className="size-3.5" />
        </span>
        <h1 className="truncate text-xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      </div>

      {children}

      <div className="w-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList variant="line" className="h-8 w-max min-w-full justify-start gap-1 bg-transparent p-0 text-xs md:w-fit md:min-w-0 md:shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-8 flex-none rounded-none bg-transparent px-2.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-foreground after:opacity-100 after:transition-transform data-active:after:scale-x-100 dark:data-active:bg-transparent"
              >
                <Icon className="size-3.5" />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

    </div>
  )
}
