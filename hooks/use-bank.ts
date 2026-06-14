"use client"

import * as React from "react"

export type BankInfo = {
  bankName: string
  accountNumber: string
  accountHolder: string
}

const BANK_STORAGE_KEY = "pmk.bank"

export function useBank() {
  const bankInfo = React.useSyncExternalStore(subscribeBankStorage, getStoredBank, () => null)

  const setBankInfo = React.useCallback((info: BankInfo) => {
    window.localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(info))
    window.dispatchEvent(new Event(BANK_STORAGE_KEY))
  }, [])

  const clearBankInfo = React.useCallback(() => {
    window.localStorage.removeItem(BANK_STORAGE_KEY)
    window.dispatchEvent(new Event(BANK_STORAGE_KEY))
  }, [])

  return {
    bankInfo,
    hasBankInfo: Boolean(bankInfo),
    setBankInfo,
    clearBankInfo,
  }
}

function subscribeBankStorage(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(BANK_STORAGE_KEY, callback)

  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(BANK_STORAGE_KEY, callback)
  }
}

let cachedBankInfo: BankInfo | null = null
let cachedStored = ""

function getStoredBank(): BankInfo | null {
  const stored = window.localStorage.getItem(BANK_STORAGE_KEY) ?? ""
  if (stored === cachedStored) return cachedBankInfo

  cachedStored = stored

  if (!stored) {
    cachedBankInfo = null
    return null
  }

  try {
    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed === "object" && parsed.bankName && parsed.accountNumber && parsed.accountHolder) {
      cachedBankInfo = parsed as BankInfo
      return cachedBankInfo
    }
    cachedBankInfo = null
    return null
  } catch {
    cachedBankInfo = null
    return null
  }
}
