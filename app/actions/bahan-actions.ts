'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getUserAndTokoId } from '@/lib/toko'
import { toActionResult } from '@/lib/action-result'
import { createItem, deleteItem } from '@/server/domain/items/item-service'
import { checkMaintenance } from '@/server/domain/maintenance-check'

export type CreateBahanInput = {
  name: string
  unit: string
  unitKind?: string
  baseUnit?: string
  currentQty?: string | number
  averageCost?: string | number
  alternativeUnits?: Array<{ unit: string; factor: string | number }>
}

export async function createBahanAction(input: CreateBahanInput) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()

    const item = await createItem(
      { actorId: userId, tokoId, role: "STAFF" },
      {
        type: "MATERIAL",
        name: input.name,
        unit: input.unit,
        unitKind: input.unitKind,
        baseUnit: input.baseUnit,
        initialQty: input.currentQty?.toString(),
        initialCost: input.averageCost?.toString(),
        alternativeUnits: input.alternativeUnits?.map((u) => ({ unit: u.unit, factor: u.factor })),
      }
    )

    revalidatePath('/inventory')
    return item
  })
}

export async function updateBahanAction(id: string, input: Partial<CreateBahanInput>) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()
    const { updateItem } = await import('@/server/domain/items/item-service')
    const item = await updateItem(
      { actorId: userId, tokoId, role: "STAFF" },
      id,
      {
        name: input.name,
        unit: input.unit,
        unitKind: input.unitKind as string | undefined,
        baseUnit: input.baseUnit as string | undefined,
      }
    )
    revalidatePath('/inventory')
    return item
  })
}

export async function deleteBahanAction(id: string) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()

    const [purchaseCount, movementCount, orderCount, productionCount] = await Promise.all([
      prisma.purchaseLine.count({ where: { itemId: id } }),
      prisma.stockMovement.count({ where: { itemId: id } }),
      prisma.orderLine.count({ where: { itemId: id } }),
      prisma.productionLine.count({ where: { itemId: id } }),
    ])

    const refCount = purchaseCount + movementCount + orderCount + productionCount
    if (refCount > 0) {
      const parts: string[] = []
      if (purchaseCount > 0) parts.push(`${purchaseCount} transaksi belanja`)
      if (productionCount > 0) parts.push(`${productionCount} produksi`)
      if (movementCount > 0) parts.push(`${movementCount} pergerakan stok`)
      if (orderCount > 0) parts.push(`${orderCount} pesanan`)
      throw new Error(`Tidak dapat menghapus bahan karena masih digunakan di ${parts.join(', ')}.`)
    }

    await deleteItem(
      { actorId: userId, tokoId, role: "OWNER" },
      id
    )

    revalidatePath('/inventory')
    return { id }
  })
}
