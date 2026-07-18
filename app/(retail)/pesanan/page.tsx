import { PesananTabs } from "@/components/pesanan/pesanan-tabs"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { listOrders } from "@/server/domain/orders/order-service"
import { listItems } from "@/server/domain/items/item-service"

export const dynamic = "force-dynamic"

export default async function PesananPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let tokoId: string | null = null
  let role = "STAFF"

  if (session?.user) {
    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: session.user.id },
      select: { tokoId: true, role: true },
      orderBy: { createdAt: 'asc' },
    })
    tokoId = tokoUser?.tokoId ?? null
    role = tokoUser?.role ?? "STAFF"
  }

  if (!tokoId) {
    return <PesananTabs pesananList={[]} productList={[]} productNames={{}} />
  }

  const ctx = { actorId: session?.user?.id ?? "", tokoId, role: role as "OWNER" | "STAFF" }

  const [orders, products] = await Promise.all([
    listOrders(ctx, { limit: 100 }),
    listItems(ctx, { type: "PRODUCT", isActive: true }),
  ])

  const pesananList = orders.items
    .filter((o) => o.source === "MANUAL")
    .map((o) => ({
      id: o.id,
      kode: o.number,
      tanggal: o.createdAt,
      namaPelanggan: o.customerName,
      kontak: o.customerContact,
      catatan: o.note,
      statusPengiriman: (["SHIPPED", "FULFILLED"].includes(o.fulfillmentStatus) ? "DIKIRIM" : "BELUM") as "BELUM" | "DIKIRIM",
      statusPembayaran: (o.paymentStatus === "PAID" ? "DIBAYAR" : "BELUM") as "BELUM" | "DIBAYAR",
      total: o.total,
      cancelledAt: o.cancelledAt,
      items: o.lines.map((item) => ({
        id: item.id,
        productId: item.itemId,
        qty: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
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
    currentQty: p.currentQty,
    prices: p.prices.map((price) => ({
      priceTierId: price.priceTierId,
      priceTierCode: price.priceTierCode,
      priceTierName: price.priceTierName,
      price: price.price,
      isDefault: price.isDefault,
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
