import { MovementDirection, MovementType, OperationalMode } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePositive, requireText } from '@/lib/number'
import { buildCustomUnitConfigs, getUnitConfig } from '@/lib/units'
import type { CustomUnitConversion, UnitConfig } from '@/lib/units'
import { logActivity } from './activity-service'
import { decreaseBahanStock, increaseProductStock } from './inventory-service'

export type CreateProductionInput = {
  date?: Date
  note?: string
  bahanItems?: Array<{
    bahanId: string
    qtyUsed: string | number
    unit?: string
  }>
  productItems: Array<{
    productId: string
    qtyProduced: string | number
  }>
}

export async function createProduction(input: CreateProductionInput, actorId: string, tokoId: string) {
  const toko = await prisma.toko.findUniqueOrThrow({
    where: { id: tokoId },
    select: { operationalMode: true },
  })
  const isSimpleMode = toko.operationalMode === OperationalMode.SIMPLE_INVENTORY
  const inputBahanItems = isSimpleMode ? [] : input.bahanItems ?? []

  if (!isSimpleMode && !inputBahanItems.length) {
    throw new Error('Produksi harus menggunakan minimal satu bahan.')
  }

  if (!input.productItems.length) {
    throw new Error('Produksi harus menghasilkan minimal satu produk.')
  }

  const bahanIds = [...new Set(inputBahanItems.map((item) => requireText(item.bahanId, 'Bahan')))]
  const bahanList = await prisma.bahan.findMany({
    where: { id: { in: bahanIds } },
    select: {
      id: true,
      unit: true,
      unitKind: true,
      conversions: {
        select: { unit: true, factor: true },
      },
    },
  })
  const bahanById = new Map(bahanList.map((b) => [b.id, b]))
  const configsByBahanId = new Map<string, Record<string, UnitConfig>>(
    bahanList.map((b) => {
      const conversions: CustomUnitConversion[] = b.conversions.map((c) => ({
        unit: c.unit,
        factor: Number(c.factor),
      }))
      return [b.id, buildCustomUnitConfigs(b.unit, b.unitKind, conversions)]
    }),
  )

  const bahanItems = inputBahanItems.map((item) => {
    const bahanId = requireText(item.bahanId, 'Bahan')
    const bahan = bahanById.get(bahanId)
    if (!bahan) throw new Error('Bahan tidak ditemukan.')

    const customUnitConfigs = configsByBahanId.get(bahanId)
    const bahanUnit = getUnitConfig(bahan.unit, customUnitConfigs)
    const itemUnit = item.unit || bahan.unit
    const unit = getUnitConfig(itemUnit, customUnitConfigs)
    if (unit.baseUnit !== bahanUnit.baseUnit) {
      throw new Error(`Unit ${unit.unit} tidak cocok untuk bahan ini`)
    }

    return {
      bahanId,
      qtyUsed: requirePositive(item.qtyUsed, 'Bahan qty used').mul(unit.factor),
    }
  })

  const productItems = input.productItems.map((item) => ({
    productId: requireText(item.productId, 'Product'),
    qtyProduced: requirePositive(item.qtyProduced, 'Product qty produced'),
  }))

  return prisma.$transaction(async (tx) => {
    const production = await tx.production.create({
      data: {
        tokoId,
        date: input.date,
        note: input.note?.trim() || undefined,
        createdById: actorId,
        ...(bahanItems.length > 0
          ? {
              bahanItems: {
                create: bahanItems.map((item) => ({
                  bahanId: item.bahanId,
                  qtyUsed: item.qtyUsed,
                })),
              },
            }
          : {}),
        productItems: {
          create: productItems.map((item) => ({
            productId: item.productId,
            qtyProduced: item.qtyProduced,
          })),
        },
      },
    })

    for (const item of bahanItems) {
      await decreaseBahanStock(tx, {
        tokoId,
        bahanId: item.bahanId,
        movementType: MovementType.BAHAN_PRODUCTION_USAGE,
        direction: MovementDirection.OUT,
        qty: item.qtyUsed,
        referenceType: 'Production',
        referenceId: production.id,
        createdById: actorId,
      })
    }

    for (const item of productItems) {
      await increaseProductStock(tx, {
        tokoId,
        productId: item.productId,
        movementType: MovementType.PRODUCT_PRODUCTION_OUTPUT,
        direction: MovementDirection.IN,
        qty: item.qtyProduced,
        referenceType: 'Production',
        referenceId: production.id,
        createdById: actorId,
      })
    }

    await logActivity(tx, {
      tokoId,
      actorId,
      action: 'created_production',
      entityType: 'Production',
      entityId: production.id,
        metadata: {
          bahanItemsCount: bahanItems.length,
          productItemsCount: productItems.length,
          simpleMode: isSimpleMode,
        },
    })

    return { id: production.id }
  })
}
