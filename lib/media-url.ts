const PRIVATE_BLOB_ORIGIN = "https://mr6pdgua5u6qsuec.private.blob.vercel-storage.com/"

export function getStoredMediaPath(value: string): string | null {
  const path = value.startsWith(PRIVATE_BLOB_ORIGIN)
    ? value.slice(PRIVATE_BLOB_ORIGIN.length)
    : value

  return /^(product|toko)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(path)
    ? path
    : null
}

export function toAuthorizedMediaUrl(value: string): string | null {
  const path = getStoredMediaPath(value)
  return path ? `/api/v1/media/${encodeURIComponent(path)}` : null
}
