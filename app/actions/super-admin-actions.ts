'use server'

import { hashPassword } from 'better-auth/crypto'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/super-admin'

export type ResetPasswordState = {
  success: boolean
  message: string
}

export const initialResetPasswordState: ResetPasswordState = {
  success: false,
  message: '',
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
