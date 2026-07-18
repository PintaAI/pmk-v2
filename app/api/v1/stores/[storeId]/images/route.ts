import { NextRequest } from "next/server"
import { put } from "@vercel/blob"
import { apiSuccess, handleApiError } from "@/server/api/response"
import { requireStoreOwner } from "@/server/api/auth-context"
import { checkMaintenance } from "@/server/domain/maintenance-check"
import { updateStore } from "@/server/domain/stores/store-service"
import { ValidationError } from "@/server/domain/errors"
import { toAuthorizedMediaUrl } from "@/lib/media-url"

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    checkMaintenance()
    const { storeId } = await params
    const ctx = await requireStoreOwner(storeId)

    const formData = await req.formData()
    const type = (formData.get("type") as string) ?? "logo"
    const file = formData.get("file") as File | null

    if (!file || !(file instanceof File) || file.size === 0) {
      throw new ValidationError("File is required")
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"])
    if (!allowedTypes.has(file.type)) throw new ValidationError("Image must be JPG, PNG, or WebP")
    if (file.size > 2 * 1024 * 1024) throw new ValidationError("Image must be at most 2 MB")

    const ext = file.type.split("/")[1] ?? "jpg"
    const path = type === "receiptLogo" ? `toko/${storeId}/receipt-logo-${Date.now()}.${ext}` : `toko/${storeId}/logo-${Date.now()}.${ext}`
    const blob = await put(path, file, { access: "private", contentType: file.type })
    const updateField = type === "receiptLogo" ? { receiptLogoUrl: blob.url } : { imageUrl: blob.url }
    await updateStore(ctx, storeId, updateField)

    return apiSuccess({ url: toAuthorizedMediaUrl(path), blobUrl: blob.url, path })
  } catch (e) {
    return handleApiError(e)
  }
}
