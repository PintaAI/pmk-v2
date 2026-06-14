'use server'

import { revalidatePath } from 'next/cache'
import { getUserAndTokoId } from '@/lib/toko'
import { toActionResult } from '@/lib/action-result'
import { createBelanja, type CreateBelanjaInput } from '@/server/services/belanja-service'

export async function createBelanjaAction(input: CreateBelanjaInput) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const belanja = await createBelanja(input, userId, tokoId)

    revalidatePath('/inventory')

    return belanja
  })
}
