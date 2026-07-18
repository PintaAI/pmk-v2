// Types for pesanan/orders components. No Prisma imports.
export type PesananItem = {
  id: string
  kode: string
  tanggal: string
  namaPelanggan: string | null
  kontak: string | null
  catatan: string | null
  statusPengiriman: string
  statusPembayaran: string
  total: string
  cancelledAt?: string | null
  items: Array<{
    id: string
    productId: string
    qty: string
    unitPrice: string
    subtotal: string
  }>
}

export type ProductOption = {
  id: string
  name: string
  imageUrl: string | null
  currentQty: string
  prices: Array<{
    priceTierId: string
    priceTierCode: string
    priceTierName: string
    price: string
    isDefault: boolean
  }>
}

export function formatCurrency(value: string | number) {
  return Number(value).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
}

export function formatQty(value: string | number) {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 3 })
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
