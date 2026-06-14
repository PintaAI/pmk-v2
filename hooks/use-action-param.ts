"use client"

import { useCallback } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { ActionType } from "@/components/providers/plus-action-context"

const validActionTypes = new Set<ActionType>([
  "quick-actions",
  "create-product",
  "create-production",
  "create-belanja",
  "create-bahan",
  "create-pesanan",
  "open-cart",
  "edit-product",
  "edit-bahan",
])

function getActionType(value: string | null): ActionType | null {
  if (!value || !validActionTypes.has(value as ActionType)) return null
  return value as ActionType
}

function buildUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function useActionParam() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const actionType = getActionType(searchParams.get("action"))

  const openAction = useCallback((type: ActionType) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("action", type)
    window.history.pushState(null, "", buildUrl(pathname, params))
  }, [pathname, searchParams])

  const closeAction = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("action")
    window.history.replaceState(null, "", buildUrl(pathname, params))
  }, [pathname, searchParams])

  return { actionType, openAction, closeAction }
}
