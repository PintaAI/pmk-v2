"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/providers/sidebar-provider"

export function SidebarTrigger() {
  const { setIsOpen } = useSidebar()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      className="md:hidden"
      onClick={() => setIsOpen(true)}
    >
      <Menu className="size-5" />
      <span className="sr-only">Open navigation</span>
    </Button>
  )
}
