import { useEffect, useRef, useState } from "react"
import { getImageBlob } from "@/lib/idb-image"

const IDB_PREFIX = "idb:"

function isIdbKey(value: string): boolean {
  return value.startsWith(IDB_PREFIX)
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:")
}

function isBlobUrl(value: string): boolean {
  return value.startsWith("toko/") || value.includes(".blob.vercel-storage.com/")
}

function isCloudUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

function stripIdbPrefix(value: string): string {
  return value.slice(IDB_PREFIX.length)
}

function blobImageProxyUrl(imageUrl: string): string {
  if (imageUrl.startsWith("toko/")) {
    return `/api/toko-image?pathname=${encodeURIComponent(imageUrl)}`
  }
  return `/api/toko-image?url=${encodeURIComponent(imageUrl)}`
}

export function useTokoImage(imageUrl: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  const syncResult = (() => {
    if (!imageUrl) return null
    if (isBlobUrl(imageUrl)) return blobImageProxyUrl(imageUrl)
    if (isDataUrl(imageUrl)) return imageUrl
    if (isCloudUrl(imageUrl)) return imageUrl
    return undefined
  })()

  useEffect(() => {
    if (!imageUrl || isDataUrl(imageUrl) || isCloudUrl(imageUrl) || isBlobUrl(imageUrl)) {
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
