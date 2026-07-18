"use client"

import { useOptimistic, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Banknote, Boxes, ChevronDown, Cog, Factory, Package, Plus, TriangleAlert } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TabsPageHeader } from "@/components/layout/tabs-page-header"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Stats } from "@/components/stats"
import { useProductImage } from "@/hooks/use-product-image"
import { CreateProductDrawer } from "./create-product-drawer"
import { CreateProductionDrawer } from "./create-production-drawer"
import { EditProductDrawer } from "./edit-product-drawer"
import { useMobile } from "@/hooks/use-mobile"
import type { CustomUnitConversion, UnitKind } from "@/lib/units"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import type { OperationalMode } from "@/server/domain/types"
import type { ProductCategoryOption } from "./product-category-field"

type ProductItem = {
  id: string
  name: string
  imageUrl: string | null
  category: ProductCategoryOption | null
  updatedAt: string
  currentQty: string
  isActive: boolean
  prices: Array<{
    priceTierId: string
    price: string
  }>
}

type PriceTier = {
  id: string
  name: string
  code: string
  isDefault: boolean
}

type ProductionHistoryItem = {
  id: string
  date: string
  status: string
  note: string | null
  bahanItems: Array<{
    bahanName: string
    unit: string
    qtyUsed: string
  }>
  productItems: Array<{
    productName: string
    qtyProduced: string
  }>
}

type BahanOption = {
  id: string
  name: string
  stockQty: string
  unit: string
  unitKind?: UnitKind
  alternativeUnits: CustomUnitConversion[]
}

type ProductOption = {
  id: string
  name: string
}

type ProductionTabsProps = {
  products: ProductItem[]
  productions: ProductionHistoryItem[]
  bahanList: BahanOption[]
  productList: ProductOption[]
  priceTiers: PriceTier[]
  categories: ProductCategoryOption[]
  operationalMode: OperationalMode
}

export function ProductionTabs({ products, productions, bahanList, productList, priceTiers, categories, operationalMode }: ProductionTabsProps) {
  const [detail, setDetail] = useState<ProductionHistoryItem | null>(null)
  const [savingProductId, setSavingProductId] = useState<string | null>(null)
  const [optimisticProducts, updateOptimisticProduct] = useOptimistic(
    products,
    (current, updatedProduct: ProductItem) => current.map((product) =>
      product.id === updatedProduct.id ? updatedProduct : product
    ),
  )
  const searchParams = useSearchParams()
  const isCashierOnly = operationalMode === "CASHIER_ONLY"
  const activeTab = isCashierOnly ? "products" : searchParams.get("tab") || "products"

  const lowStockProducts = optimisticProducts.filter((product) => Number(product.currentQty) <= 20).length
  const totalStock = optimisticProducts.reduce((sum, product) => sum + Number(product.currentQty), 0)
  const defaultTier = priceTiers.find((tier) => tier.isDefault) ?? priceTiers[0]
  const potensiPendapatan = optimisticProducts.reduce((sum, product) => {
    const price = product.prices.find((item) => item.priceTierId === defaultTier?.id)?.price ?? "0"
    return sum + Number(product.currentQty) * Number(price)
  }, 0)

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    const query = params.toString()
    window.history.replaceState(null, "", query ? `/production?${query}` : "/production")
  }

  function handleEditProduct(productId: string) {
    if (savingProductId) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("action", "edit-product")
    params.set("editId", productId)
    window.history.pushState(null, "", `/production?${params.toString()}`)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="h-[calc(100dvh-146px)] min-h-0 gap-2 md:h-[calc(100dvh-4rem)]">
      <TabsPageHeader
        title={isCashierOnly ? "Produk" : "Produk & produksi"}
        icon={Factory}
        tabs={isCashierOnly
          ? [{ value: "products", label: "Produk", icon: Boxes }]
          : [
              { value: "products", label: "Produk", icon: Boxes },
              { value: "history", label: "History", icon: Factory },
            ]}
      >
        <Stats
          main={2}
          items={[
            { label: "Produk", value: optimisticProducts.length.toString(), detail: "item", icon: Boxes },
            { label: "Potensi pendapatan", value: formatCurrency(potensiPendapatan.toString()), detail: "total qty × harga jual", icon: Banknote },
            { label: "Stok rendah", value: lowStockProducts.toString(), detail: "<= 20", icon: TriangleAlert },
            { label: "Total stok", value: formatQty(totalStock.toString()), detail: "pcs", icon: Boxes },
          ]}
        />
      </TabsPageHeader>

      <TabsContent value="products" className="flex min-h-0 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {optimisticProducts.length ? (
            <ScrollArea className="min-h-0 flex-1">
              <ProductTable
                products={optimisticProducts}
                priceTiers={priceTiers}
                savingProductId={savingProductId}
                onEditProduct={handleEditProduct}
              />
            </ScrollArea>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
              <EmptyState title="Belum ada produk" description="Produk pempek yang dibuat akan ditampilkan di sini.">
                <Link href="/production?action=create-product" className={buttonVariants({ className: "mt-4" })}>
                  Tambah produk
                </Link>
              </EmptyState>
            </div>
          )}
        </div>
      </TabsContent>

      {!isCashierOnly && <TabsContent value="history" className="flex min-h-0 flex-col">
        {productions.length ? (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Riwayat Produksi
            </p>
            <ScrollArea className="mt-3 min-h-0 flex-1 rounded-xl border bg-muted/20 md:rounded-3xl">
              {productions.map((production) => (
                <ProductionRow
                  key={production.id}
                  production={production}
                  onClick={() => setDetail(production)}
                />
              ))}
            </ScrollArea>
          </section>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="m-auto rounded-xl border border-dashed bg-muted/20 p-6 text-center md:rounded-3xl">
              <p className="font-medium">Belum ada produksi</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Riwayat produksi akan muncul setelah produksi dicatat.
              </p>
            </div>
          </div>
        )}
      </TabsContent>}

      {detail && (
        <ProductionDetailModal production={detail} onClose={() => setDetail(null)} />
      )}

      <CreateProductDrawer priceTiers={priceTiers} categories={categories} />
      {!isCashierOnly && <CreateProductionDrawer bahanList={bahanList} productList={productList} operationalMode={operationalMode} />}
      <EditProductDrawer
        products={optimisticProducts}
        priceTiers={priceTiers}
        categories={categories}
        onOptimisticUpdate={updateOptimisticProduct}
        onSavingChange={setSavingProductId}
      />
    </Tabs>
  )
}

