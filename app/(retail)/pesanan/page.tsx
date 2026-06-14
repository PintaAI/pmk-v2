import { PesananTabs } from "@/components/pesanan/pesanan-tabs"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function PesananPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let tokoId: string | null = null

  if (session?.user) {
    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: session.user.id },
      select: { tokoId: true },
      orderBy: { createdAt: 'asc' },
    })
    tokoId = tokoUser?.tokoId ?? null
  }

  const baseFilter = tokoId ? { tokoId } : { tokoId: '__none__' }

  const [pesananData, products] = await Promise.all([
    prisma.pesanan.findMany({
      where: baseFilter,
      orderBy: { tanggal: 'desc' },
      take: 100,
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            qty: true,
            unitPrice: true,
            subtotal: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { ...baseFilter, isActive: true },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        currentQty: true,
        prices: {
          include: { priceTier: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  const pesananList = pesananData.map((p) => ({
    id: p.id,
    kode: p.kode,
    tanggal: p.tanggal.toISOString(),
    namaPelanggan: p.namaPelanggan,
    kontak: p.kontak,
    catatan: p.catatan,
    statusPengiriman: p.statusPengiriman,
    statusPembayaran: p.statusPembayaran,
    total: p.total.toString(),
    items: p.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      qty: item.qty.toString(),
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
    })),
  }))

  const productNames: Record<string, string> = {}
  for (const p of products) {
    productNames[p.id] = p.name
  }

  const productList = products.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    currentQty: p.currentQty.toString(),
    prices: p.prices.map((price) => ({
      priceTierId: price.priceTier.id,
      priceTierCode: price.priceTier.code,
      priceTierName: price.priceTier.name,
      price: price.price.toString(),
      isDefault: price.priceTier.isDefault,
    })),
  }))

  return (
    <PesananTabs
      pesananList={pesananList}
      productList={productList}
      productNames={productNames}
    />
  )
}
