import { crc16 } from "./crc16"
import { buildTLV, getTag, parseTLV, type TLVElement, withoutTags } from "./tlv"
import { normalizeQRIS, validateQRIS } from "./validator"

export function convertToDynamic(staticQRIS: string, amount: number) {
  const payload = normalizeQRIS(staticQRIS)
  const validation = validateQRIS(payload)

  if (!validation.valid) {
    throw new Error(validation.errors[0] ?? "QRIS statis tidak valid")
  }

  const elements = withoutTags(parseTLV(payload), ["54", "55", "56", "57", "63"])
  const initiationMethod = getTag(elements, "01")

  if (!initiationMethod) {
    throw new Error("Tag 01 tidak ditemukan")
  }

  initiationMethod.value = "12"
  initiationMethod.length = 2

  const amountElement: TLVElement = {
    tag: "54",
    length: 0,
    value: formatQRISAmount(amount),
  }

  const insertIndex = findInsertIndex(elements, "54")
  elements.splice(insertIndex, 0, amountElement)

  const withoutCrc = `${buildTLV(elements)}6304`
  return `${withoutCrc}${crc16(withoutCrc)}`
}

function formatQRISAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nominal QRIS harus lebih dari 0")
  }

  return amount.toFixed(2)
}

function findInsertIndex(elements: TLVElement[], tag: string) {
  const numericTag = Number(tag)
  const index = elements.findIndex((element) => Number(element.tag) > numericTag)
  return index === -1 ? elements.length : index
}
