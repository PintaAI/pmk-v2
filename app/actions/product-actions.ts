'use server'

import { revalidatePath } from 'next/cache'
import { put } from '@vercel/blob'
import { getUserAndTokoId } from '@/lib/toko'
import { toActionResult } from '@/lib/action-result'
import { requireText, toDecimal } from '@/lib/number'
import { prisma } from '@/lib/prisma'

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
    const { userId, tokoId } = await getUserAndTokoId()

    const prices = extractPrices(formData)
    if (!prices.length) {
      throw new Error('Produk harus memiliki minimal satu harga.')
    }

    const rawQty = formData.get('currentQty') as string | null
    const imageUrl = await uploadProductImage(formData, tokoId)

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          tokoId,
          name: requireText(formData.get('name') as string, 'Product name'),
          imageUrl,
          currentQty: rawQty ? toDecimal(rawQty, 'Initial stock') : undefined,
          prices: {
            create: prices.map((item) => ({
              priceTierId: requireText(item.priceTierId, 'Price tier'),
              price: toDecimal(item.price, 'Product price'),
            })),
          },
        },
        select: { id: true },
      })

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'created_product',
          entityType: 'Product',
          entityId: created.id,
        },
      })

      return created
    })

    revalidatePath('/production')

    return product
  })
}

export async function updateProductAction(_prevState: unknown, formData: FormData) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()

    const productId = formData.get('productId') as string
    if (!productId) throw new Error('ID produk tidak ditemukan.')

    const prices = extractPrices(formData)
    const imageUrl = await uploadProductImage(formData, tokoId)

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId, tokoId },
        data: {
          name: requireText(formData.get('name') as string, 'Product name'),
          imageUrl: imageUrl ?? undefined,
        },
        select: { id: true },
      })

      if (prices.length) {
        for (const item of prices) {
          await tx.productPrice.upsert({
            where: {
              productId_priceTierId: {
                productId,
                priceTierId: requireText(item.priceTierId, 'Price tier'),
              },
            },
            update: { price: toDecimal(item.price, 'Product price') },
            create: {
              productId,
              priceTierId: requireText(item.priceTierId, 'Price tier'),
              price: toDecimal(item.price, 'Product price'),
            },
          })
        }
      }

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'updated_product',
          entityType: 'Product',
          entityId: updated.id,
        },
      })

      return updated
    })

    revalidatePath('/production')

    return product
  })
}

export async function archiveProductAction(id: string) {
  return toActionResult(async () => {
    const { userId, tokoId } = await getUserAndTokoId()
    const product = await prisma.$transaction(async (tx) => {
      const archived = await tx.product.update({
        where: { id, tokoId },
        data: { isActive: false },
        select: { id: true },
      })

      await tx.activityLog.create({
        data: {
          tokoId,
          actorId: userId,
          action: 'archived_product',
          entityType: 'Product',
          entityId: archived.id,
        },
      })

      return archived
    })

    revalidatePath('/production')
    return product
  })
}
