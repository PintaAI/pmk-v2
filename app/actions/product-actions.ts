'use server'

import { revalidatePath } from 'next/cache'
import { put } from '@vercel/blob'
import { getUserAndTokoId } from '@/lib/toko'
import { checkMaintenance } from '@/server/domain/maintenance-check'
import { toActionResult } from '@/lib/action-result'
import { requireText, toDecimal } from '@/lib/number'
import { archiveItem, createItem, updateItem, upsertItemPrices } from '@/server/domain/items/item-service'
import { createProductCategory } from '@/server/domain/items/product-category-service'

function extractPrices(formData: FormData) {
  const priceTierIds = formData.getAll("priceTierId").map(String)
  return priceTierIds.map((priceTierId) => ({
    priceTierId,
    price: formData.get(`price-${priceTierId}`) as string,
  }))
}

async function uploadProductImage(formData: FormData, tokoId: string): Promise<string | undefined> {
  const file = formData.get('imageFile') as File | null
  if (!file || !(file instanceof File) || file.size === 0) return undefined

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(file.type)) {
    throw new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.')
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Ukuran gambar maksimal 2 MB.')
  }

  const ext = file.type.split('/')[1] ?? 'jpg'
  const blob = await put(`product/${tokoId}/${Date.now()}.${ext}`, file, {
    access: 'private',
    contentType: file.type,
  })
  return blob.url
}

export async function createProductAction(_prevState: unknown, formData: FormData) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()

    const prices = extractPrices(formData)
    if (!prices.length) {
      throw new Error('Produk harus memiliki minimal satu harga.')
    }

    const rawQty = formData.get('currentQty') as string | null
    const categoryId = String(formData.get('categoryId') ?? '').trim() || null
    const imageUrl = await uploadProductImage(formData, tokoId)

    const product = await createItem(
      { actorId: userId, tokoId, role: 'STAFF' },
      {
        type: 'PRODUCT',
        name: requireText(formData.get('name') as string, 'Product name'),
        imageUrl,
        categoryId,
        initialQty: rawQty ? toDecimal(rawQty, 'Initial stock').toString() : undefined,
        prices: prices.map((item) => ({
          priceTierId: requireText(item.priceTierId, 'Price tier'),
          price: toDecimal(item.price, 'Product price').toString(),
        })),
      },
    )

    revalidatePath('/production')
    revalidatePath('/cashier')

    return product
  })
}

export async function updateProductAction(_prevState: unknown, formData: FormData) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()

    const productId = formData.get('productId') as string
    if (!productId) throw new Error('ID produk tidak ditemukan.')

    const prices = extractPrices(formData)
    const categoryId = String(formData.get('categoryId') ?? '').trim() || null
    const imageUrl = await uploadProductImage(formData, tokoId)

    const ctx = { actorId: userId, tokoId, role: 'STAFF' as const }
    let product = await updateItem(ctx, productId, {
      name: requireText(formData.get('name') as string, 'Product name'),
      imageUrl,
      categoryId,
    })

    if (prices.length) {
      product = await upsertItemPrices(ctx, productId, prices.map((item) => ({
        priceTierId: requireText(item.priceTierId, 'Price tier'),
        price: toDecimal(item.price, 'Product price').toString(),
      })))
    }

    revalidatePath('/production')
    revalidatePath('/cashier')

    return product
  })
}

export async function createProductCategoryAction(input: { name: string }) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()
    const category = await createProductCategory(
      { actorId: userId, tokoId, role: 'STAFF' },
      requireText(input.name, 'Category name'),
    )
    return category
  })
}

export async function archiveProductAction(id: string) {
  return toActionResult(async () => {
    checkMaintenance()
    const { userId, tokoId } = await getUserAndTokoId()
    const product = await archiveItem({ actorId: userId, tokoId, role: 'STAFF' }, id)

    revalidatePath('/production')
    revalidatePath('/cashier')
    return product
  })
}
