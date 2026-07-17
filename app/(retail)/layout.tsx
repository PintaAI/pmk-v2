"use client"

import { Suspense, type ReactNode } from "react"
import { SidebarProvider, useSidebar } from "@/components/providers/sidebar-provider"
import { PlusActionProvider } from "@/components/providers/plus-action-context"
import { QueryProvider } from "@/components/providers/query-provider"
import { TokoProvider } from "@/components/providers/toko-provider"
import { PrinterProvider } from "@/components/providers/printer-provider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { BottomNav } from "@/components/layout/bottom-nav"
import { RetailHeader } from "@/components/layout/retail-header"
import { SidebarContent } from "@/components/layout/sidebar-content"

export default function RetailLayout({ children }: { children: ReactNode }) {
  return (
    <TokoProvider>
      <SidebarProvider>
        <PlusActionProvider>
          <QueryProvider>
            <PrinterProvider>
              <RetailLayoutInner>{children}</RetailLayoutInner>
            </PrinterProvider>
          </QueryProvider>
        </PlusActionProvider>
      </SidebarProvider>
    </TokoProvider>
  )
}

function RetailLayoutInner({ children }: { children: ReactNode }) {
  const { isOpen, setIsOpen } = useSidebar()

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="w-80 max-w-[86vw] p-0" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Retail navigation</SheetTitle>
            <SheetDescription>Navigate between retail management pages</SheetDescription>
          </SheetHeader>
          <SidebarContent onNavigate={() => setIsOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-dvh w-full bg-muted/25">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
          <SidebarContent />
        </aside>

        <div className="min-w-0 flex-1 flex flex-col min-h-0">
          <RetailHeader />

          <main className="mx-auto w-full max-w-7xl px-3 py-0 pb-[82px] sm:px-6 md:px-8 md:py-8 md:pb-8 flex-1 min-h-0 flex flex-col">
            {children}
          </main>
        </div>
      </div>

      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </>
  )
}
