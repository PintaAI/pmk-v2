import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { prisma } from "@/lib/prisma"
import { buildCustomUnitConfigs, fromBaseUnitPrice, getDisplayQty } from "@/lib/units"
import type { CustomUnitConversion } from "@/lib/units"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { listBalances, listMovements } from "@/server/domain/inventory/inventory-service"
import { listPurchases } from "@/server/domain/purchases/purchase-service"
import { listItems } from "@/server/domain/items/item-service"
import type { OperationalMode } from "@/generated/prisma/client"
import type { UnitKind } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

export default async function InventoryPage() {
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
    return <InventoryTabs bahan={[]} movements={[]} belanjaList={[]} operationalMode={operationalMode ?? "WITH_INVENTORY"} />
  }

  const ctx = { actorId: session?.user?.id ?? "", tokoId, role: role as "OWNER" | "STAFF" }

  const [materialItems, balances, movements, purchases] = await Promise.all([
    listItems(ctx, { type: "MATERIAL" }),
    listBalances(ctx, { type: "MATERIAL" }),
    listMovements(ctx, { movementType: "PURCHASE", limit: 100 }),
    listPurchases(ctx, { limit: 50 }),
  ])

  const materialItemMap = new Map(materialItems.map((i) => [i.id, i]))

  const bahanItems = balances.map((item) => {
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
      unit: displayQty.unit,
      unitKind: unitKind as "MASS" | "VOLUME" | "COUNT" | "CUSTOM",
      currentQty: displayQty.qty,
      averageCost: fromBaseUnitPrice(item.averageCost.toString(), displayQty.unit, customUnitConfigs).toString(),
      alternativeUnits,
      baseUnit,
      baseQty: item.quantity,
      baseAverageCost: item.averageCost.toString(),
    }
  })

  const belanjaList = purchases.items.map((b) => ({
    id: b.id,
    date: b.date,
    supplier: b.supplier,
    note: b.note,
    status: b.status,
    totalAmount: b.totalAmount,
    items: b.lines.map((line) => {
      const displayQty = getDisplayQty(line.quantity, line.unit)
      return {
        id: line.id,
        bahanName: line.itemName,
        unit: displayQty.unit,
        qty: displayQty.qty,
        unitPrice: line.unitCost,
        subtotal: line.subtotal,
      }
    }),
  }))

  return (
    <InventoryTabs
      bahan={bahanItems}
      movements={movements.items.map((movement) => {
        const itemDef = materialItemMap.get(movement.itemId)
        const conversions = (itemDef?.conversions ?? []).map((conversion) => ({
          unit: conversion.unit,
          factor: Number(conversion.factor),
        }))
        const baseUnit = itemDef?.baseUnit ?? movement.unit
        const unitKind = (itemDef?.unitKind ?? "CUSTOM") as UnitKind
        const displayQty = getDisplayQty(
          movement.quantity,
          baseUnit,
          buildCustomUnitConfigs(baseUnit, unitKind, conversions),
        )
        return {
          id: movement.id,
          movementType: movement.movementType === "PURCHASE" ? "BAHAN_PURCHASE" : movement.movementType === "PRODUCTION_INPUT" ? "BAHAN_PRODUCTION_USAGE" : movement.movementType,
          direction: movement.direction === "IN" ? "IN" : "OUT",
          qty: displayQty.qty,
          unitCost: movement.unitCost,
          referenceType: movement.sourceType,
          referenceId: movement.sourceId,
          createdAt: movement.createdAt,
          bahanName: movement.itemName,
          unit: displayQty.unit,
        }
      })}
      belanjaList={belanjaList}
      operationalMode={operationalMode ?? "WITH_INVENTORY"}
    />
  )
}
