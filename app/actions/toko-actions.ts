'use server'

import { revalidatePath } from 'next/cache'
import { put } from '@vercel/blob'
import { requireUser } from '@/lib/auth-required'
import { toActionResult, type ActionResult } from '@/lib/action-result'
import { prisma } from '@/lib/prisma'
import { OperationalMode } from '@/generated/prisma/client'

export type StaffMember = {
  id: string
  userId: string
  userName: string
  userEmail: string
  role: string
}

export type TokoInfo = {
  id: string
  name: string
  imageUrl: string | null
  operationalMode: OperationalMode
}

export async function getCurrentTokoAction(): Promise<ActionResult<TokoInfo | null>> {
  return toActionResult(async () => {
    const user = await requireUser()

    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: user.id },
      include: { toko: { select: { id: true, name: true, imageUrl: true, operationalMode: true } } },
      orderBy: { createdAt: 'asc' },
    })

    if (!tokoUser) return null

    return tokoUser.toko
  })
}

export async function createTokoAction(name: string): Promise<ActionResult<TokoInfo>> {
  return toActionResult(async () => {
    const user = await requireUser()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      throw new Error('Nama toko minimal 2 karakter.')
    }
    if (trimmed.length > 80) {
      throw new Error('Nama toko maksimal 80 karakter.')
    }

    const existingOwnership = await prisma.tokoUser.findFirst({
      where: { userId: user.id, role: 'OWNER' },
    })

    if (existingOwnership) {
      throw new Error('Anda sudah memiliki toko.')
    }

    const toko = await prisma.toko.create({
      data: { name: trimmed },
    })

    await prisma.tokoUser.create({
      data: {
        tokoId: toko.id,
        userId: user.id,
        role: 'OWNER',
      },
    })

    revalidatePath('/settings')

    return { id: toko.id, name: toko.name, imageUrl: null, operationalMode: toko.operationalMode }
  })
}

export async function listStaffAction(): Promise<ActionResult<StaffMember[]>> {
  return toActionResult(async () => {
    const user = await requireUser()

    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: user.id, role: 'OWNER' },
      select: { tokoId: true },
    })

    if (!tokoUser) {
      throw new Error('Anda belum memiliki toko.')
    }

    const members = await prisma.tokoUser.findMany({
      where: { tokoId: tokoUser.tokoId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    })

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      userName: m.user.name,
      userEmail: m.user.email,
      role: m.role,
    }))
  })
}

export async function addStaffAction(email: string): Promise<ActionResult<StaffMember>> {
  return toActionResult(async () => {
    const currentUser = await requireUser()

    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: currentUser.id, role: 'OWNER' },
      select: { tokoId: true },
    })

    if (!tokoUser) {
      throw new Error('Anda belum memiliki toko.')
    }

    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })

    if (!targetUser) {
      throw new Error('Pengguna dengan email ini tidak ditemukan. Minta mereka untuk membuat akun terlebih dahulu.')
    }

    const existing = await prisma.tokoUser.findUnique({
      where: { tokoId_userId: { tokoId: tokoUser.tokoId, userId: targetUser.id } },
    })

    if (existing) {
      throw new Error('Pengguna sudah menjadi anggota toko ini.')
    }

    const member = await prisma.tokoUser.create({
      data: {
        tokoId: tokoUser.tokoId,
        userId: targetUser.id,
        role: 'STAFF',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    revalidatePath('/settings')

    return {
      id: member.id,
      userId: member.user.id,
      userName: member.user.name,
      userEmail: member.user.email,
      role: member.role,
    }
  })
}

export async function updateTokoAction(_prevState: unknown, formData: FormData): Promise<ActionResult<TokoInfo>> {
  return toActionResult(async () => {
    const user = await requireUser()

    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: user.id, role: 'OWNER' },
      include: { toko: { select: { id: true, name: true, imageUrl: true, operationalMode: true } } },
    })

    if (!tokoUser) {
      throw new Error('Anda belum memiliki toko.')
    }

    const rawName = formData.get('name')
    const name = typeof rawName === 'string' ? rawName.trim() : tokoUser.toko.name
    const rawOperationalMode = formData.get('operationalMode')
    const operationalMode = rawOperationalMode === OperationalMode.CASHIER_ONLY
      ? OperationalMode.CASHIER_ONLY
      : rawOperationalMode === OperationalMode.WITH_INVENTORY
        ? OperationalMode.WITH_INVENTORY
        : tokoUser.toko.operationalMode

    if (name.length < 2) {
      throw new Error('Nama toko minimal 2 karakter.')
    }
    if (name.length > 80) {
      throw new Error('Nama toko maksimal 80 karakter.')
    }

    const file = formData.get('image')
    let imageUrl = tokoUser.toko.imageUrl

    if (file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Ukuran logo maksimal 2 MB.')
      }

      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
      if (!allowedTypes.has(file.type)) {
        throw new Error('Logo harus berupa JPG, PNG, atau WebP.')
      }

      const ext = file.type.split('/')[1] ?? 'jpg'
      const blob = await put(`toko/${tokoUser.toko.id}/logo-${Date.now()}.${ext}`, file, {
        access: 'private',
        contentType: file.type,
      })
      imageUrl = blob.url
    }

    const toko = await prisma.toko.update({
      where: { id: tokoUser.toko.id },
      data: { name, imageUrl, operationalMode },
    })

    revalidatePath('/settings')

    return { id: toko.id, name: toko.name, imageUrl: toko.imageUrl, operationalMode: toko.operationalMode }
  })
}

export async function removeStaffAction(tokoUserId: string): Promise<ActionResult<void>> {
  return toActionResult(async () => {
    const currentUser = await requireUser()

    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: currentUser.id, role: 'OWNER' },
      select: { tokoId: true },
    })

    if (!tokoUser) {
      throw new Error('Anda belum memiliki toko.')
    }

    const target = await prisma.tokoUser.findUnique({
      where: { id: tokoUserId },
      select: { tokoId: true, role: true },
    })

    if (!target) {
      throw new Error('Anggota staff tidak ditemukan.')
    }

    if (target.tokoId !== tokoUser.tokoId) {
      throw new Error('Anggota staff bukan bagian dari toko Anda.')
    }

    if (target.role === 'OWNER') {
      throw new Error('Tidak dapat menghapus pemilik toko.')
    }

    await prisma.tokoUser.delete({ where: { id: tokoUserId } })

    revalidatePath('/settings')
  })
}
