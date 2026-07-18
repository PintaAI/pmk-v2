import { useEffect, useRef, useState } from "react"
import { getImageBlob } from "@/lib/idb-image"
import { toAuthorizedMediaUrl } from "@/lib/media-url"

const IDB_PREFIX = "idb:"

export function useStoredImage(imageUrl: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const mediaUrl = imageUrl ? toAuthorizedMediaUrl(imageUrl) : null
  const directUrl = imageUrl?.startsWith("data:") || imageUrl?.startsWith("http://") || imageUrl?.startsWith("https://")
    ? imageUrl
    : null

  useEffect(() => {
    if (!imageUrl || mediaUrl || directUrl) {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
      return
    }

    const key = imageUrl.startsWith(IDB_PREFIX) ? imageUrl.slice(IDB_PREFIX.length) : imageUrl
    let cancelled = false

    void getImageBlob(key).then((blob) => {
      if (cancelled) return
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = blob ? URL.createObjectURL(blob) : null
      setBlobUrl(objectUrlRef.current)
    })

    return () => {
      cancelled = true
    }
  }, [directUrl, imageUrl, mediaUrl])

  if (!imageUrl) return null
  return mediaUrl ?? directUrl ?? blobUrl
}
