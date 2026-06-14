import {
  InventoryItemType,
  MovementDirection,
  MovementType,
  Prisma,
} from '@/generated/prisma/client'
import type { PrismaTx } from './prisma-tx'

type BahanMovementInput = {
  tokoId: string
  bahanId: string
  movementType: MovementType
  direction: MovementDirection
  qty: Prisma.Decimal
  unitCost?: Prisma.Decimal
  referenceType: string
  referenceId: string
  createdById: string
  note?: string
}

type ProductMovementInput = {
  tokoId: string
  productId: string
  movementType: MovementType
  direction: MovementDirection
  qty: Prisma.Decimal
  unitPrice?: Prisma.Decimal
  referenceType: string
  referenceId: string
  createdById: string
  note?: string
}

export async function increaseBahanStock(tx: PrismaTx, input: BahanMovementInput) {
  await tx.bahan.update({
    where: { id: input.bahanId },
    data: { currentQty: { increment: input.qty } },
  })

  return createBahanMovement(tx, input)
}

export async function decreaseBahanStock(tx: PrismaTx, input: BahanMovementInput) {
  const bahan = await tx.bahan.findUniqueOrThrow({ where: { id: input.bahanId } })

  if (bahan.currentQty.lessThan(input.qty)) {
    throw new Error(`Stok tidak cukup untuk bahan ${bahan.name}.`)
  }

  await tx.bahan.update({
    where: { id: input.bahanId },
    data: { currentQty: { decrement: input.qty } },
  })

  return createBahanMovement(tx, input)
}

export async function increaseProductStock(tx: PrismaTx, input: ProductMovementInput) {
  await tx.product.update({
    where: { id: input.productId },
    data: { currentQty: { increment: input.qty } },
  })

  return createProductMovement(tx, input)
}

export async function decreaseProductStock(tx: PrismaTx, input: ProductMovementInput) {
  const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } })

  if (product.currentQty.lessThan(input.qty)) {
    throw new Error(`Stok tidak cukup untuk produk ${product.name}.`)
  }

  await tx.product.update({
    where: { id: input.productId },
    data: { currentQty: { decrement: input.qty } },
  })

  return createProductMovement(tx, input)
}

function createBahanMovement(tx: PrismaTx, input: BahanMovementInput) {
  return tx.inventoryMovement.create({
    data: {
      tokoId: input.tokoId,
      itemType: InventoryItemType.BAHAN,
      bahanId: input.bahanId,
      movementType: input.movementType,
      direction: input.direction,
      qty: input.qty,
      unitCost: input.unitCost,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdById: input.createdById,
      note: input.note,
    },
  })
}

function createProductMovement(tx: PrismaTx, input: ProductMovementInput) {
  return tx.inventoryMovement.create({
    data: {
      tokoId: input.tokoId,
      itemType: InventoryItemType.PRODUCT,
      productId: input.productId,
      movementType: input.movementType,
      direction: input.direction,
      qty: input.qty,
      unitPrice: input.unitPrice,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdById: input.createdById,
      note: input.note,
    },
  })
}
