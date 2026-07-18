import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/server/domain/types"
import { UnauthenticatedError, ForbiddenError } from "@/server/domain/errors"

export async function requireAuth(): Promise<AuthContext> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new UnauthenticatedError()

  const tokoUser = await prisma.tokoUser.findFirst({
    where: { userId: session.user.id },
    select: { tokoId: true, role: true },
    orderBy: { createdAt: "asc" },
  })
  if (!tokoUser) throw new ForbiddenError("You do not belong to any store.")

  return { actorId: session.user.id, tokoId: tokoUser.tokoId, role: tokoUser.role as AuthContext["role"] }
}

export async function requireOwner(): Promise<AuthContext> {
  const ctx = await requireAuth()
  if (ctx.role !== "OWNER") throw new ForbiddenError("Owner access required")
  return ctx
}

export async function requireStoreMembership(storeId: string): Promise<AuthContext> {
  const ctx = await requireAuth()
  if (ctx.tokoId !== storeId) {
    const membership = await prisma.tokoUser.findUnique({
      where: { tokoId_userId: { tokoId: storeId, userId: ctx.actorId } },
      select: { role: true },
    })
    if (!membership) throw new ForbiddenError("Not a member of this store")
    return { ...ctx, tokoId: storeId, role: membership.role as AuthContext["role"] }
  }
  return ctx
}

export async function requireStoreOwner(storeId: string): Promise<AuthContext> {
  const ctx = await requireAuth()
  const membership = await prisma.tokoUser.findUnique({
    where: { tokoId_userId: { tokoId: storeId, userId: ctx.actorId } },
    select: { role: true },
  })
  if (!membership || membership.role !== "OWNER") throw new ForbiddenError("Owner access required")
  return { ...ctx, tokoId: storeId, role: "OWNER" }
}
