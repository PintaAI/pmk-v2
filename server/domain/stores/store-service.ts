import { Prisma } from "@/generated/prisma/client"
import type { AuthContext } from "@/server/domain/types"
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from "@/server/domain/errors"
import { prisma } from "@/lib/prisma"

export type StoreDTO = {
  id: string
  name: string
  imageUrl: string | null
  receiptLogoUrl: string | null
  address: string | null
  phone: string | null
  operationalMode: string
  memberCount: number
  createdAt: string
  updatedAt: string
}

export type MemberDTO = {
  id: string
  userId: string
  userName: string
  userEmail: string
  role: string
}

export async function listStores(ctx: Pick<AuthContext, "actorId">): Promise<StoreDTO[]> {
  const memberships = await prisma.tokoUser.findMany({
    where: { userId: ctx.actorId },
    include: { toko: { include: { _count: { select: { tokoUsers: true } } } } },
    orderBy: { createdAt: "asc" },
  })

  return memberships.map((m) => ({
    id: m.toko.id,
    name: m.toko.name,
    imageUrl: m.toko.imageUrl,
    receiptLogoUrl: m.toko.receiptLogoUrl,
    address: m.toko.address,
    phone: m.toko.phone,
    operationalMode: m.toko.operationalMode,
    memberCount: m.toko._count.tokoUsers,
    createdAt: m.toko.createdAt.toISOString(),
    updatedAt: m.toko.updatedAt.toISOString(),
  }))
}

export async function createStore(ctx: Pick<AuthContext, "actorId">, name: string): Promise<StoreDTO> {
  const trimmed = name.trim()
  if (trimmed.length < 2) throw new ValidationError("Store name must be at least 2 characters")
  if (trimmed.length > 80) throw new ValidationError("Store name must be at most 80 characters")

  const existingOwnership = await prisma.tokoUser.findFirst({
    where: { userId: ctx.actorId, role: "OWNER" },
  })
  if (existingOwnership) throw new ValidationError("You already own a store")

  const toko = await prisma.$transaction(async (tx) => {
    const created = await tx.toko.create({ data: { name: trimmed } })
    await tx.tokoUser.create({ data: { tokoId: created.id, userId: ctx.actorId, role: "OWNER" } })
    return created
  })

  return {
    id: toko.id,
    name: toko.name,
    imageUrl: null,
    receiptLogoUrl: null,
    address: toko.address,
    phone: toko.phone,
    operationalMode: toko.operationalMode,
    memberCount: 1,
    createdAt: toko.createdAt.toISOString(),
    updatedAt: toko.updatedAt.toISOString(),
  }
}

export async function getStore(ctx: AuthContext, storeId: string): Promise<StoreDTO> {
  const toko = await prisma.toko.findUnique({
    where: { id: storeId },
    include: { _count: { select: { tokoUsers: true } } },
  })
  if (!toko) throw new NotFoundError("Store not found")

  return {
    id: toko.id,
    name: toko.name,
    imageUrl: toko.imageUrl,
    receiptLogoUrl: toko.receiptLogoUrl,
    address: toko.address,
    phone: toko.phone,
    operationalMode: toko.operationalMode,
    memberCount: toko._count.tokoUsers,
    createdAt: toko.createdAt.toISOString(),
    updatedAt: toko.updatedAt.toISOString(),
  }
}

export type UpdateStoreInput = {
  name?: string
  imageUrl?: string | null
  receiptLogoUrl?: string | null
  address?: string | null
  phone?: string | null
  operationalMode?: string
}

export async function updateStore(ctx: AuthContext, storeId: string, input: UpdateStoreInput): Promise<StoreDTO> {
  if (ctx.role !== "OWNER" || ctx.tokoId !== storeId) throw new ForbiddenError("Owner access required")

  if (input.name !== undefined) {
    if (input.name.trim().length < 2) throw new ValidationError("Store name must be at least 2 characters")
    if (input.name.trim().length > 80) throw new ValidationError("Store name must be at most 80 characters")
  }
  if (input.address && input.address.length > 160) throw new ValidationError("Address must be at most 160 characters")
  if (input.phone && input.phone.length > 32) throw new ValidationError("Phone must be at most 32 characters")

  const allowedModes = ["CASHIER_ONLY", "SIMPLE_INVENTORY", "WITH_INVENTORY"]
  if (input.operationalMode && !allowedModes.includes(input.operationalMode)) {
    throw new ValidationError(`Operational mode must be one of: ${allowedModes.join(", ")}`)
  }

  const data: Prisma.TokoUpdateInput = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl
  if (input.receiptLogoUrl !== undefined) data.receiptLogoUrl = input.receiptLogoUrl
  if (input.address !== undefined) data.address = input.address
  if (input.phone !== undefined) data.phone = input.phone
  if (input.operationalMode !== undefined) data.operationalMode = input.operationalMode as "CASHIER_ONLY" | "SIMPLE_INVENTORY" | "WITH_INVENTORY"

  await prisma.$transaction(async (tx) => {
    await tx.toko.update({ where: { id: storeId }, data })
    await tx.activityLog.create({
      data: {
        tokoId: storeId,
        actorId: ctx.actorId,
        action: "updated_store",
        entityType: "Toko",
        entityId: storeId,
      },
    })
  })

  return getStore(ctx, storeId)
}

