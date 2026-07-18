import { ValidationError } from "@/server/domain/errors"

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_IMAGE_SIZE = 2 * 1024 * 1024

export function requireText(value: unknown, fieldName: string): string {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) throw new ValidationError(`${fieldName} is required`)
  return text
}

export function requirePositiveDecimal(value: unknown, fieldName: string): string {
  const v = typeof value === "number" || typeof value === "string" ? Number(value) : NaN
  if (Number.isNaN(v) || v <= 0) throw new ValidationError(`${fieldName} must be positive`)
  return String(v)
}

export function requireNonNegativeDecimal(value: unknown, fieldName: string): string {
  const v = typeof value === "number" || typeof value === "string" ? Number(value) : NaN
  if (Number.isNaN(v) || v < 0) throw new ValidationError(`${fieldName} must be non-negative`)
  return String(v)
}

export function validateImageFile(file: File): void {
  if (file.size > MAX_IMAGE_SIZE) throw new ValidationError("Image must be at most 2 MB")
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new ValidationError("Image must be JPG, PNG, or WebP")
}

export function validateName(value: unknown, fieldName: string, maxLength = 80): string {
  const text = requireText(value, fieldName)
  if (text.length < 2) throw new ValidationError(`${fieldName} must be at least 2 characters`)
  if (text.length > maxLength) throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`)
  return text
}
