import { Prisma } from '@/generated/prisma/client'

export function toDecimal(value: string | number | Prisma.Decimal, fieldName: string) {
  const decimal = new Prisma.Decimal(value)

  if (!decimal.isFinite() || decimal.isNegative()) {
    throw new Error(`${fieldName} must be a positive number`)
  }

  return decimal
}

export function requirePositive(value: string | number | Prisma.Decimal, fieldName: string) {
  const decimal = toDecimal(value, fieldName)

  if (decimal.isZero()) {
    throw new Error(`${fieldName} must be greater than zero`)
  }

  return decimal
}

export function requireText(value: string | undefined | null, fieldName: string) {
  const text = value?.trim()

  if (!text) {
    throw new Error(`${fieldName} is required`)
  }

  return text
}
