"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createPortal } from "react-dom"

type FlyingItem = {
  id: string
  srcRect: DOMRect
}

type FlyToCartContextType = {
  flyToCart: (sourceElement: HTMLElement) => void
}

const FlyToCartContext = React.createContext<FlyToCartContextType | null>(null)

export function useFlyToCart() {
  const ctx = React.useContext(FlyToCartContext)
  if (!ctx) throw new Error("useFlyToCart must be used within FlyToCartProvider")
  return ctx
}

export function FlyToCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<FlyingItem[]>([])
  const [mounted] = React.useState(() => typeof document !== "undefined")

  const flyToCart = React.useCallback((sourceElement: HTMLElement) => {
    const srcRect = sourceElement.getBoundingClientRect()
    const id = Math.random().toString(36).slice(2)
    setItems((prev) => [...prev, { id, srcRect }])
  }, [])

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <FlyToCartContext.Provider value={{ flyToCart }}>
      {children}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {items.map((item) => (
              <FlyToCartItem
                key={item.id}
                srcRect={item.srcRect}
                onComplete={() => removeItem(item.id)}
              />
            ))}
          </AnimatePresence>,
          document.body
        )}
    </FlyToCartContext.Provider>
  )
}

function getCartTarget(): DOMRect | null {
  const el = document.querySelector<HTMLElement>("[data-cart-target]")
  if (!el) return null
  return el.getBoundingClientRect()
}

function FlyToCartItem({
  srcRect,
  onComplete,
}: {
  srcRect: DOMRect
  onComplete: () => void
}) {
  const cartRect = getCartTarget()
  if (!cartRect) return null

  const originX = srcRect.left + srcRect.width / 2 - 20
  const originY = srcRect.top + srcRect.height / 2 - 20
  const targetX = cartRect.left + cartRect.width / 2 - 10
  const targetY = cartRect.top + cartRect.height / 2 - 10

  return (
    <motion.div
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: originX,
        top: originY,
        width: 40,
        height: 40,
      }}
      animate={{
        left: targetX,
        top: targetY,
        width: 20,
        height: 20,
        opacity: [1, 1, 0.3],
        scale: [1, 1.3, 0.5],
      }}
      transition={{
        duration: 0.55,
        ease: [0.34, 1.56, 0.64, 1],
        times: [0, 0.4, 1],
      }}
      onAnimationComplete={onComplete}
    >
      <div className="size-full rounded-full bg-foreground shadow-lg" />
    </motion.div>
  )
}
