"use client"

import { useEffect } from "react"

export const FONT_FAMILY_KEY = "pmk.fontFamily"
export const FONT_SIZE_KEY = "pmk.fontSize"
export const FONT_SPACING_KEY = "pmk.fontSpacing"
export const FONT_CHANGED_EVENT = "pmk-font-changed"

export const FONT_OPTIONS = [
  { value: "jetbrains-mono", label: "JetBrains Mono", family: "'JetBrains Mono', monospace" },
  { value: "inter", label: "Inter", family: "'Inter', sans-serif" },
  { value: "roboto", label: "Roboto", family: "'Roboto', sans-serif" },
  { value: "poppins", label: "Poppins", family: "'Poppins', sans-serif" },
  { value: "lora", label: "Lora", family: "'Lora', serif" },
] as const

const FONT_FAMILY_MAP: Record<string, string> = {
  "jetbrains-mono": "'JetBrains Mono', monospace",
  "inter": "'Inter', sans-serif",
  "roboto": "'Roboto', sans-serif",
  "poppins": "'Poppins', sans-serif",
  "lora": "'Lora', serif",
}

export function applyFontPreferences() {
  if (typeof window === "undefined") return

  const fontFamily = localStorage.getItem(FONT_FAMILY_KEY)
  const fontSize = localStorage.getItem(FONT_SIZE_KEY)
  const fontSpacing = localStorage.getItem(FONT_SPACING_KEY)

  const html = document.documentElement
  const body = document.body

  if (fontFamily && FONT_FAMILY_MAP[fontFamily]) {
    html.style.setProperty("--font-body", FONT_FAMILY_MAP[fontFamily])
  } else {
    html.style.removeProperty("--font-body")
  }

  if (fontSize) {
    html.style.setProperty("--font-size-root", fontSize)
  } else {
    html.style.removeProperty("--font-size-root")
  }

  if (fontSpacing) {
    body.style.setProperty("--tracking-body", fontSpacing)
  } else {
    body.style.removeProperty("--tracking-body")
  }
}

export function FontStyle() {
  useEffect(() => {
    applyFontPreferences()

    window.addEventListener("storage", applyFontPreferences)
    window.addEventListener(FONT_CHANGED_EVENT, applyFontPreferences)

    return () => {
      window.removeEventListener("storage", applyFontPreferences)
      window.removeEventListener(FONT_CHANGED_EVENT, applyFontPreferences)
    }
  }, [])

  return null
}
