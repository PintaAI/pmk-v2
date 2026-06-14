import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function getCurrentTokoId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const tokoUser = await prisma.tokoUser.findFirst({
    where: { userId: session.user.id },
    select: { tokoId: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!tokoUser) {
    throw new Error('You do not belong to any toko. Create or join a toko first.')
  }

  return tokoUser.tokoId
}

export async function getUserAndTokoId(): Promise<{ userId: string; tokoId: string }> {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  const tokoUser = await prisma.tokoUser.findFirst({
    where: { userId: session.user.id },
    select: { tokoId: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!tokoUser) {
    throw new Error('You do not belong to any toko. Create or join a toko first.')
  }

  return { userId: session.user.id, tokoId: tokoUser.tokoId }
}
