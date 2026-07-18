import { NextRequest } from "next/server"
import { put } from "@vercel/blob"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreMembership } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { updateItem } from "@/server/domain/items/item-service"
import { ValidationError } from "@/server/domain/errors"
import { toAuthorizedMediaUrl } from "@/lib/media-url"

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string; itemId: string }> }) {
  try {
    checkMaintenance()
    const { storeId, itemId } = await params
    const ctx = await requireStoreMembership(storeId)

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file || !(file instanceof File) || file.size === 0) {
      throw new ValidationError("File is required")
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"])
    if (!allowedTypes.has(file.type)) throw new ValidationError("Image must be JPG, PNG, or WebP")
    if (file.size > 2 * 1024 * 1024) throw new ValidationError("Image must be at most 2 MB")

    const ext = file.type.split("/")[1] ?? "jpg"
    const path = `product/${storeId}/${Date.now()}.${ext}`
    const blob = await put(path, file, { access: "private", contentType: file.type })
    await updateItem(ctx, itemId, { imageUrl: blob.url })

    return apiSuccess({ url: toAuthorizedMediaUrl(path), blobUrl: blob.url })
  } catch (e) {
    return handleApiError(e)
  }
}
