import { InventoryTabs } from "@/components/inventory/inventory-tabs"
import { prisma } from "@/lib/prisma"
import { buildCustomUnitConfigs, fromBaseUnitPrice, getDisplayQty } from "@/lib/units"
import type { CustomUnitConversion } from "@/lib/units"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import type { OperationalMode } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

export default async function InventoryPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let tokoId: string | null = null
  let operationalMode: OperationalMode = "WITH_INVENTORY"

  if (session?.user) {
    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: session.user.id },
      select: { tokoId: true, toko: { select: { operationalMode: true } } },
      orderBy: { createdAt: 'asc' },
    })
    tokoId = tokoUser?.tokoId ?? null
    operationalMode = tokoUser?.toko.operationalMode ?? operationalMode
  }

  const bahanFilter = tokoId ? { tokoId } : { tokoId: '__none__' }
  const movementFilter = tokoId ? { tokoId, itemType: "BAHAN" as const } : { tokoId: '__none__', itemType: "BAHAN" as const }
  const belanjaFilter = tokoId ? { tokoId, status: "COMPLETED" as const } : { tokoId: '__none__', status: "COMPLETED" as const }

  const [bahan, movements, belanjaList] = await Promise.all([
    prisma.bahan.findMany({
      where: bahanFilter,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        unit: true,
        unitKind: true,
        baseUnit: true,
        currentQty: true,
        averageCost: true,
        conversions: {
          select: { unit: true, factor: true },
        },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        ...movementFilter,
        movementType: {
          in: ["BAHAN_PURCHASE", "BAHAN_PRODUCTION_USAGE"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        movementType: true,
        direction: true,
        qty: true,
        unitCost: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
        bahan: {
          select: {
            name: true,
            unit: true,
            baseUnit: true,
          },
        },
      },
    }),
    prisma.belanja.findMany({
      where: belanjaFilter,
      orderBy: { date: "desc" },
      take: 50,
      include: {
        items: {
          include: {
            bahan: {
              select: { name: true, unit: true, baseUnit: true },
            },
          },
        },
      },
    }),
  ])

  const bahanItems = bahan.map((item) => {
    const alternativeUnits: CustomUnitConversion[] = item.conversions.map((c) => ({
      unit: c.unit,
      factor: Number(c.factor),
    }))
    const customUnitConfigs = buildCustomUnitConfigs(item.unit, item.unitKind, alternativeUnits)
    const displayQty = getDisplayQty(item.currentQty.toString(), item.unit, customUnitConfigs)

    return {
      id: item.id,
      name: item.name,
      unit: displayQty.unit,
      unitKind: item.unitKind,
      currentQty: displayQty.qty,
      averageCost: fromBaseUnitPrice(item.averageCost.toString(), displayQty.unit, customUnitConfigs).toString(),
      alternativeUnits,
      baseUnit: item.unit,
      baseQty: item.currentQty.toString(),
      baseAverageCost: item.averageCost.toString(),
    }
  })

  return (
    <InventoryTabs
      bahan={bahanItems}
      movements={movements.map((movement) => {
        const displayQty = getDisplayQty(movement.qty.toString(), movement.bahan?.unit ?? "")

        return {
          id: movement.id,
          movementType: movement.movementType,
          direction: movement.direction,
          qty: displayQty.qty,
          unitCost: movement.unitCost === null ? null : fromBaseUnitPrice(movement.unitCost.toString(), movement.bahan?.unit ?? "").toString(),
          referenceType: movement.referenceType,
          referenceId: movement.referenceId,
          createdAt: movement.createdAt.toISOString(),
          bahanName: movement.bahan?.name ?? "Unknown bahan",
          unit: displayQty.unit,
        }
      })}
      belanjaList={belanjaList.map((b) => ({
        id: b.id,
        date: b.date.toISOString(),
        supplier: b.supplier,
        note: b.note,
        status: b.status,
        totalAmount: b.totalAmount.toString(),
        items: b.items.map((item) => {
          const displayQty = getDisplayQty(item.qty.toString(), item.bahan.unit)

          return {
            id: item.id,
            bahanName: item.bahan.name,
            unit: displayQty.unit,
            qty: displayQty.qty,
            unitPrice: fromBaseUnitPrice(item.unitPrice.toString(), displayQty.unit).toString(),
            subtotal: item.subtotal.toString(),
          }
        }),
      }))}
      operationalMode={operationalMode}
    />
  )
}
