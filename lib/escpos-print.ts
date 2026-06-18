const ESC = 0x1b
const GS = 0x1d

const INIT = 0x40 // ESC @

const ALIGN = { left: 0x00, center: 0x01, right: 0x02 }

const BOLD_ON = 0x01
const BOLD_OFF = 0x00

const CUT_FULL = 0x41 // GS V m (m=65='A' full cut)
const LOGO_MAX_WIDTH = 192
const LOGO_MAX_HEIGHT = 96
const ESC_STAR_24_DOT_DOUBLE_DENSITY = 33
const LOGO_CACHE_PREFIX = "pmk.escposLogo.v1:"

const logoCache = new Map<string, number[]>()

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

function getLogoUrl(url: string): string {
  if (url.startsWith("toko/")) {
    return `/api/toko-image?pathname=${encodeURIComponent(url)}`
  }

  if (url.includes(".blob.vercel-storage.com/")) {
    return `/api/toko-image?url=${encodeURIComponent(url)}`
  }

  return url
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = window.setTimeout(() => reject(new Error("Logo load timeout")), 1500)

    image.crossOrigin = "anonymous"
    image.onload = () => {
      window.clearTimeout(timeout)
      resolve(image)
    }
    image.onerror = () => {
      window.clearTimeout(timeout)
      reject(new Error("Logo load failed"))
    }
    image.src = getLogoUrl(url)
  })
}

function logoCacheKey(url: string): string {
  return LOGO_CACHE_PREFIX + encodeURIComponent(url)
}

function bytesToBase64(bytes: number[]): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function base64ToBytes(value: string): number[] {
  const binary = window.atob(value)
  const bytes = new Array<number>(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function getCachedLogo(url: string): number[] | null {
  const memoryLogo = logoCache.get(url)
  if (memoryLogo) return memoryLogo
  if (typeof window === "undefined") return null

  try {
    const stored = window.localStorage.getItem(logoCacheKey(url))
    if (!stored) return null
    const bytes = base64ToBytes(stored)
    logoCache.set(url, bytes)
    return bytes
  } catch {
    window.localStorage.removeItem(logoCacheKey(url))
    return null
  }
}

function setCachedLogo(url: string, bytes: number[]) {
  logoCache.set(url, bytes)
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(logoCacheKey(url), bytesToBase64(bytes))
  } catch {
    // Memory cache is enough if persistent storage is full or unavailable.
  }
}

async function buildLogoBytes(url: string): Promise<number[] | null> {
  if (typeof window === "undefined") return null

  const cached = getCachedLogo(url)
  if (cached) return cached

  try {
    const image = await loadImage(url)
    const scale = Math.min(1, LOGO_MAX_WIDTH / image.naturalWidth, LOGO_MAX_HEIGHT / image.naturalHeight)
    const width = Math.max(8, Math.floor((image.naturalWidth * scale) / 8) * 8)
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
    const out: number[] = []

    for (let stripeTop = 0; stripeTop < height; stripeTop += 24) {
      out.push(ESC, 0x2a, ESC_STAR_24_DOT_DOUBLE_DENSITY, width & 0xff, (width >> 8) & 0xff)

      for (let x = 0; x < width; x++) {
        for (let byteIndex = 0; byteIndex < 3; byteIndex++) {
          let value = 0
          for (let bit = 0; bit < 8; bit++) {
            const y = stripeTop + byteIndex * 8 + bit
            if (y >= height) continue

            const index = (y * width + x) * 4
            const alpha = pixels[index + 3]
            const luminance = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114
            if (alpha > 20 && luminance < 160) {
              value |= 0x80 >> bit
            }
          }
          out.push(value)
        }
      }

      out.push(0x0a)
    }

    setCachedLogo(url, out)
    return out
  } catch {
    return null
  }
}

export async function buildEscPosBytes(receipt: EscPosReceipt): Promise<Uint8Array> {
  const buf: number[] = []

  buf.push(...cmd(INIT)) // ESC @ — initialize
  buf.push(...align(ALIGN.center))
  if (receipt.logoUrl) {
    const logo = await buildLogoBytes(receipt.logoUrl)
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
