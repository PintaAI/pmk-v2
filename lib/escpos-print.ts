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

function rasterImage(width: number, height: number, data: Uint8Array): number[] {
  const widthBytes = Math.ceil(width / 8)
  return [
    GS,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
    ...Array.from(data),
  ]
}

function itemLine(left: string, right: string, width = 32): number[] {
  const rightAligned = right.padStart(width - left.length)
  if (left.length + rightAligned.length <= width) {
    return text(left + rightAligned + "\n")
  }
  return text(left + "\n" + right.padStart(width) + "\n")
}

async function loadLogoRaster(url: string): Promise<number[] | null> {
  if (typeof window === "undefined") return null

  try {
    const imageUrl = url.startsWith("toko/")
      ? `/api/toko-image?pathname=${encodeURIComponent(url)}`
      : url.includes(".blob.vercel-storage.com/")
        ? `/api/toko-image?url=${encodeURIComponent(url)}`
        : url
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.decoding = "async"
    image.src = imageUrl.startsWith("http") || imageUrl.startsWith("data:") || imageUrl.startsWith("/")
      ? imageUrl
      : `/api/toko-image?url=${encodeURIComponent(imageUrl)}`

    await image.decode()

    const maxWidth = 192
    const scale = Math.min(1, maxWidth / image.naturalWidth)
    const width = Math.max(8, Math.floor(image.naturalWidth * scale / 8) * 8)
    const height = Math.max(8, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    const pixels = ctx.getImageData(0, 0, width, height).data
    const widthBytes = width / 8
    const raster = new Uint8Array(widthBytes * height)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4
        const alpha = pixels[index + 3]
        const luminance = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114
        if (alpha > 20 && luminance < 150) {
          raster[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7)
        }
      }
    }

    return rasterImage(width, height, raster)
  } catch {
    return null
  }
}

export async function buildEscPosBytes(receipt: EscPosReceipt): Promise<Uint8Array> {
  const buf: number[] = []

  buf.push(...cmd(INIT)) // ESC @ — initialize
  buf.push(...align(ALIGN.center))
  if (receipt.logoUrl) {
    const logo = await loadLogoRaster(receipt.logoUrl)
    if (logo) {
      buf.push(...logo)
      buf.push(...feed(1))
    }
  }
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
