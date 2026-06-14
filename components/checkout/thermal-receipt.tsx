"use client"

import { formatCurrency } from "@/components/cashier/helpers"
import { paymentMethodLabels } from "@/components/cashier/constants"
import type { CartRow, PaymentMethod } from "@/components/cashier/types"

export type ThermalReceiptData = {
  id: string
  rows: CartRow[]
  total: number
  paymentMethod: PaymentMethod
  amountPaid: number
  createdAt: string
}

type ThermalReceiptProps = {
  receipt: ThermalReceiptData | null
}

export function ThermalReceipt({ receipt }: ThermalReceiptProps) {
  if (!receipt) return null

  const change = Math.max(0, receipt.amountPaid - receipt.total)

  return (
    <section className="thermal-receipt" aria-hidden="true">
      <div className="thermal-receipt__center">
        <h1>Pempek Kasir</h1>
        <p>{new Date(receipt.createdAt).toLocaleString("id-ID")}</p>
        <p>#{receipt.id}</p>
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
        <span>Total</span>
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
