"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { Trash2, Palette, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useToko } from "@/components/providers/toko-provider"
import { useTokoImage } from "@/hooks/use-toko-image"
import {
  LOCAL_THEMES_KEY,
  SELECTED_LOCAL_THEME_KEY,
  LOCAL_THEME_CHANGED_EVENT,
  getLocalThemes,
  saveLocalTheme,
  type LocalTheme,
} from "./local-theme-style"
import { generateThemeFromSwatches, parseThemeColors } from "@/lib/theme-palettes"
import { getPalette } from "colorthief"

function subscribeLocalThemes(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(LOCAL_THEME_CHANGED_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(LOCAL_THEME_CHANGED_EVENT, onStoreChange)
  }
}

function getLocalThemesSnapshot() {
  return window.localStorage.getItem(LOCAL_THEMES_KEY) ?? "[]"
}

function getSelectedLocalThemeSnapshot() {
  return window.localStorage.getItem(SELECTED_LOCAL_THEME_KEY) ?? ""
}

function getEmptySnapshot() {
  return "[]"
}

function getEmptySelectedSnapshot() {
  return ""
}

function parseLocalThemesSnapshot(snapshot: string): LocalTheme[] {
  try {
    const parsed = JSON.parse(snapshot)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function ThemeSettings() {
  const themesSnapshot = useSyncExternalStore(subscribeLocalThemes, getLocalThemesSnapshot, getEmptySnapshot)
  const selectedThemeSnapshot = useSyncExternalStore(subscribeLocalThemes, getSelectedLocalThemeSnapshot, getEmptySelectedSnapshot)
  const themes = parseLocalThemesSnapshot(themesSnapshot)
  const selectedThemeId = selectedThemeSnapshot || null
  const [message, setMessage] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toko } = useToko()
  const imageUrl = useTokoImage(toko?.imageUrl ?? null)

  async function extractThemeFromImage() {
    if (!imageUrl) return
    setExtracting(true)
    setMessage("")

    try {
      const image = new window.Image()
      image.crossOrigin = "anonymous"
      image.src = imageUrl
      await image.decode()

      const palette = await getPalette(image, { colorCount: 6 })
      if (!palette || palette.length === 0) {
        setMessage("Gagal mengekstrak warna dari gambar.")
        return
      }

      const swatches = palette.map((c) => c.hex())
      const theme = generateThemeFromSwatches(swatches)
      if (!theme) {
        setMessage("Gagal menghasilkan tema dari gambar.")
        return
      }

      saveLocalTheme({
        id: crypto.randomUUID(),
        name: `Tema ${toko?.name || "Toko"} ${new Date().toLocaleDateString("id-ID")}`,
        colors: theme,
        createdAt: new Date().toISOString(),
      })

      setMessage("Tema berhasil dibuat dan diterapkan.")
    } catch {
      setMessage("Gagal memproses gambar.")
    } finally {
      setExtracting(false)
    }
  }

  function handleThemeChange(value: string) {
    startTransition(() => {
      if (value === "default") {
        window.localStorage.removeItem(SELECTED_LOCAL_THEME_KEY)
      } else {
        window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, value)
      }
      window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT))
      setMessage("Tema berhasil diterapkan.")
    })
  }

  function handleDeleteTheme(themeId: string) {
    startTransition(() => {
      const nextThemes = getLocalThemes().filter((theme) => theme.id !== themeId)
      window.localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(nextThemes))
      if (selectedThemeId === themeId) {
        window.localStorage.removeItem(SELECTED_LOCAL_THEME_KEY)
      }
      window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT))
      setMessage("Tema dihapus.")
    })
  }

  return (
    <div className="space-y-3">
      {imageUrl && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={extractThemeFromImage}
          disabled={extracting}
        >
          {extracting ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : (
            <Palette className="size-4" />
          )}
          {extracting ? "Mengekstrak warna..." : `Buat tema dari logo toko`}
        </Button>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleThemeChange("default")}
          className={cn(
            "rounded-lg border p-3 text-left transition-colors hover:bg-accent/60",
            !selectedThemeId && "border-primary bg-primary/5"
          )}
          disabled={isPending}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">Tema bawaan</p>
            {!selectedThemeId && <span className="text-xs text-primary">Aktif</span>}
          </div>
          <div className="flex overflow-hidden rounded-md border">
            <span className="h-8 flex-1 bg-[#ffffff]" />
            <span className="h-8 flex-1 bg-[#f4f4f5]" />
            <span className="h-8 flex-1 bg-[#18181b]" />
            <span className="h-8 flex-1 bg-[#e4e4e7]" />
          </div>
        </button>

        {themes.map((theme) => {
          const colors = parseThemeColors(theme.colors)
          return (
            <div
              key={theme.id}
              className={cn(
                "rounded-lg border p-3 transition-colors hover:bg-accent/60",
                selectedThemeId === theme.id && "border-primary bg-primary/5"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange(theme.id)}
                  className="min-w-0 flex-1 text-left"
                  disabled={isPending}
                >
                  <p className="truncate text-sm font-medium">{theme.name}</p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {selectedThemeId === theme.id && (
                    <span className="text-xs text-primary">Aktif</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteTheme(theme.id)}
                    disabled={isPending}
                    title="Hapus tema"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleThemeChange(theme.id)}
                className="flex w-full overflow-hidden rounded-md border"
                disabled={isPending}
              >
                {(colors?.swatches ?? []).map((swatch, i) => (
                  <span key={i} className="h-8 flex-1" style={{ backgroundColor: swatch }} />
                ))}
              </button>
            </div>
          )
        })}
      </div>

      {themes.length === 0 && !imageUrl && (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Belum ada tema tersimpan. Tambahkan logo toko untuk membuat tema dari palet warnanya.
        </p>
      )}

      {message && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  )
}


