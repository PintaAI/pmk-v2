"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type ActionType = "quick-actions" | "create-product" | "create-production" | "create-belanja" | "create-bahan" | "create-pesanan" | "open-cart" | "edit-product" | "edit-bahan"

type PlusActionContextType = {
  cartCount: number
  setCartCount: (count: number) => void
}

const PlusActionContext = createContext<PlusActionContextType | null>(null)

export function PlusActionProvider({ children }: { children: ReactNode }) {
  const [cartCount, setCartCount] = useState(0)

  return (
    <PlusActionContext.Provider
      value={{
        cartCount,
        setCartCount,
      }}
    >
      {children}
    </PlusActionContext.Provider>
  )
}

export function usePlusAction() {
  const context = useContext(PlusActionContext)
  if (!context) {
    throw new Error("usePlusAction must be used within a PlusActionProvider")
  }
  return context
}
