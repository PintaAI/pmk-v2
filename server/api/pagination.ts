import { NextRequest } from "next/server"

export interface PaginationMeta {
  limit: number
  nextCursor?: string
}

export interface CursorParams {
  limit: number
  cursor?: { createdAt: Date; id: string }
}

export function parsePagination(req: NextRequest): CursorParams {
  const url = new URL(req.url)
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50), 100)
  const rawCursor = url.searchParams.get("cursor")
  let cursor: { createdAt: Date; id: string } | undefined
  if (rawCursor) {
    try {
      const decoded = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf-8"))
      if (decoded.createdAt && decoded.id) {
        cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id }
      }
    } catch {
      // ignore invalid cursor
    }
  }
  return { limit, cursor }
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString("base64url")
}
