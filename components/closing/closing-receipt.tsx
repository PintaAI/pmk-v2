"use client"

import { formatCurrency } from "@/components/cashier/helpers"
import type { DailyClosingRecap } from "@/app/actions/closing-actions"
import { useTokoImage } from "@/hooks/use-toko-image"

type ClosingReceiptProps = {
  recap: DailyClosingRecap | null
}

const paymentRows = [
  ["Tunai", "cash"],
  ["QRIS", "qris"],
  ["Transfer", "transfer"],
  ["E-Wallet", "ewallet"],
  ["Lainnya", "other"],
] as const

export function ClosingReceipt({ recap }: ClosingReceiptProps) {
  const logoUrl = useTokoImage(recap?.toko.receiptLogoUrl ?? recap?.toko.imageUrl ?? null)

  if (!recap) return null

  return (
    <section className="thermal-receipt" aria-hidden="true">
      <div className="thermal-receipt__center">
        {logoUrl ? <img src={logoUrl} alt="" className="thermal-receipt__logo" /> : null}
        <h1>{recap.toko.name}</h1>
        {recap.toko.address ? <p className="thermal-receipt__store-line">{recap.toko.address}</p> : null}
        {recap.toko.phone ? <p className="thermal-receipt__store-line">Telp/WA: {recap.toko.phone}</p> : null}
      </div>

      <div className="thermal-receipt__line" />

      <div className="thermal-receipt__center thermal-receipt__meta">
        <p>CLOSINGAN</p>
        <p>{recap.dateLabel}</p>
        <p>{new Date(recap.closedAt).toLocaleString("id-ID")}</p>
        <p>Kasir: {recap.cashierName}</p>
      </div>

      <div className="thermal-receipt__line" />

      <ReceiptRow label="Transaksi" value={`${recap.totalTransactions}`} />
      <ReceiptRow label="Item terjual" value={`${formatQty(recap.totalItems)}x`} />
      <ReceiptRow label="Omzet" value={formatCurrency(recap.grossTotal)} />
      <ReceiptRow label="Diskon" value={formatCurrency(recap.totalDiscount)} />
      <ReceiptRow label="Bersih" value={formatCurrency(recap.netTotal)} strong />

      <div className="thermal-receipt__line" />

      <p className="thermal-receipt__muted">Pembayaran</p>
      {paymentRows.map(([label, key]) => (
        <ReceiptRow key={key} label={label} value={formatCurrency(recap.paymentBreakdown[key])} />
      ))}

      {recap.topItems.length > 0 ? (
        <>
          <div className="thermal-receipt__line" />
          <p className="thermal-receipt__muted">Top 5 Produk Hari Ini</p>
          {recap.topItems.map((item, index) => (
            <div key={item.productId} className="thermal-receipt__item">
              <ReceiptRow label={`${index + 1}. ${item.name}`} value={`${formatQty(item.qty)}x`} />
              <div className="thermal-receipt__muted">Subtotal: {formatCurrency(item.total)}</div>
            </div>
          ))}
        </>
      ) : null}

      <div className="thermal-receipt__line" />
      <p className="thermal-receipt__center">Laporan closingan selesai</p>
    </section>
  )
}

function ReceiptRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "thermal-receipt__row thermal-receipt__total" : "thermal-receipt__row"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function formatQty(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(value)
}
