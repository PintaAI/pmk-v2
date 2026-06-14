"use client"

import { useSearchParams } from "next/navigation"
import { Archive, Package, Pencil, Receipt } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TabsPageHeader } from "@/components/layout/tabs-page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Stats } from "@/components/stats"
import { BelanjaHistoryTab } from "@/components/inventory/belanja-history-tab"
import { CreateBelanjaDrawer } from "@/components/inventory/create-belanja-drawer"
import { CreateBahanDrawer } from "@/components/inventory/create-bahan-drawer"
import type { CustomUnitConversion, UnitKind } from "@/lib/units"

type BahanInventoryItem = {
  id: string
  name: string
  unit: string
  unitKind?: UnitKind
  currentQty: string
  averageCost: string
  alternativeUnits: CustomUnitConversion[]
}

type BahanMovementItem = {
  id: string
  movementType: "BAHAN_PURCHASE" | "BAHAN_PRODUCTION_USAGE" | string
  direction: "IN" | "OUT" | "ADJUSTMENT" | string
  qty: string
  unitCost: string | null
  referenceType: string
  referenceId: string
  createdAt: string
  bahanName: string
  unit: string
}

type BelanjaHistoryItem = {
  id: string
  date: string
  supplier: string | null
  note: string | null
  status: string
  totalAmount: string
  items: Array<{
    id: string
    bahanName: string
    unit: string
    qty: string
    unitPrice: string
    subtotal: string
  }>
}

type InventoryTabsProps = {
  bahan: BahanInventoryItem[]
  movements: BahanMovementItem[]
  belanjaList: BelanjaHistoryItem[]
}

export function InventoryTabs({ bahan, movements, belanjaList }: InventoryTabsProps) {
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("tab") || "current"
  const totalBahan = bahan.length
  const totalQty = bahan.reduce((sum, item) => sum + Number(item.currentQty), 0)
  const totalAsset = bahan.reduce((sum, item) => sum + Number(item.currentQty) * Number(item.averageCost), 0)

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    const query = params.toString()
    window.history.replaceState(null, "", query ? `/inventory?${query}` : "/inventory")
  }

  function handleEditBahan(bahanId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("action", "edit-bahan")
    params.set("editId", bahanId)
    window.history.pushState(null, "", `/inventory?${params.toString()}`)
  }

  return (
    <>
      <div className="flex h-[calc(100dvh-146px)] min-h-0 flex-col md:h-[calc(100dvh-4rem)]">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 min-h-0 gap-2">
          <TabsPageHeader
            title="Bahan inventory"
            icon={Package}
            tabs={[
              { value: "current", label: "Current", icon: Package },
              { value: "movement", label: "Movement", icon: Archive },
              { value: "belanja", label: "Belanja", icon: Receipt },
            ]}
          >
            <Stats
              main={2}
              items={[
                { label: "Bahan", value: totalBahan.toString(), detail: "item", icon: Package },
                { label: "Nilai asset", value: formatCurrency(totalAsset.toString()), detail: "qty × harga rata-rata", icon: Archive },
                { label: "Total qty", value: formatQty(totalQty.toString()), icon: Archive },
              ]}
            />
          </TabsPageHeader>

          <TabsContent value="current" className="flex flex-col min-h-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {bahan.length ? (
                <ScrollArea className="min-h-0 flex-1">
                  <BahanInventoryTable bahan={bahan} onEdit={handleEditBahan} />
                </ScrollArea>
              ) : (
                <div className="min-h-0 flex-1 flex flex-col items-center justify-center">
                  <EmptyState title="Belum ada bahan" description="Tambahkan bahan terlebih dahulu di menu Bahan." />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="movement" className="flex flex-col min-h-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {movements.length ? (
                <ScrollArea className="min-h-0 flex-1">
                  <BahanMovementTable movements={movements} />
                </ScrollArea>
              ) : (
                <div className="min-h-0 flex-1 flex flex-col items-center justify-center">
                  <EmptyState title="Belum ada movement" description="Movement akan muncul setelah belanja bahan atau pencatatan produksi." />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="belanja" className="flex flex-col min-h-0">
            <BelanjaHistoryTab belanjaList={belanjaList} />
          </TabsContent>
        </Tabs>
      </div>

      <CreateBahanDrawer bahanList={bahan} />
      <CreateBelanjaDrawer bahanList={bahan} />
    </>
  )
}

function BahanInventoryTable({ bahan, onEdit }: { bahan: BahanInventoryItem[]; onEdit: (id: string) => void }) {
  return (
    <Table>
        <TableHeader>
        <TableRow>
          <TableHead>Bahan</TableHead>
          <TableHead className="text-center">Average cost</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bahan.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">
              {item.name}
              <span className="ml-2 text-xs text-muted-foreground">
                {formatQty(item.currentQty)} {item.unit}
              </span>
            </TableCell>
            <TableCell className="text-center">{formatCurrency(item.averageCost)}</TableCell>
            <TableCell>
              <button
                type="button"
                onClick={() => onEdit(item.id)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function BahanMovementTable({ movements }: { movements: BahanMovementItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Bahan</TableHead>
          <TableHead className="text-center">Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => {
          const isIn = movement.direction === "IN"

          return (
            <TableRow key={movement.id}>
              <TableCell className="font-medium">
                {movement.bahanName}
                <span className={cn("ml-2 text-xs font-medium", isIn ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300")}>
                  {isIn ? "+" : "-"}{formatQty(movement.qty)} {movement.unit}
                </span>
                <div className="text-xs text-muted-foreground">{formatDate(movement.createdAt)}</div>
              </TableCell>
              <TableCell className="text-center">
                <span className={cn("rounded-full px-2 py-1 text-xs font-medium", isIn ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-orange-500/10 text-orange-700 dark:text-orange-300")}>
                  {movementLabel(movement.movementType)}
                </span>
                {movement.movementType === "BAHAN_PURCHASE" && movement.unitCost && (
                  <div className="text-xs text-muted-foreground mt-1">{formatCurrency(movement.unitCost)}</div>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function movementLabel(movementType: string) {
  if (movementType === "BAHAN_PURCHASE") return "Belanja"
  if (movementType === "BAHAN_PRODUCTION_USAGE") return "Pemakaian produksi"

  return movementType
}

function formatQty(value: string) {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 3 })
}

function formatCurrency(value: string) {
  return Number(value).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
