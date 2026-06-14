"use client"

import { useTheme } from "@teispace/next-themes"
import { Moon, Sun, Monitor } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const themes = ["light", "dark", "system"] as const
const icons = { light: Sun, dark: Moon, system: Monitor } as const
const labels = { light: "Light mode", dark: "Dark mode", system: "System mode" } as const

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  function cycleTheme() {
    const current = themes.indexOf(theme as (typeof themes)[number])
    const next = themes[(current + 1) % themes.length]
    setTheme(next)
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled>
        <Sun className="size-5" />
      </Button>
    )
  }

  const Icon = icons[theme as keyof typeof icons] ?? Sun

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            aria-label="Toggle theme"
          >
            <Icon className="size-5" />
          </Button>
        }
      />
      <TooltipContent>{labels[theme as keyof typeof labels] ?? "Light mode"}</TooltipContent>
    </Tooltip>
  )
}

export { ThemeToggle }
