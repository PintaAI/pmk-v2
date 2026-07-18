'use server'

import { revalidatePath } from 'next/cache'
import { toActionResult } from '@/lib/action-result'
import { requireAuth } from '@/server/api/auth-context'
import { checkMaintenance } from '@/server/domain/maintenance-check'
import { createPurchase, type PurchaseDTO } from '@/server/domain/purchases/purchase-service'

export type CreateBelanjaInput = {
  date?: Date
  supplier?: string
  note?: string
  totalAmount?: string | number
  items?: Array<{
    bahanId: string
    qty: string | number
    unit?: string
    unitPrice: string | number
  }>
}

export async function createBelanjaAction(input: CreateBelanjaInput): Promise<{ success: boolean; data?: PurchaseDTO; error?: string }> {
  return toActionResult(async () => {
    checkMaintenance()
    const ctx = await requireAuth()

    const purchase = await createPurchase(ctx, {
      date: input.date?.toISOString(),
      supplier: input.supplier,
      note: input.note,
      totalAmount: input.totalAmount,
      items: input.items?.map((item) => ({
        itemId: item.bahanId,
        qty: item.qty,
        unit: item.unit,
        unitPrice: item.unitPrice,
      })),
    })

    revalidatePath('/inventory')

    return purchase
  })
}
