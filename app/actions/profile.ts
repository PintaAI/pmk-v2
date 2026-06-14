"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type ProfileActionState = {
  status: "idle" | "success" | "error"
  message: string
  user?: { name: string; email: string; image: string | null }
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return { status: "error", message: "Anda harus login terlebih dahulu." }
  }

  const rawName = formData.get("name")
  const name = typeof rawName === "string" ? rawName.trim() : ""

  if (name.length < 2) {
    return { status: "error", message: "Nama minimal 2 karakter." }
  }
  if (name.length > 80) {
    return { status: "error", message: "Nama maksimal 80 karakter." }
  }

  const file = formData.get("image")
  let imageBase64: string | undefined

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return { status: "error", message: "Foto harus berupa JPG, PNG, atau WebP." }
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return { status: "error", message: "Ukuran foto maksimal 2 MB." }
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString("base64")
    const mimeType = file.type
    imageBase64 = `data:${mimeType};base64,${base64}`
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      ...(imageBase64 ? { image: imageBase64 } : {}),
    },
    select: { name: true, email: true, image: true },
  })

  revalidatePath('/settings')

  return {
    status: "success",
    message: imageBase64 ? "Profil berhasil diperbarui." : "Nama berhasil diperbarui.",
    user,
  }
}
