"use client"

import * as React from "react"

import { validateQRIS } from "@/lib/qris"

const QRIS_STORAGE_KEY = "pmk.qris"

export function useQris() {
  const staticQRIS = React.useSyncExternalStore(subscribeQrisStorage, getStoredQris, () => null)

  const setStaticQRIS = React.useCallback((payload: string) => {
    window.localStorage.setItem(QRIS_STORAGE_KEY, payload)
    window.dispatchEvent(new Event(QRIS_STORAGE_KEY))
  }, [])

  const clearQRIS = React.useCallback(() => {
    window.localStorage.removeItem(QRIS_STORAGE_KEY)
    window.dispatchEvent(new Event(QRIS_STORAGE_KEY))
  }, [])

  const validation = staticQRIS ? validateQRIS(staticQRIS) : null

  return {
    staticQRIS,
    hasQRIS: Boolean(staticQRIS),
    setStaticQRIS,
    clearQRIS,
    merchantName: validation?.data?.merchantName ?? null,
    merchantCity: validation?.data?.merchantCity ?? null,
  }
}

function subscribeQrisStorage(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(QRIS_STORAGE_KEY, callback)

  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(QRIS_STORAGE_KEY, callback)
  }
}

function getStoredQris() {
  const stored = window.localStorage.getItem(QRIS_STORAGE_KEY)
  if (!stored) return null

  // Trust the stored value - it was validated before saving
  return stored
}
