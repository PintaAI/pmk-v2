const ESC = 0x1b
const GS = 0x1d

const INIT = 0x40 // ESC @

const ALIGN = { left: 0x00, center: 0x01, right: 0x02 }

const BOLD_ON = 0x01
const BOLD_OFF = 0x00

const CUT_FULL = 0x41 // GS V m (m=65='A' full cut)

type ItemLine = { left: string; right: string }

export type EscPosReceipt = {
  title: string
  logoUrl?: string | null
  address?: string | null
  phone?: string | null
  subtitle1: string
  subtitle2: string
  items: ItemLine[]
  total: string
  paymentMethod: string
  amountPaid: string
  change: string
  footer: string
}

const encoder = new TextEncoder()

export function formatEscPosCurrency(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value)}`
}

function sanitizeText(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "?")
}

function bytes(...list: number[][]): number[] {
  return list.flat()
}

function cmd(c: number, ...args: number[]): number[] {
  return [ESC, c, ...args]
}

function gsCmd(c: number, ...args: number[]): number[] {
  return [GS, c, ...args]
}

function text(s: string): number[] {
  return Array.from(encoder.encode(sanitizeText(s)))
}

function dashedLine(width = 32): number[] {
  return text("-".repeat(width))
}

function align(alignment: number): number[] {
  return cmd(0x61, alignment) // ESC a n
}

function bold(on: boolean): number[] {
  return cmd(0x45, on ? BOLD_ON : BOLD_OFF) // ESC E n
}

function feed(lines = 1): number[] {
  return cmd(0x64, lines) // ESC d n
}

function cut(): number[] {
  return bytes(
    feed(3),
    gsCmd(0x56, CUT_FULL), // GS V m — full cut
  )
}

function itemLine(left: string, right: string, width = 32): number[] {
  const rightAligned = right.padStart(width - left.length)
  if (left.length + rightAligned.length <= width) {
    return text(left + rightAligned + "\n")
  }
  return text(left + "\n" + right.padStart(width) + "\n")
}

export function buildEscPosBytes(receipt: EscPosReceipt): Uint8Array {
  const buf: number[] = []

  buf.push(...cmd(INIT)) // ESC @ — initialize
  buf.push(...align(ALIGN.center))
  buf.push(...bold(true))
  buf.push(...text(receipt.title + "\n"))
  buf.push(...bold(false))
  if (receipt.address) {
    buf.push(...text(receipt.address + "\n"))
  }
  if (receipt.phone) {
    buf.push(...text("Telp/WA: " + receipt.phone + "\n"))
  }
  buf.push(...dashedLine())
  buf.push(...text("\n"))
  buf.push(...text(receipt.subtitle1 + "\n"))
  buf.push(...text(receipt.subtitle2 + "\n"))
  buf.push(...align(ALIGN.left))
  buf.push(...dashedLine())
  buf.push(...text("\n"))

  for (const item of receipt.items) {
    buf.push(...itemLine(item.left, item.right))
  }

  buf.push(...dashedLine())
  buf.push(...text("\n"))
  buf.push(...bold(true))
  buf.push(...text("TOTAL".padEnd(18) + receipt.total + "\n"))
  buf.push(...bold(false))
  buf.push(...text("Metode".padEnd(18) + receipt.paymentMethod + "\n"))
  buf.push(...text("Dibayar".padEnd(18) + receipt.amountPaid + "\n"))
  buf.push(...text("Kembali".padEnd(18) + receipt.change + "\n"))
  buf.push(...dashedLine())
  buf.push(...text("\n"))
  buf.push(...align(ALIGN.center))
  buf.push(...text(receipt.footer + "\n"))
  buf.push(...cut())

  return new Uint8Array(buf)
}

/**
 * Convert ESC/POS bytes to a Latin-1 string for sending over Bluetooth serial.
 * The Bluetooth SPP plugin sends strings; we encode bytes using Latin-1
 * (which maps 0x00-0xFF to U+0000-U+00FF directly).
 */
export function bytesToBtString(data: Uint8Array): string {
  let s = ""
  for (let i = 0; i < data.length; i++) {
    s += String.fromCharCode(data[i])
  }
  return s
}
