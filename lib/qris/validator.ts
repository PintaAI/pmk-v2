import { crc16 } from "./crc16"
import { getTag, parseTLV } from "./tlv"

export type QRISValidationResult = {
  valid: boolean
  errors: string[]
  data?: {
    merchantName?: string
    merchantCity?: string
    merchantCategoryCode?: string
    currency?: string
    amount?: string
    isDynamic: boolean
  }
}

export function validateQRIS(input: string): QRISValidationResult {
  const payload = normalizeQRIS(input)
  const errors: string[] = []

  if (!payload) {
    return { valid: false, errors: ["Payload QRIS kosong"] }
  }

  let elements
  try {
    elements = parseTLV(payload)
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Payload QRIS tidak valid"],
    }
  }

  const payloadIndicator = getTag(elements, "00")
  const initiationMethod = getTag(elements, "01")
  const merchantName = getTag(elements, "59")
  const merchantCity = getTag(elements, "60")
  const merchantCategoryCode = getTag(elements, "52")
  const currency = getTag(elements, "53")
  const amount = getTag(elements, "54")
  const countryCode = getTag(elements, "58")
  const checksum = getTag(elements, "63")

  if (payloadIndicator?.value !== "01") errors.push("Tag 00 bukan payload QRIS/EMV yang valid")
  if (!initiationMethod || !["11", "12"].includes(initiationMethod.value)) {
    errors.push("Tag 01 harus berisi 11 (statis) atau 12 (dinamis)")
  }
  if (!merchantCategoryCode) errors.push("Tag 52 (MCC) tidak ditemukan")
  if (currency?.value !== "360") errors.push("Tag 53 harus 360 untuk IDR")
  if (countryCode?.value !== "ID") errors.push("Tag 58 harus ID")
  if (!merchantName) errors.push("Tag 59 (nama merchant) tidak ditemukan")
  if (!merchantCity) errors.push("Tag 60 (kota merchant) tidak ditemukan")

  if (!checksum) {
    errors.push("Tag 63 (CRC) tidak ditemukan")
  } else {
    const checksumIndex = payload.lastIndexOf("6304")
    if (checksumIndex === -1) {
      errors.push("Format tag 63 (CRC) tidak valid")
    } else {
      const expected = crc16(payload.slice(0, checksumIndex + 4))
      if (checksum.value.toUpperCase() !== expected) {
        errors.push("CRC QRIS tidak sesuai")
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      merchantName: merchantName?.value,
      merchantCity: merchantCity?.value,
      merchantCategoryCode: merchantCategoryCode?.value,
      currency: currency?.value,
      amount: amount?.value,
      isDynamic: initiationMethod?.value === "12",
    },
  }
}

export function normalizeQRIS(input: string) {
  const payload = input
    .replace(/^\uFEFF/, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()

  const startIndex = payload.indexOf("000201")
  return startIndex === -1 ? payload : payload.slice(startIndex)
}
