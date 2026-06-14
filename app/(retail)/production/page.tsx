import { ProductionTabs } from "@/components/production/production-tabs"
import { prisma } from "@/lib/prisma"
import { buildCustomUnitConfigs, getDisplayQty } from "@/lib/units"
import type { CustomUnitConversion } from "@/lib/units"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function ProductionPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let tokoId: string | null = null

  if (session?.user) {
    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: session.user.id },
      select: { tokoId: true },
      orderBy: { createdAt: 'asc' },
    })
    tokoId = tokoUser?.tokoId ?? null
  }

  const tokoFilter = tokoId ? { tokoId } : { tokoId: '__none__' }

  const [products, productions, bahan, priceTiers] = await Promise.all([
    prisma.product.findMany({
      where: tokoFilter,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        currentQty: true,
        isActive: true,
        prices: {
          select: {
            priceTierId: true,
            price: true,
          },
        },
      },
    }),
    prisma.production.findMany({
      where: tokoFilter,
      orderBy: { date: "desc" },
      take: 50,
      select: {
        id: true,
        date: true,
        status: true,
        note: true,
        bahanItems: {
          select: {
            qtyUsed: true,
            bahan: {
              select: {
                name: true,
                unit: true,
                baseUnit: true,
              },
            },
          },
        },
        productItems: {
          select: {
            qtyProduced: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.bahan.findMany({
      where: tokoFilter,
      orderBy: { name: "asc" },
      select: { id: true, name: true, currentQty: true, unit: true, unitKind: true, baseUnit: true, conversions: { select: { unit: true, factor: true } } },
    }),
    prisma.priceTier.findMany({
      where: { ...tokoFilter, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true, isDefault: true },
    }),
  ])

  return (
    <ProductionTabs
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        currentQty: product.currentQty.toString(),
        isActive: product.isActive,
        prices: product.prices.map((price) => ({
          priceTierId: price.priceTierId,
          price: price.price.toString(),
        })),
      }))}
      productions={productions.map((production) => ({
        id: production.id,
        date: production.date.toISOString(),
        status: production.status,
        note: production.note,
        bahanItems: production.bahanItems.map((item) => {
          const displayQty = getDisplayQty(item.qtyUsed.toString(), item.bahan.unit)

          return {
            bahanName: item.bahan.name,
            unit: displayQty.unit,
            qtyUsed: displayQty.qty,
          }
        }),
        productItems: production.productItems.map((item) => ({
          productName: item.product.name,
          qtyProduced: item.qtyProduced.toString(),
        })),
      }))}
      bahanList={bahan.map((item) => {
        const alternativeUnits: CustomUnitConversion[] = item.conversions.map((c) => ({
          unit: c.unit,
          factor: Number(c.factor),
        }))
        const customUnitConfigs = buildCustomUnitConfigs(item.unit, item.unitKind, alternativeUnits)
        const displayQty = getDisplayQty(item.currentQty.toString(), item.unit, customUnitConfigs)

        return {
          id: item.id,
          name: item.name,
          stockQty: displayQty.qty,
          unit: displayQty.unit,
          unitKind: item.unitKind,
          alternativeUnits,
        }
      })}
      productList={products.map((p) => ({ id: p.id, name: p.name }))}
      priceTiers={priceTiers}
    />
  )
}
