'use server'

import { revalidatePath } from 'next/cache'
import { getUserAndTokoId } from '@/lib/toko'
import { toActionResult } from '@/lib/action-result'
import { createSale, type CreateSaleInput } from '@/server/services/sales-service'

export async function createSaleAction(input: CreateSaleInput) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const sale = await createSale(input, userId, tokoId)

    revalidatePath('/cashier')
    revalidatePath('/sales')
    revalidatePath('/production')
    revalidatePath('/inventory')

    return sale
  })
}
