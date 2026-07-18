'use server'

import { revalidatePath } from 'next/cache'
import { toActionResult } from '@/lib/action-result'
import { requireAuth } from '@/server/api/auth-context'
import { checkMaintenance } from '@/server/domain/maintenance-check'
import { createProduction, type ProductionDTO } from '@/server/domain/production/production-service'

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

export async function createProductionAction(input: CreateProductionInput): Promise<{ success: boolean; data?: ProductionDTO; error?: string }> {
  return toActionResult(async () => {
    checkMaintenance()
    const ctx = await requireAuth()

    const production = await createProduction(ctx, {
      date: input.date?.toISOString(),
      note: input.note,
      bahanItems: input.bahanItems?.map((item) => ({
        bahanId: item.bahanId,
        qtyUsed: item.qtyUsed,
        unit: item.unit,
      })),
      productItems: input.productItems.map((item) => ({
        productId: item.productId,
        qtyProduced: item.qtyProduced,
      })),
    })

    revalidatePath('/production')
    revalidatePath('/inventory')

    return production
  })
}