export async function resetStore(ctx: AuthContext, storeId: string): Promise<void> {
  if (ctx.role !== "OWNER" || ctx.tokoId !== storeId) throw new ForbiddenError("Owner access required")

  await prisma.$transaction(async (tx) => {
    const storeIdFilter = { tokoId: storeId }

    // Migration mappings and run evidence are retained through the audit window.
    await tx.idempotencyRecord.deleteMany({ where: storeIdFilter })
    await tx.stockMovement.deleteMany({ where: storeIdFilter })
    await tx.purchaseLine.deleteMany({ where: { purchase: { tokoId: storeId } } })
    await tx.purchase.deleteMany({ where: storeIdFilter })
    await tx.productionLine.deleteMany({ where: { production: { tokoId: storeId } } })
    await tx.newProduction.deleteMany({ where: storeIdFilter })
    await tx.orderLine.deleteMany({ where: { order: { tokoId: storeId } } })
    await tx.order.deleteMany({ where: storeIdFilter })
    await tx.dataMigrationCheckpoint.deleteMany({ where: { tokoId: storeId } })
    await tx.inventoryMovement.deleteMany({ where: storeIdFilter })
    await tx.sale.deleteMany({ where: storeIdFilter })
    await tx.pesanan.deleteMany({ where: storeIdFilter })
    await tx.belanja.deleteMany({ where: storeIdFilter })
    await tx.production.deleteMany({ where: storeIdFilter })
    await tx.activityLog.deleteMany({ where: storeIdFilter })
    await tx.product.deleteMany({ where: storeIdFilter })
    await tx.priceTier.deleteMany({ where: storeIdFilter })
    await tx.bahan.deleteMany({ where: storeIdFilter })
    await tx.itemPrice.deleteMany({ where: { item: { tokoId: storeId } } })
    await tx.itemUnitConversion.deleteMany({ where: { item: { tokoId: storeId } } })
    await tx.stockBalance.deleteMany({ where: { item: { tokoId: storeId } } })
    await tx.item.deleteMany({ where: storeIdFilter })
  })
}

export async function listMembers(ctx: AuthContext, storeId: string): Promise<MemberDTO[]> {
  const members = await prisma.tokoUser.findMany({
    where: { tokoId: storeId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  })

  return members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    userName: m.user.name,
    userEmail: m.user.email,
    role: m.role,
  }))
}

export async function addMember(ctx: AuthContext, storeId: string, email: string): Promise<MemberDTO> {
  if (ctx.role !== "OWNER") throw new ForbiddenError("Owner access required")

  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  })
  if (!targetUser) throw new NotFoundError("User with this email not found")

  const existing = await prisma.tokoUser.findUnique({
    where: { tokoId_userId: { tokoId: storeId, userId: targetUser.id } },
  })
  if (existing) throw new ConflictError("User is already a member of this store")

  const member = await prisma.tokoUser.create({
    data: { tokoId: storeId, userId: targetUser.id, role: "STAFF" },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return {
    id: member.id,
    userId: member.user.id,
    userName: member.user.name,
    userEmail: member.user.email,
    role: member.role,
  }
}

export async function removeMember(ctx: AuthContext, storeId: string, memberId: string): Promise<void> {
  if (ctx.role !== "OWNER") throw new ForbiddenError("Owner access required")

  const target = await prisma.tokoUser.findUnique({
    where: { id: memberId },
    select: { tokoId: true, role: true },
  })
  if (!target || target.tokoId !== storeId) throw new NotFoundError("Member not found")
  if (target.role === "OWNER") throw new ForbiddenError("Cannot remove the store owner")

  await prisma.tokoUser.delete({ where: { id: memberId } })
}
