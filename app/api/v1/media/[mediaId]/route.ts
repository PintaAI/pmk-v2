import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { isSuperAdminEmail } from "@/lib/super-admin"

// Restricted media streamer. mediaId format: <type>/<tokoId>/<filename>
// where type is "product" or "toko". Authenticated membership required
// and must match the resource owner.

const BLOB_HOST = "mr6pdgua5u6qsuec.private.blob.vercel-storage.com"
const ALLOWED_PATH_PATTERN = /^(product|toko)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/

export async function GET(_req: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required", requestId: crypto.randomUUID().slice(0, 8) } }, { status: 401 })
    }

    const { mediaId: encodedMediaId } = await params
    const mediaId = decodeURIComponent(encodedMediaId)

    if (!ALLOWED_PATH_PATTERN.test(mediaId)) {
      return new Response("Invalid media identifier", { status: 400 })
    }

    const parts = mediaId.split("/")
    const resourceType = parts[0]
    const tokoId = parts[1]

    const isSuperAdmin = isSuperAdminEmail(session.user.email)
    const membership = isSuperAdmin
      ? null
      : await prisma.tokoUser.findUnique({
          where: { tokoId_userId: { tokoId, userId: session.user.id } },
        })
    if (!isSuperAdmin && !membership) {
      return new Response("Forbidden", { status: 403 })
    }

    if (resourceType === "product") {
      const storedUrl = `https://${BLOB_HOST}/${mediaId}`
      const item = await prisma.item.findFirst({
        where: { tokoId, imageUrl: storedUrl },
        select: { id: true },
      })
      if (!item) return new Response("Media not found", { status: 404 })
    } else {
      const storedUrl = `https://${BLOB_HOST}/${mediaId}`
      const store = await prisma.toko.findFirst({
        where: { id: tokoId, OR: [{ imageUrl: storedUrl }, { receiptLogoUrl: storedUrl }] },
        select: { id: true },
      })
      if (!store) return new Response("Media not found", { status: 404 })
    }

    const blobUrl = `https://${BLOB_HOST}/${mediaId}`

    const response = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return new Response("Media not found", { status: 404 })
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "private, max-age=3600",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'",
      },
    })
  } catch {
    return new Response("Internal error", { status: 500 })
  }
}
