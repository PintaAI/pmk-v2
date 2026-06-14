export type TLVElement = {
  tag: string
  length: number
  value: string
  children?: TLVElement[]
}

export function parseTLV(input: string): TLVElement[] {
  const elements: TLVElement[] = []
  const bytes = new TextEncoder().encode(input)
  let index = 0

  while (index < bytes.length) {
    if (index + 4 > bytes.length) {
      throw new Error("Payload TLV tidak lengkap")
    }

    const tag = decodeBytes(bytes, index, index + 2)
    const lengthText = decodeBytes(bytes, index + 2, index + 4)
    const length = Number(lengthText)

    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText) || Number.isNaN(length)) {
      throw new Error("Format tag atau panjang TLV tidak valid")
    }

    const valueStart = index + 4
    const valueEnd = valueStart + length

    if (valueEnd > bytes.length) {
      throw new Error(`Nilai tag ${tag} melebihi panjang payload`)
    }

    const value = decodeBytes(bytes, valueStart, valueEnd)
    const element: TLVElement = { tag, length, value }

    if (isNestedTag(tag)) {
      try {
        element.children = parseTLV(value)
      } catch {
        // Some provider-specific values are not parseable as sub-TLV; keep the raw value.
      }
    }

    elements.push(element)
    index = valueEnd
  }

  return elements
}

export function buildTLV(elements: TLVElement[]): string {
  return elements
    .map((element) => {
      const value = element.children ? buildTLV(element.children) : element.value
      const length = new TextEncoder().encode(value).length.toString().padStart(2, "0")
      return `${element.tag}${length}${value}`
    })
    .join("")
}

export function getTag(elements: TLVElement[], tag: string) {
  return elements.find((element) => element.tag === tag)
}

export function withoutTags(elements: TLVElement[], tags: string[]) {
  return elements.filter((element) => !tags.includes(element.tag))
}

function isNestedTag(tag: string) {
  const numericTag = Number(tag)
  return (numericTag >= 26 && numericTag <= 51) || tag === "62" || tag === "64"
}

function decodeBytes(bytes: Uint8Array, start: number, end: number) {
  return new TextDecoder().decode(bytes.slice(start, end))
}
