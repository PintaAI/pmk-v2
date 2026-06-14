'use server'

import { revalidatePath } from 'next/cache'
import { getUserAndTokoId } from '@/lib/toko'
import { toActionResult } from '@/lib/action-result'
import { createProduction, type CreateProductionInput } from '@/server/services/production-service'

export async function createProductionAction(input: CreateProductionInput) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const production = await createProduction(input, userId, tokoId)

    revalidatePath('/production')
    revalidatePath('/inventory')

    return production
  })
}
