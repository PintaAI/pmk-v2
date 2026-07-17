'use server'

import { hashPassword } from 'better-auth/crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail, requireSuperAdmin } from '@/lib/super-admin'

export type ResetPasswordState = {
  success: boolean
  message: string
}

export type DeleteEntityState = {
  success: boolean
  message: string
}

export async function resetUserPasswordAction(
  _previousState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  try {
    const actor = await requireSuperAdmin()
    const userId = formData.get('userId')
    const password = formData.get('password')
    const confirmation = formData.get('passwordConfirmation')

    if (typeof userId !== 'string' || !userId) {
      throw new Error('Pilih pengguna yang akan direset.')
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error('Kata sandi baru minimal 8 karakter.')
    }
    if (password.length > 128) {
      throw new Error('Kata sandi baru maksimal 128 karakter.')
    }
    if (password !== confirmation) {
      throw new Error('Konfirmasi kata sandi tidak sama.')
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        accounts: {
          where: { providerId: 'credential' },
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!target || !target.accounts[0]) {
      throw new Error('Akun email dan kata sandi pengguna tidak ditemukan.')
    }

    const hashedPassword = await hashPassword(password)

    await prisma.$transaction([
      prisma.account.update({
        where: { id: target.accounts[0].id },
        data: { password: hashedPassword },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ])

    console.info('Super admin reset a user password', {
      actorId: actor.id,
      targetUserId: userId,
    })

    return {
      success: true,
      message: `Kata sandi ${target.email} berhasil direset. Semua sesi aktifnya telah dicabut.`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal mereset kata sandi.',
    }
  }
}

export async function forceDeleteUserAction(
  _previousState: DeleteEntityState,
  formData: FormData
): Promise<DeleteEntityState> {
  try {
    const actor = await requireSuperAdmin()
    const userId = formData.get('userId')
    const confirmation = formData.get('confirmation')

    if (typeof userId !== 'string' || !userId) {
      throw new Error('Pilih akun yang akan dihapus.')
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        tokoUsers: {
          where: { role: 'OWNER' },
          select: { tokoId: true },
        },
      },
    })

    if (!target) {
      throw new Error('Akun tidak ditemukan atau sudah dihapus.')
    }
    if (target.id === actor.id) {
      throw new Error('Anda tidak dapat menghapus akun sendiri.')
    }
    if (isSuperAdminEmail(target.email)) {
      throw new Error('Akun super admin lain tidak dapat dihapus dari halaman ini.')
    }
    if (confirmation !== target.email) {
      throw new Error('Konfirmasi email tidak sesuai.')
    }

    const ownedTokoIds = target.tokoUsers.map((membership) => membership.tokoId)

    await prisma.$transaction([
      prisma.activityLog.deleteMany({ where: { tokoId: { in: ownedTokoIds } } }),
      prisma.toko.deleteMany({ where: { id: { in: ownedTokoIds } } }),
      prisma.user.delete({ where: { id: target.id } }),
    ])

    console.info('Super admin deleted a user account', {
      actorId: actor.id,
      targetUserId: target.id,
      deletedTokoIds: ownedTokoIds,
    })
    revalidatePath('/super-admin')

    return {
      success: true,
      message: `Akun ${target.email} dan ${ownedTokoIds.length} toko miliknya beserta seluruh data telah dihapus.`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal menghapus akun.',
    }
  }
}

export async function forceDeleteTokoAction(
  _previousState: DeleteEntityState,
  formData: FormData
): Promise<DeleteEntityState> {
  try {
    const actor = await requireSuperAdmin()
    const tokoId = formData.get('tokoId')
    const confirmation = formData.get('confirmation')

    if (typeof tokoId !== 'string' || !tokoId) {
      throw new Error('Pilih toko yang akan dihapus.')
    }

    const toko = await prisma.toko.findUnique({
      where: { id: tokoId },
      select: { id: true, name: true },
    })

    if (!toko) {
      throw new Error('Toko tidak ditemukan atau sudah dihapus.')
    }
    if (confirmation !== `HAPUS ${toko.name}`) {
      throw new Error('Frasa konfirmasi tidak sesuai.')
    }

    await prisma.$transaction([
      prisma.activityLog.deleteMany({ where: { tokoId: toko.id } }),
      prisma.toko.delete({ where: { id: toko.id } }),
    ])

    console.info('Super admin deleted a store', {
      actorId: actor.id,
      targetTokoId: toko.id,
    })
    revalidatePath('/super-admin')

    return {
      success: true,
      message: `Toko ${toko.name} beserta seluruh data operasionalnya telah dihapus.`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Gagal menghapus toko.',
    }
  }
}
