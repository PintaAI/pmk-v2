"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { getCurrentTokoAction } from "@/app/actions/toko-actions"
import type { OperationalMode } from "@/generated/prisma/client"

type TokoData = {
  id: string
  name: string
  imageUrl: string | null
  receiptLogoUrl: string | null
  address: string | null
  phone: string | null
  operationalMode: OperationalMode
}

type TokoContextValue = {
  toko: TokoData | null
  isLoading: boolean
  refresh: () => void
}

const TokoContext = createContext<TokoContextValue | undefined>(undefined)

export function TokoProvider({ children }: { children: ReactNode }) {
  const [toko, setToko] = useState<TokoData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchToko = useCallback(() => {
    return getCurrentTokoAction().then((result) => {
      if (result.success) {
        setToko(result.data)
      }
      return result
    })
  }, [])

  useEffect(() => {
    getCurrentTokoAction().then((result) => {
      if (result.success) {
        setToko(result.data)
      }
    }).finally(() => setIsLoading(false))
  }, [])

  const refresh = useCallback(() => {
    setIsLoading(true)
    fetchToko().finally(() => setIsLoading(false))
  }, [fetchToko])

  return (
    <TokoContext.Provider value={{ toko, isLoading, refresh }}>
      {children}
    </TokoContext.Provider>
  )
}

export function useToko() {
  const context = useContext(TokoContext)

  if (!context) {
    throw new Error("useToko must be used within TokoProvider")
  }

  return context
}
