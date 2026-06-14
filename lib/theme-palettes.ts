type Rgb = { r: number; g: number; b: number }
type Hsl = { h: number; s: number; l: number }
type ThemeModeColors = Record<string, string>

export type GeneratedThemeColors = {
  light: ThemeModeColors
  dark: ThemeModeColors
  swatches: string[]
}

export const CSS_VARIABLE_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const

const CSS_VARIABLES = new Set<string>(CSS_VARIABLE_NAMES)

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255
  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  const delta = max - min
  const l = (max + min) / 2

  if (delta === 0) return { h: 0, s: 0, l }

  const s = delta / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r1) h = 60 * (((g1 - b1) / delta) % 6)
  if (max === g1) h = 60 * ((b1 - r1) / delta + 2)
  if (max === b1) h = 60 * ((r1 - g1) / delta + 4)
  if (h < 0) h += 360

  return { h, s, l }
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${Math.round(h)} ${Math.round(clamp(s, 0, 1) * 100)}% ${Math.round(clamp(l, 0, 1) * 100)}%)`
}

function parseHexColor(color: string): Rgb | null {
  const normalized = color.trim()
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  if (!match) return null
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  }
}

function pickColor(colors: Rgb[], index: number, fallbackHue: number): Hsl {
  const color = colors[index] ?? colors[0]
  if (!color) return { h: fallbackHue, s: 0.65, l: 0.52 }

  const parsed = rgbToHsl(color)
  if (parsed.s < 0.15) return { h: fallbackHue, s: 0.65, l: 0.52 }

  return {
    h: parsed.h,
    s: clamp(parsed.s, 0.45, 0.82),
    l: clamp(parsed.l, 0.42, 0.62),
  }
}

function buildVariables(primary: Hsl, secondary: Hsl, accent: Hsl): GeneratedThemeColors {
  const pSat = Math.max(primary.s, 0.62)
  const sSat = Math.max(secondary.s, 0.50)
  const aSat = Math.max(accent.s, 0.52)

  const light = {
    background: hsl(primary.h, 0.16, 0.96),
    foreground: hsl(primary.h, 0.34, 0.12),
    card: hsl(primary.h, 0.18, 1),
    "card-foreground": hsl(primary.h, 0.34, 0.12),
    popover: hsl(primary.h, 0.18, 1),
    "popover-foreground": hsl(primary.h, 0.34, 0.12),
    primary: hsl(primary.h, pSat, 0.50),
    "primary-foreground": hsl(primary.h, 0.10, 0.98),
    secondary: hsl(secondary.h, sSat, 0.76),
    "secondary-foreground": hsl(secondary.h, 0.40, 0.16),
    muted: hsl(primary.h, 0.18, 0.92),
    "muted-foreground": hsl(primary.h, 0.14, 0.40),
    accent: hsl(accent.h, aSat, 0.82),
    "accent-foreground": hsl(accent.h, 0.52, 0.22),
    destructive: "hsl(0 72% 51%)",
    border: hsl(primary.h, 0.18, 0.85),
    input: hsl(primary.h, 0.18, 0.85),
    ring: hsl(primary.h, pSat, 0.50),
    "chart-1": hsl(primary.h, pSat, 0.56),
    "chart-2": hsl(secondary.h, sSat, 0.56),
    "chart-3": hsl(accent.h, aSat, 0.56),
    "chart-4": hsl((primary.h + 42) % 360, pSat, 0.60),
    "chart-5": hsl((secondary.h + 64) % 360, sSat, 0.54),
    sidebar: hsl(primary.h, 0.06, 0.97),
    "sidebar-foreground": hsl(primary.h, 0.34, 0.16),
    "sidebar-primary": hsl(primary.h, pSat, 0.50),
    "sidebar-primary-foreground": hsl(primary.h, 0.10, 0.98),
    "sidebar-accent": hsl(primary.h, 0.10, 0.91),
    "sidebar-accent-foreground": hsl(primary.h, 0.34, 0.16),
    "sidebar-border": hsl(primary.h, 0.10, 0.85),
    "sidebar-ring": hsl(primary.h, pSat, 0.50),
  }

  const dark = {
    background: hsl(primary.h, 0.22, 0.035),
    foreground: hsl(primary.h, 0.14, 0.96),
    card: hsl(primary.h, 0.22, 0.06),
    "card-foreground": hsl(primary.h, 0.14, 0.96),
    popover: hsl(primary.h, 0.22, 0.06),
    "popover-foreground": hsl(primary.h, 0.14, 0.96),
    primary: hsl(primary.h, primary.s, 0.46),
    "primary-foreground": hsl(primary.h, 0.2, 0.035),
    secondary: hsl(secondary.h, secondary.s, 0.18),
    "secondary-foreground": hsl(secondary.h, 0.18, 0.9),
    muted: hsl(primary.h, 0.16, 0.095),
    "muted-foreground": hsl(primary.h, 0.09, 0.58),
    accent: hsl(accent.h, accent.s, 0.13),
    "accent-foreground": hsl(accent.h, 0.24, 0.94),
    destructive: "hsl(0 62% 36%)",
    border: hsl(primary.h, 0.14, 0.115),
    input: hsl(primary.h, 0.14, 0.115),
    ring: hsl(primary.h, primary.s, 0.44),
    "chart-1": hsl(primary.h, primary.s, 0.46),
    "chart-2": hsl(secondary.h, secondary.s, 0.4),
    "chart-3": hsl(accent.h, accent.s, 0.42),
    "chart-4": hsl((primary.h + 42) % 360, primary.s, 0.38),
    "chart-5": hsl((secondary.h + 64) % 360, secondary.s, 0.36),
    sidebar: hsl(primary.h, 0.24, 0.028),
    "sidebar-foreground": hsl(primary.h, 0.14, 0.96),
    "sidebar-primary": hsl(primary.h, primary.s, 0.46),
    "sidebar-primary-foreground": hsl(primary.h, 0.24, 0.028),
    "sidebar-accent": hsl(primary.h, 0.18, 0.075),
    "sidebar-accent-foreground": hsl(primary.h, 0.14, 0.96),
    "sidebar-border": hsl(primary.h, 0.18, 0.075),
    "sidebar-ring": hsl(primary.h, primary.s, 0.44),
  }

  return { light, dark, swatches: [] }
}

export function generateThemeFromSwatches(swatches: string[]): GeneratedThemeColors | null {
  const colors = swatches.flatMap((swatch) => {
    const color = parseHexColor(swatch)
    if (!color) return []

    const hslColor = rgbToHsl(color)
    if (hslColor.l < 0.05 || hslColor.l > 0.96) return []
    return [color]
  })

  if (colors.length === 0) return null

  const primary = pickColor(colors, 0, 210)
  const secondary = pickColor(colors, 1, (primary.h + 62) % 360)
  const accent = pickColor(colors, 2, (primary.h + 156) % 360)
  const theme = buildVariables(primary, secondary, accent)
  theme.swatches = colors.slice(0, 6).map((c) => `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`)

  return theme
}

export function parseThemeColors(value: unknown): GeneratedThemeColors | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const parsed = value as Record<string, unknown>
  if (!parsed.light || !parsed.dark || typeof parsed.light !== "object" || typeof parsed.dark !== "object") return null

  const cleanMode = (mode: unknown): ThemeModeColors => {
    if (!mode || typeof mode !== "object" || Array.isArray(mode)) return {}
    return Object.fromEntries(
      Object.entries(mode as Record<string, unknown>).filter(
        ([key, cssValue]) => CSS_VARIABLES.has(key) && typeof cssValue === "string" && /^[#(),.%\w\s-]+$/.test(cssValue)
      )
    ) as ThemeModeColors
  }

  const swatches = Array.isArray(parsed.swatches) ? parsed.swatches.filter((item): item is string => typeof item === "string") : []

  return {
    light: cleanMode(parsed.light),
    dark: cleanMode(parsed.dark),
    swatches,
  }
}

export function themeToCss(colors: GeneratedThemeColors): string {
  const serialize = (mode: ThemeModeColors) =>
    Object.entries(mode).map(([key, value]) => `--${key}: ${value};`).join("\n")
  return `:root {\n${serialize(colors.light)}\n}\n.dark {\n${serialize(colors.dark)}\n}`
}
