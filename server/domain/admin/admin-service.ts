import { prisma } from "@/lib/prisma"
import { hashPassword } from "better-auth/crypto"
import { isSuperAdminEmail } from "@/lib/super-admin"
import type { Prisma } from "@/generated/prisma/client"
import { ValidationError, NotFoundError, ForbiddenError } from "@/server/domain/errors"

export async function getAdminSummary(): Promise<Record<string, unknown>> {
  const [userCount, tokoCount, orderAgg, purchaseAgg] = await Promise.all([
    prisma.user.count(),
    prisma.toko.count(),
    prisma.order.aggregate({ where: { status: "COMPLETED" }, _sum: { total: true }, _count: true }),
    prisma.purchase.aggregate({ where: { status: "COMPLETED" }, _sum: { totalAmount: true } }),
  ])
  const stores = await prisma.toko.findMany({
    take: 10, orderBy: { createdAt: "desc" },
    include: { _count: { select: { tokoUsers: true, items: true } } },
  })

  return {
    totalUsers: userCount, totalStores: tokoCount,
    totalRevenue: orderAgg._sum.total?.toString() ?? "0",
    totalExpenses: purchaseAgg._sum.totalAmount?.toString() ?? "0",
    totalOrders: orderAgg._count,
    stores: stores.map((s) => ({
      id: s.id, name: s.name, operationalMode: s.operationalMode,
      memberCount: s._count.tokoUsers, productCount: s._count.items,
    })),
  }
}

export async function listAdminUsers(query: { search?: string }): Promise<Record<string, unknown>[]> {
  const where: Record<string, unknown> = {}
  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: "insensitive" } },
      { name: { contains: query.search, mode: "insensitive" } },
    ]
  }
  const users = await prisma.user.findMany({
    where: where as Prisma.UserWhereInput, take: 100, orderBy: { createdAt: "desc" },
    include: { tokoUsers: { include: { toko: { select: { id: true, name: true } } }, take: 5 } },
  })
  return users.map((u) => ({
    id: u.id, name: u.name, email: u.email, isSuperAdmin: isSuperAdminEmail(u.email),
    stores: u.tokoUsers.map((tu) => ({ id: tu.toko.id, name: tu.toko.name, role: tu.role })),
    createdAt: u.createdAt.toISOString(),
  }))
}

export async function listAdminStores(): Promise<Record<string, unknown>[]> {
  const stores = await prisma.toko.findMany({
    take: 100, orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tokoUsers: true, items: true, orders: true } },
      tokoUsers: { where: { role: "OWNER" }, include: { user: { select: { id: true, name: true, email: true } } }, take: 1 },
    },
  })
  return stores.map((s) => ({
    id: s.id, name: s.name, operationalMode: s.operationalMode,
    owner: s.tokoUsers[0] ? { id: s.tokoUsers[0].user.id, name: s.tokoUsers[0].user.name, email: s.tokoUsers[0].user.email } : null,
    memberCount: s._count.tokoUsers, productCount: s._count.items, orderCount: s._count.orders,
    createdAt: s.createdAt.toISOString(),
  }))
}

export async function resetUserPassword(userId: string, password: string): Promise<void> {
  if (password.length < 8) throw new ValidationError("Password must be at least 8 characters")
  if (password.length > 128) throw new ValidationError("Password must be at most 128 characters")
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, accounts: { where: { providerId: "credential" }, select: { id: true }, take: 1 } },
  })
  if (!target || !target.accounts[0]) throw new NotFoundError("Credential account not found for user")
  const hashedPassword = await hashPassword(password)
  await prisma.$transaction([
    prisma.account.update({ where: { id: target.accounts[0].id }, data: { password: hashedPassword } }),
    prisma.session.deleteMany({ where: { userId } }),
  ])
}

export async function deleteUser(userId: string, actorId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, tokoUsers: { where: { role: "OWNER" }, select: { tokoId: true } } },
  })
  if (!target) throw new NotFoundError("User not found")
  if (target.id === actorId) throw new ForbiddenError("Cannot delete your own account")
  if (isSuperAdminEmail(target.email)) throw new ForbiddenError("Cannot delete a super admin account")
  const ownedTokoIds = target.tokoUsers.map((tu) => tu.tokoId)

  await prisma.$transaction(async (tx) => {
    for (const tokoId of ownedTokoIds) {
      await deleteTokoData(tx, tokoId)
    }
    await tx.user.delete({ where: { id: userId } })
  })
}

export async function deleteStore(tokoId: string): Promise<void> {
  const toko = await prisma.toko.findUnique({ where: { id: tokoId }, select: { id: true, name: true } })
  if (!toko) throw new NotFoundError("Store not found")
  await prisma.$transaction(async (tx) => deleteTokoData(tx, tokoId))
}

async function deleteTokoData(tx: Prisma.TransactionClient, tokoId: string): Promise<void> {
  // Delete only toko-scoped data. Never delete global migration evidence.
  const filter = { tokoId }

  await tx.idempotencyRecord.deleteMany({ where: filter })
  await tx.stockMovement.deleteMany({ where: filter })
  await tx.purchaseLine.deleteMany({ where: { purchase: filter } })
  await tx.purchase.deleteMany({ where: filter })
  await tx.productionLine.deleteMany({ where: { production: filter } })
  await tx.newProduction.deleteMany({ where: filter })
  await tx.orderLine.deleteMany({ where: { order: filter } })
  await tx.order.deleteMany({ where: filter })
  // Migration mappings, checkpoints, and runs are retained for audit/rollback evidence.
  await tx.inventoryMovement.deleteMany({ where: filter })
  await tx.sale.deleteMany({ where: filter })
  await tx.pesanan.deleteMany({ where: filter })
  await tx.belanja.deleteMany({ where: filter })
  await tx.production.deleteMany({ where: filter })
  await tx.activityLog.deleteMany({ where: filter })
  await tx.itemPrice.deleteMany({ where: { item: filter } })
  await tx.itemUnitConversion.deleteMany({ where: { item: filter } })
  await tx.stockBalance.deleteMany({ where: { item: filter } })
  await tx.item.deleteMany({ where: filter })
  await tx.productPrice.deleteMany({ where: { product: filter } })
  await tx.product.deleteMany({ where: filter })
  await tx.priceTier.deleteMany({ where: filter })
  await tx.bahanUnitConversion.deleteMany({ where: { bahan: filter } })
  await tx.bahan.deleteMany({ where: filter })
  await tx.tokoUser.deleteMany({ where: filter })
  await tx.toko.deleteMany({ where: { id: tokoId } })
}
