import type { PaymentMethod } from "./types"

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
  ewallet: "E-Wallet",
}

export const paymentMethods: readonly PaymentMethod[] = ["cash", "qris", "transfer", "ewallet"]

export const cashDenominations = [1000, 2000, 5000, 10000, 20000, 50000, 100000]
