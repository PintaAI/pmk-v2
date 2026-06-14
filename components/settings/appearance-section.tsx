"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  FONT_OPTIONS,
  FONT_FAMILY_KEY,
  FONT_SIZE_KEY,
  FONT_SPACING_KEY,
  FONT_CHANGED_EVENT,
  applyFontPreferences,
} from "./font-style"

function getSavedFontPreference(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const saved = localStorage.getItem(key)
  return saved ?? fallback
}

function saveAndNotify(key: string, value: string) {
  localStorage.setItem(key, value)
  applyFontPreferences()
  window.dispatchEvent(new Event(FONT_CHANGED_EVENT))
}

function pxToSlider(px: string): number {
  return parseFloat(px)
}

function sliderToPx(v: number): string {
  return `${v}px`
}

function spacingToSlider(sp: string): number {
  return parseFloat(sp) * 100
}

function sliderToSpacing(v: number): string {
  return `${(v / 100).toFixed(2)}em`
}

export function AppearanceSettings() {
  const [fontFamily, setFontFamily] = useState(
    () => getSavedFontPreference(FONT_FAMILY_KEY, "jetbrains-mono")
  )
  const [fontSize, setFontSize] = useState(
    () => pxToSlider(getSavedFontPreference(FONT_SIZE_KEY, "16"))
  )
  const [fontSpacing, setFontSpacing] = useState(
    () => spacingToSlider(getSavedFontPreference(FONT_SPACING_KEY, "-0.02"))
  )

  function handleFontFamilyChange(value: string | null) {
    if (!value) return
    setFontFamily(value)
    saveAndNotify(FONT_FAMILY_KEY, value)
  }

  function handleFontSizeChange(value: number | readonly number[]) {
    const v = Array.isArray(value) ? value[0] : (value ?? 16)
    setFontSize(v)
    saveAndNotify(FONT_SIZE_KEY, sliderToPx(v))
  }

  function handleFontSpacingChange(value: number | readonly number[]) {
    const v = Array.isArray(value) ? value[0] : (value ?? 0)
    setFontSpacing(v)
    saveAndNotify(FONT_SPACING_KEY, sliderToSpacing(v))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Font</span>
        <Select value={fontFamily} onValueChange={handleFontFamilyChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} style={{ fontFamily: opt.family }}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Ukuran Font</span>
          <span className="text-xs text-muted-foreground tabular-nums">{fontSize}px</span>
        </div>
        <Slider
          value={[fontSize]}
          onValueChange={handleFontSizeChange}
          min={12}
          max={24}
          step={1}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Spasi Font</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {(fontSpacing / 100).toFixed(2)}em
          </span>
        </div>
        <Slider
          value={[fontSpacing]}
          onValueChange={handleFontSpacingChange}
          min={-6}
          max={6}
          step={1}
        />
      </div>
    </div>
  )
}