function ProductTable({
  products,
  priceTiers,
  savingProductId,
  onEditProduct,
}: {
  products: ProductItem[]
  priceTiers: PriceTier[]
  savingProductId: string | null
  onEditProduct: (productId: string) => void
}) {
  const initialTierId = priceTiers.find((tier) => tier.isDefault)?.id ?? priceTiers[0]?.id ?? ""
  const [priceTierId, setPriceTierId] = useState(initialTierId)
  const selectedTier = priceTiers.find((tier) => tier.id === priceTierId) ?? priceTiers[0]

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produk</TableHead>
          <TableHead className="text-center">
            <DropdownMenu>
              <DropdownMenuTrigger className="mx-auto flex items-center gap-1 font-medium outline-none">
                Harga {selectedTier?.name ?? "-"}
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={selectedTier?.id ?? ""} onValueChange={setPriceTierId}>
                  {priceTiers.map((tier) => (
                    <DropdownMenuRadioItem key={tier.id} value={tier.id}>{tier.name}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow
            key={product.id}
            aria-busy={savingProductId === product.id}
            className={cn(
              "cursor-pointer transition-colors hover:bg-muted/30",
              savingProductId === product.id && "pointer-events-none opacity-60",
            )}
            onClick={() => onEditProduct(product.id)}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-muted text-xs font-semibold">
                  <ProductThumbnail imageUrl={product.imageUrl} name={product.name} />
                </div>
                <div>
                  <div className="font-medium">{product.name}</div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><Package className="size-3" />{product.category?.name ?? "Tanpa kategori"} · Stok: {formatQty(product.currentQty)}</p>
                  {savingProductId === product.id && <p className="text-xs text-muted-foreground">Menyimpan...</p>}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-center font-medium tabular-nums">
              {formatCurrency(product.prices.find((price) => price.priceTierId === selectedTier?.id)?.price ?? "0")}
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={2}>
            <Link
              href="/production?action=create-product"
              className={cn(buttonVariants({ variant: "outline" }), "flex h-auto w-full items-center gap-2 border-dashed bg-muted/20 px-4 py-3")}
            >
              <Plus className="size-4" />
              <span className="text-sm font-semibold">Tambah produk</span>
            </Link>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function ProductThumbnail({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const resolvedImageUrl = useProductImage(imageUrl)

  if (resolvedImageUrl) {
    return (
      <div
        className="size-full bg-cover bg-center"
        style={{ backgroundImage: `url(${resolvedImageUrl})` }}
        role="img"
        aria-label={name}
      />
    )
  }

  return <>{name.slice(0, 2).toUpperCase()}</>
}

function ProductionRow({ production, onClick }: { production: ProductionHistoryItem; onClick: () => void }) {
  const isSimpleProduction = production.bahanItems.length === 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 transition-colors hover:bg-muted/30 md:gap-3 md:px-4 md:py-3"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
        <Cog className="size-4 text-muted-foreground" />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 md:gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {production.note || (isSimpleProduction ? "Tambah stok produksi" : "Produksi")}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {isSimpleProduction ? `Tambah stok · ${production.productItems.length} produk` : `${production.bahanItems.length} bahan · ${production.productItems.length} produk`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", production.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
            {production.status}
          </span>
          <p className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
            {formatDate(production.date)}
          </p>
        </div>
      </div>
    </button>
  )
}

function ProductionDetailModal({
  production,
  onClose,
}: {
  production: ProductionHistoryItem
  onClose: () => void
}) {
  const isMobile = useMobile()

  const title = production.note || "Produksi"
  const description = formatDate(production.date)

  if (isMobile) {
    return (
      <Drawer open onClose={onClose}>
        <DrawerContent className="mx-auto h-[85dvh] max-h-[85dvh] max-w-lg overflow-hidden">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <ProductionDetail production={production} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ProductionDetail production={production} />
      </DialogContent>
    </Dialog>
  )
}

function ProductionDetail({ production }: { production: ProductionHistoryItem }) {
  const isSimpleProduction = production.bahanItems.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {!isSimpleProduction && (
          <div className="rounded-xl border bg-muted/20">
            <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Bahan dipakai
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Bahan</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {production.bahanItems.map((item, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-medium">{item.bahanName}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {formatQty(item.qtyUsed)} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-xl border bg-muted/20">
          <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {isSimpleProduction ? "Produk ditambah" : "Produk dihasilkan"}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Produk</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {production.productItems.map((item, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{item.productName}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {formatQty(item.qtyProduced)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSimpleProduction && (
        <div className="rounded-lg bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Produksi ini dicatat dalam mode simple, jadi tidak ada bahan dipakai atau movement bahan.
        </div>
      )}

      {production.note && (
        <div className="rounded-lg bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {production.note}
        </div>
      )}
    </div>
  )
}

function EmptyState({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  )
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
