import { ProductionTabs } from "@/components/production/production-tabs"
import { prisma } from "@/lib/prisma"
import { buildCustomUnitConfigs, getDisplayQty } from "@/lib/units"
import type { CustomUnitConversion } from "@/lib/units"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { listItems } from "@/server/domain/items/item-service"
import { listProductions } from "@/server/domain/production/production-service"
import { listPriceTiers } from "@/server/domain/pricing/price-tier-service"
import { listBalances } from "@/server/domain/inventory/inventory-service"
import { listProductCategories } from "@/server/domain/items/product-category-service"
import type { OperationalMode } from "@/generated/prisma/client"
import type { UnitKind } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

export default async function ProductionPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let tokoId: string | null = null
  let role = "STAFF"
  let operationalMode: OperationalMode | undefined

  if (session?.user) {
    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: session.user.id },
      select: { tokoId: true, role: true, toko: { select: { operationalMode: true } } },
      orderBy: { createdAt: 'asc' },
    })
    tokoId = tokoUser?.tokoId ?? null
    role = tokoUser?.role ?? "STAFF"
    operationalMode = tokoUser?.toko.operationalMode as OperationalMode | undefined
  }

  if (!tokoId) {
    return <ProductionTabs products={[]} productions={[]} bahanList={[]} productList={[]} priceTiers={[]} categories={[]} operationalMode={operationalMode ?? "WITH_INVENTORY"} />
  }

  const ctx = { actorId: session?.user?.id ?? "", tokoId, role: role as "OWNER" | "STAFF" }

  const [products, materialItems, productions, bahanBal, priceTiers, categories] = await Promise.all([
    listItems(ctx, { type: "PRODUCT", isActive: true }),
    listItems(ctx, { type: "MATERIAL" }),
    listProductions(ctx, { limit: 50 }),
    listBalances(ctx, { type: "MATERIAL" }),
    listPriceTiers(ctx),
    listProductCategories(ctx),
  ])

  const materialItemMap = new Map(materialItems.map((i) => [i.id, i]))

  const bahanList = bahanBal.map((item) => {
    const itemDef = materialItemMap.get(item.itemId)
    const alternativeUnits: CustomUnitConversion[] = (itemDef?.conversions ?? []).map((c) => ({
      unit: c.unit,
      factor: Number(c.factor),
    }))
    const unitKind = (itemDef?.unitKind ?? "CUSTOM") as UnitKind
    const baseUnit = itemDef?.baseUnit ?? item.unit
    const customUnitConfigs = buildCustomUnitConfigs(baseUnit, unitKind, alternativeUnits)
    const displayQty = getDisplayQty(item.quantity, baseUnit, customUnitConfigs)
    return {
      id: item.itemId,
      name: item.itemName,
      stockQty: displayQty.qty,
      unit: displayQty.unit,
      unitKind: unitKind as "MASS" | "VOLUME" | "COUNT" | "CUSTOM",
      alternativeUnits,
    }
  })

  return (
    <ProductionTabs
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        category: p.category,
        currentQty: p.currentQty,
        isActive: p.isActive,
        prices: p.prices.map((price) => ({
          priceTierId: price.priceTierId,
          price: price.price,
        })),
      }))}
      productions={productions.items.map((production) => ({
        id: production.id,
        date: production.date,
        status: production.status,
        note: production.note,
        bahanItems: production.lines.filter((l) => l.lineType === "INPUT").map((item) => {
          const displayQty = getDisplayQty(item.quantity, item.unit)
          return {
            bahanName: item.itemName,
            unit: displayQty.unit,
            qtyUsed: displayQty.qty,
          }
        }),
        productItems: production.lines.filter((l) => l.lineType === "OUTPUT").map((item) => ({
          productName: item.itemName,
          qtyProduced: item.quantity,
        })),
      }))}
      bahanList={bahanList}
      productList={products.map((p) => ({ id: p.id, name: p.name }))}
      priceTiers={priceTiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        code: tier.code,
        isDefault: tier.isDefault,
      }))}
      categories={categories}
      operationalMode={operationalMode ?? "WITH_INVENTORY"}
    />
  )
}
