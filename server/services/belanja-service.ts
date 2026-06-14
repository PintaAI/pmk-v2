import { MovementDirection, MovementType, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requirePositive, requireText, toDecimal } from '@/lib/number'
import { buildCustomUnitConfigs, getUnitConfig } from '@/lib/units'
import type { CustomUnitConversion, UnitConfig } from '@/lib/units'
import { logActivity } from './activity-service'
import { increaseBahanStock } from './inventory-service'

export type CreateBelanjaInput = {
  date?: Date
  supplier?: string
  note?: string
  items: Array<{
    bahanId: string
    qty: string | number
    unit?: string
    unitPrice: string | number
  }>
}

export async function createBelanja(input: CreateBelanjaInput, actorId: string, tokoId: string) {
  if (!input.items.length) {
    throw new Error('Belanja harus memiliki minimal satu item.')
  }

  const bahanIds = [...new Set(input.items.map((item) => requireText(item.bahanId, 'Bahan')))]
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

  const items = input.items.map((item) => {
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
    const qty = requirePositive(item.qty, 'Item qty').mul(unit.factor)
    const unitPrice = toDecimal(item.unitPrice, 'Item unit price').div(unit.factor)

    return {
      bahanId,
      qty,
      unitPrice,
      subtotal: qty.mul(unitPrice),
    }
  })

  const totalAmount = items.reduce((total, item) => total.plus(item.subtotal), new Prisma.Decimal(0))

  return prisma.$transaction(async (tx) => {
    const belanja = await tx.belanja.create({
      data: {
        tokoId,
        date: input.date,
        supplier: input.supplier?.trim() || undefined,
        note: input.note?.trim() || undefined,
        totalAmount,
        createdById: actorId,
        items: {
          create: items.map((item) => ({
            bahanId: item.bahanId,
            qty: item.qty,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
        },
      },
    })

    for (const item of items) {
      const bahan = await tx.bahan.findUniqueOrThrow({ where: { id: item.bahanId } })
      const previousValue = bahan.currentQty.mul(bahan.averageCost)
      const purchaseValue = item.qty.mul(item.unitPrice)
      const nextQty = bahan.currentQty.plus(item.qty)
      const averageCost = nextQty.isZero() ? new Prisma.Decimal(0) : previousValue.plus(purchaseValue).div(nextQty)

      await tx.bahan.update({
        where: { id: item.bahanId },
        data: { averageCost },
      })

      await increaseBahanStock(tx, {
        tokoId,
        bahanId: item.bahanId,
        movementType: MovementType.BAHAN_PURCHASE,
        direction: MovementDirection.IN,
        qty: item.qty,
        unitCost: item.unitPrice,
        referenceType: 'Belanja',
        referenceId: belanja.id,
        createdById: actorId,
      })
    }

    await logActivity(tx, {
      tokoId,
      actorId,
      action: 'created_belanja',
      entityType: 'Belanja',
      entityId: belanja.id,
      metadata: {
        totalAmount: totalAmount.toString(),
        itemsCount: items.length,
      },
    })

    return { id: belanja.id }
  })
}
