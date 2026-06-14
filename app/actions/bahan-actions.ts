'use server'

import { revalidatePath } from 'next/cache'
import { getUserAndTokoId } from '@/lib/toko'
import { toActionResult } from '@/lib/action-result'
import { requireText, toDecimal } from '@/lib/number'
import { prisma } from '@/lib/prisma'
import { getUnitConfig, toBaseQty, toBaseUnitPrice } from '@/lib/units'
import { Prisma } from '@/generated/prisma/client'

export type CreateBahanInput = {
  name: string
  unit: string
  currentQty?: string | number
  averageCost?: string | number
  alternativeUnits?: Array<{ unit: string; factor: string | number }>
}

function parseAlternativeUnits(units?: Array<{ unit: string; factor: string | number }>) {
  if (!units || units.length === 0) return []

  return units
    .filter((u) => u.unit.trim().length > 0)
    .map((u) => ({
      unit: u.unit.trim().toLowerCase(),
      factor: Number(u.factor),
    }))
    .filter((u) => Number.isFinite(u.factor) && u.factor > 0)
}

export async function createBahanAction(input: CreateBahanInput) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const unit = getUnitConfig(requireText(input.unit, 'Bahan unit'))
    const alternativeUnits = parseAlternativeUnits(input.alternativeUnits)

    const bahan = await prisma.$transaction(async (tx) => {
      const created = await tx.bahan.create({
        data: {
          tokoId,
          name: requireText(input.name, 'Bahan name'),
          unit: unit.unit,
          unitKind: unit.unitKind,
          baseUnit: unit.baseUnit,
          currentQty: input.currentQty === undefined ? undefined : toDecimal(toBaseQty(input.currentQty, unit.unit), 'Initial stock'),
          averageCost: input.averageCost === undefined ? undefined : toDecimal(toBaseUnitPrice(input.averageCost, unit.unit), 'Average cost'),
          conversions: alternativeUnits.length
            ? {
                create: alternativeUnits.map((u) => ({
                  unit: u.unit,
                  factor: new Prisma.Decimal(u.factor),
                })),
              }
            : undefined,
        },
        select: { id: true },
      })

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'created_bahan',
          entityType: 'Bahan',
          entityId: created.id,
        },
      })

      return created
    })

    revalidatePath('/inventory')

    return bahan
  })
}

export async function updateBahanAction(id: string, input: Partial<CreateBahanInput>) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const unit = input.unit === undefined ? null : getUnitConfig(requireText(input.unit, 'Bahan unit'))

    const alternativeUnits = input.alternativeUnits !== undefined
      ? parseAlternativeUnits(input.alternativeUnits)
      : undefined

    const bahan = await prisma.$transaction(async (tx) => {
      const updated = await tx.bahan.update({
        where: { id, tokoId },
        data: {
          name: input.name === undefined ? undefined : requireText(input.name, 'Bahan name'),
          unit: unit?.unit,
          unitKind: unit?.unitKind,
          baseUnit: unit?.baseUnit,
          currentQty: input.currentQty === undefined ? undefined : toDecimal(unit ? toBaseQty(input.currentQty, unit.unit) : input.currentQty, 'Current stock'),
          averageCost: input.averageCost === undefined ? undefined : toDecimal(unit ? toBaseUnitPrice(input.averageCost, unit.unit) : input.averageCost, 'Average cost'),
        },
        select: { id: true },
      })

      if (alternativeUnits !== undefined) {
        await tx.bahanUnitConversion.deleteMany({ where: { bahanId: id } })

        if (alternativeUnits.length > 0) {
          await tx.bahanUnitConversion.createMany({
            data: alternativeUnits.map((u) => ({
              bahanId: id,
              unit: u.unit,
              factor: new Prisma.Decimal(u.factor),
            })),
          })
        }
      }

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'updated_bahan',
          entityType: 'Bahan',
          entityId: updated.id,
        },
      })

      return updated
    })

    revalidatePath('/inventory')

    return bahan
  })
}

export async function deleteBahanAction(id: string) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()

    const [belanjaCount, productionCount, movementCount] = await Promise.all([
      prisma.belanjaItem.count({ where: { bahanId: id } }),
      prisma.productionBahan.count({ where: { bahanId: id } }),
      prisma.inventoryMovement.count({ where: { bahanId: id } }),
    ])

    if (belanjaCount > 0 || productionCount > 0 || movementCount > 0) {
      throw new Error(
        `Tidak dapat menghapus bahan karena masih digunakan di ${[
          belanjaCount > 0 && `${belanjaCount} transaksi belanja`,
          productionCount > 0 && `${productionCount} produksi`,
          movementCount > 0 && `${movementCount} pergerakan stok`,
        ]
          .filter(Boolean)
          .join(', ')}.`
      )
    }

    const bahan = await prisma.$transaction(async (tx) => {
      await tx.bahanUnitConversion.deleteMany({ where: { bahanId: id } })

      const deleted = await tx.bahan.delete({
        where: { id, tokoId },
        select: { id: true },
      })

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'deleted_bahan',
          entityType: 'Bahan',
          entityId: deleted.id,
        },
      })

      return deleted
    })

    revalidatePath('/inventory')
    return bahan
  })
}
