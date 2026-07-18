"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkMaintenance } from "@/server/domain/maintenance-check"

export type ProfileActionState = {
  status: "idle" | "success" | "error"
  message: string
  user?: { name: string; email: string; image: string | null }
}

export type PasswordActionState = {
  status: "idle" | "success" | "error"
  message: string
}

const MAX_IMAGE_SIZE = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export async function updateProfile(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  checkMaintenance()
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

export async function changePassword(
  _prevState: PasswordActionState,
  formData: FormData
): Promise<PasswordActionState> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session?.user) {
    return { status: "error", message: "Anda harus login terlebih dahulu." }
  }

  const currentPassword = formData.get("currentPassword")
  const newPassword = formData.get("newPassword")
  const confirmation = formData.get("passwordConfirmation")

  if (typeof currentPassword !== "string" || !currentPassword) {
    return { status: "error", message: "Masukkan kata sandi saat ini." }
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return { status: "error", message: "Kata sandi baru minimal 8 karakter." }
  }
  if (newPassword.length > 128) {
    return { status: "error", message: "Kata sandi baru maksimal 128 karakter." }
  }
  if (newPassword !== confirmation) {
    return { status: "error", message: "Konfirmasi kata sandi baru tidak sama." }
  }
  if (newPassword === currentPassword) {
    return { status: "error", message: "Kata sandi baru harus berbeda dari kata sandi saat ini." }
  }

  try {
    await auth.api.changePassword({
      headers: requestHeaders,
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
    })

    return {
      status: "success",
      message: "Kata sandi berhasil diubah. Sesi di perangkat lain telah dicabut.",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""

    if (message.includes("invalid password")) {
      return { status: "error", message: "Kata sandi saat ini salah." }
    }
    if (message.includes("credential account")) {
      return { status: "error", message: "Akun ini tidak menggunakan login kata sandi." }
    }

    return { status: "error", message: "Gagal mengubah kata sandi. Silakan coba lagi." }
  }
}
