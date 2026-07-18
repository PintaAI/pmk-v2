// DTO enums for use in API contracts and client components.
// These mirror Prisma enums but are not tied to the generated client.
// Prisma enum imports into client components are prohibited.

export const ItemType = { MATERIAL: "MATERIAL", PRODUCT: "PRODUCT" } as const
export type ItemType = (typeof ItemType)[keyof typeof ItemType]

export const OrderSource = { CASHIER: "CASHIER", MANUAL: "MANUAL" } as const
export type OrderSource = (typeof OrderSource)[keyof typeof OrderSource]

export const SaleChannel = { CASHIER: "CASHIER", RESELLER: "RESELLER", ONLINE: "ONLINE" } as const
export type SaleChannel = (typeof SaleChannel)[keyof typeof SaleChannel]

export const OrderStatus = { DRAFT: "DRAFT", CONFIRMED: "CONFIRMED", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED" } as const
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export const PaymentStatus = { UNPAID: "UNPAID", PARTIALLY_PAID: "PARTIALLY_PAID", PAID: "PAID", REFUNDED: "REFUNDED" } as const
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const FulfillmentStatus = {
  UNFULFILLED: "UNFULFILLED",
  PROCESSING: "PROCESSING",
  READY: "READY",
  SHIPPED: "SHIPPED",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED",
} as const
export type FulfillmentStatus = (typeof FulfillmentStatus)[keyof typeof FulfillmentStatus]

export const PaymentMethod = { CASH: "CASH", QRIS: "QRIS", TRANSFER: "TRANSFER", EWALLET: "EWALLET", OTHER: "OTHER" } as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const UnitKind = { MASS: "MASS", VOLUME: "VOLUME", COUNT: "COUNT", CUSTOM: "CUSTOM" } as const
export type UnitKind = (typeof UnitKind)[keyof typeof UnitKind]

export const OperationalMode = { CASHIER_ONLY: "CASHIER_ONLY", SIMPLE_INVENTORY: "SIMPLE_INVENTORY", WITH_INVENTORY: "WITH_INVENTORY" } as const
export type OperationalMode = (typeof OperationalMode)[keyof typeof OperationalMode]

export const TokoRole = { OWNER: "OWNER", STAFF: "STAFF" } as const
export type TokoRole = (typeof TokoRole)[keyof typeof TokoRole]

export const StockMovementType = {
  OPENING_BALANCE: "OPENING_BALANCE",
  PURCHASE: "PURCHASE",
  PRODUCTION_INPUT: "PRODUCTION_INPUT",
  PRODUCTION_OUTPUT: "PRODUCTION_OUTPUT",
  SALE: "SALE",
  ADJUSTMENT: "ADJUSTMENT",
  REVERSAL: "REVERSAL",
  MIGRATION_OPENING_BALANCE: "MIGRATION_OPENING_BALANCE",
} as const
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType]

export const ProductionLineType = { INPUT: "INPUT", OUTPUT: "OUTPUT" } as const
export type ProductionLineType = (typeof ProductionLineType)[keyof typeof ProductionLineType]

export const DocumentStatus = { COMPLETED: "COMPLETED", CANCELLED: "CANCELLED" } as const
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus]

export interface AuthContext {
  actorId: string
  tokoId: string
  role: TokoRole
}
