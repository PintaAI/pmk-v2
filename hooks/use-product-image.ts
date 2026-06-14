import { useEffect, useRef, useState } from "react"
import { getImageBlob } from "@/lib/idb-image"

const IDB_PREFIX = "idb:"

function isIdbKey(value: string): boolean {
  return value.startsWith(IDB_PREFIX)
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:")
}

function isBlobStorageUrl(value: string): boolean {
  return value.includes(".blob.vercel-storage.com/")
}

function isCloudUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

function stripIdbPrefix(value: string): string {
  return value.slice(IDB_PREFIX.length)
}

function blobImageProxyUrl(imageUrl: string): string {
  return `/api/product-image?url=${encodeURIComponent(imageUrl)}`
}

export function useProductImage(imageUrl: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  const syncResult = (() => {
    if (!imageUrl) return null
    if (isBlobStorageUrl(imageUrl)) return blobImageProxyUrl(imageUrl)
    if (isDataUrl(imageUrl)) return imageUrl
    if (isCloudUrl(imageUrl)) return imageUrl
    return undefined
  })()

  useEffect(() => {
    if (!imageUrl || isDataUrl(imageUrl) || isCloudUrl(imageUrl) || isBlobStorageUrl(imageUrl)) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
      return
    }

    const key = isIdbKey(imageUrl) ? stripIdbPrefix(imageUrl) : imageUrl
    let cancelled = false

    getImageBlob(key).then((blob) => {
      if (cancelled) return
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
      }
      if (blob) {
        urlRef.current = URL.createObjectURL(blob)
        setBlobUrl(urlRef.current)
      } else {
        urlRef.current = null
        setBlobUrl(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [imageUrl])

  return syncResult !== undefined ? syncResult : blobUrl
}
