export type UnitKind = "MASS" | "VOLUME" | "COUNT" | "CUSTOM"

export type UnitConfig = {
  unit: string
  unitKind: UnitKind
  baseUnit: string
  factor: number
  compatibleUnits: string[]
}

export type CustomUnitConversion = {
  unit: string
  factor: number
}

const UNIT_ALIASES: Record<string, string> = {
  kilogram: "kg",
  kilos: "kg",
  kilo: "kg",
  kg: "kg",
  gram: "g",
  grams: "g",
  gr: "g",
  g: "g",
  liter: "l",
  litre: "l",
  liters: "l",
  ltr: "l",
  lt: "l",
  l: "l",
  mililiter: "ml",
  milliliter: "ml",
  millilitre: "ml",
  mililitre: "ml",
  ml: "ml",
}

const CONVERTIBLE_UNITS: Record<string, UnitConfig> = {
  kg: { unit: "kg", unitKind: "MASS", baseUnit: "g", factor: 1000, compatibleUnits: ["kg", "g"] },
  g: { unit: "g", unitKind: "MASS", baseUnit: "g", factor: 1, compatibleUnits: ["g", "kg"] },
  l: { unit: "l", unitKind: "VOLUME", baseUnit: "ml", factor: 1000, compatibleUnits: ["l", "ml"] },
  ml: { unit: "ml", unitKind: "VOLUME", baseUnit: "ml", factor: 1, compatibleUnits: ["ml", "l"] },
}

const COUNT_UNITS = new Set(["buah", "butir", "pcs", "pc", "piece", "pieces"])

export function normalizeUnit(unit: string) {
  const normalized = unit.trim().toLowerCase()
  return UNIT_ALIASES[normalized] ?? normalized
}

export function buildCustomUnitConfigs(
  baseUnit: string,
  unitKind: UnitKind,
  conversions: CustomUnitConversion[]
): Record<string, UnitConfig> {
  const allUnits = [baseUnit, ...conversions.map((c) => c.unit)]
  const configs: Record<string, UnitConfig> = {}

  for (const unit of allUnits) {
    const custom = conversions.find((c) => c.unit === unit)
    configs[unit] = {
      unit,
      unitKind,
      baseUnit,
      factor: unit === baseUnit ? 1 : custom!.factor,
      compatibleUnits: allUnits,
    }
  }

  return configs
}

export function getUnitConfig(unit: string, customUnitConfigs?: Record<string, UnitConfig>): UnitConfig {
  const normalizedUnit = normalizeUnit(unit)
  const convertible = CONVERTIBLE_UNITS[normalizedUnit]
  if (convertible) return convertible

  if (customUnitConfigs) {
    const custom = customUnitConfigs[normalizedUnit]
    if (custom) return custom
  }

  return {
    unit: normalizedUnit,
    unitKind: COUNT_UNITS.has(normalizedUnit) ? "COUNT" : "CUSTOM",
    baseUnit: normalizedUnit,
    factor: 1,
    compatibleUnits: [normalizedUnit],
  }
}

export function getCompatibleUnits(unit: string, customUnitConfigs?: Record<string, UnitConfig>) {
  return getUnitConfig(unit, customUnitConfigs).compatibleUnits
}

export function getNextCompatibleUnit(currentUnit: string, baseDisplayUnit: string, customUnitConfigs?: Record<string, UnitConfig>) {
  const units = getCompatibleUnits(baseDisplayUnit, customUnitConfigs)
  if (units.length <= 1) return currentUnit

  const normalizedCurrent = normalizeUnit(currentUnit)
  const currentIndex = units.indexOf(normalizedCurrent)
  if (currentIndex === -1) return units[0]
  return units[(currentIndex + 1) % units.length]
}

export function canCycleUnit(unit: string, customUnitConfigs?: Record<string, UnitConfig>) {
  return getCompatibleUnits(unit, customUnitConfigs).length > 1
}

export function toBaseQty(qty: string | number, unit: string, customUnitConfigs?: Record<string, UnitConfig>) {
  const value = Number(qty)
  if (!Number.isFinite(value)) return 0

  return value * getUnitConfig(unit, customUnitConfigs).factor
}

export function fromBaseQty(qty: string | number, unit: string, customUnitConfigs?: Record<string, UnitConfig>) {
  const value = Number(qty)
  if (!Number.isFinite(value)) return 0

  return value / getUnitConfig(unit, customUnitConfigs).factor
}

export function toBaseUnitPrice(unitPrice: string | number, unit: string, customUnitConfigs?: Record<string, UnitConfig>) {
  const value = Number(unitPrice)
  if (!Number.isFinite(value)) return 0

  return value / getUnitConfig(unit, customUnitConfigs).factor
}

export function fromBaseUnitPrice(unitPrice: string | number, unit: string, customUnitConfigs?: Record<string, UnitConfig>) {
  const value = Number(unitPrice)
  if (!Number.isFinite(value)) return 0

  return value * getUnitConfig(unit, customUnitConfigs).factor
}

export function formatQty(value: string | number) {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 3 })
}

export function getDisplayQty(baseQty: string | number, preferredUnit: string, customUnitConfigs?: Record<string, UnitConfig>) {
  const preferred = getUnitConfig(preferredUnit, customUnitConfigs)
  const preferredQty = fromBaseQty(baseQty, preferred.unit, customUnitConfigs)

  if (preferredQty > 0 && preferredQty < 1 && preferred.factor > 1) {
    return {
      qty: fromBaseQty(baseQty, preferred.baseUnit, customUnitConfigs).toString(),
      unit: preferred.baseUnit,
    }
  }

  return {
    qty: preferredQty.toString(),
    unit: preferred.unit,
  }
}
