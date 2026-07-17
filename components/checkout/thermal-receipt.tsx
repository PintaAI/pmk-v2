"use client"

import { formatCurrency } from "@/components/cashier/helpers"
import { paymentMethodLabels } from "@/components/cashier/constants"
import type { CartRow, PaymentMethod } from "@/components/cashier/types"
import { useTokoImage } from "@/hooks/use-toko-image"

export type ThermalReceiptData = {
  id: string
  rows: CartRow[]
  customerName?: string
  subtotal: number
  deliveryFee: number
  total: number
  paymentMethod: PaymentMethod
  amountPaid: number
  createdAt: string
  toko: {
    name: string
    imageUrl: string | null
    receiptLogoUrl: string | null
    address: string | null
    phone: string | null
  }
}

type ThermalReceiptProps = {
  receipt: ThermalReceiptData | null
}

export function ThermalReceipt({ receipt }: ThermalReceiptProps) {
  const logoUrl = useTokoImage(receipt?.toko.receiptLogoUrl ?? receipt?.toko.imageUrl ?? null)

  if (!receipt) return null

  const change = Math.max(0, receipt.amountPaid - receipt.total)

  return (
    <section className="thermal-receipt" aria-hidden="true">
      <div className="thermal-receipt__center">
        {logoUrl ? <img src={logoUrl} alt="" className="thermal-receipt__logo" /> : null}
        <h1>{receipt.toko.name}</h1>
        {receipt.toko.address ? <p className="thermal-receipt__store-line">{receipt.toko.address}</p> : null}
        {receipt.toko.phone ? <p className="thermal-receipt__store-line">Telp/WA: {receipt.toko.phone}</p> : null}
      </div>

      <div className="thermal-receipt__line" />

      <div className="thermal-receipt__center thermal-receipt__meta">
        <p>{new Date(receipt.createdAt).toLocaleString("id-ID")}</p>
        <p>#{receipt.id}</p>
        {receipt.customerName ? <p>Customer: {receipt.customerName}</p> : null}
      </div>

      <div className="thermal-receipt__line" />

      {receipt.rows.map(({ product, priceTierName, quantity, unitPrice }) => {
        return (
          <div key={`${product.id}-${priceTierName}`} className="thermal-receipt__item">
            <div className="thermal-receipt__row">
              <span>{product.name}</span>
              <span>{formatCurrency(unitPrice * quantity)}</span>
            </div>
            <div className="thermal-receipt__muted">
              {quantity} x {formatCurrency(unitPrice)} ({priceTierName})
            </div>
          </div>
        )
      })}

      <div className="thermal-receipt__line" />

      <div className="thermal-receipt__row thermal-receipt__total">
        <span>Subtotal</span>
        <span>{formatCurrency(receipt.subtotal)}</span>
      </div>
      {receipt.deliveryFee > 0 ? (
        <div className="thermal-receipt__row">
          <span>Ongkir</span>
          <span>{formatCurrency(receipt.deliveryFee)}</span>
        </div>
      ) : null}
      <div className="thermal-receipt__row thermal-receipt__total">
        <span>Grand Total</span>
        <span>{formatCurrency(receipt.total)}</span>
      </div>
      <div className="thermal-receipt__row">
        <span>Metode</span>
        <span>{paymentMethodLabels[receipt.paymentMethod]}</span>
      </div>
      <div className="thermal-receipt__row">
        <span>Dibayar</span>
        <span>{formatCurrency(receipt.amountPaid)}</span>
      </div>
      <div className="thermal-receipt__row">
        <span>Kembali</span>
        <span>{formatCurrency(change)}</span>
      </div>

      <div className="thermal-receipt__line" />

      <p className="thermal-receipt__center">Terima kasih</p>
    </section>
  )
}
