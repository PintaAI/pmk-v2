import { prisma } from "@/lib/prisma"
import type { AuthContext } from "@/server/domain/types"
import { ConflictError, ValidationError } from "@/server/domain/errors"

export type ProductCategoryDTO = {
  id: string
  name: string
}

export async function listProductCategories(ctx: AuthContext): Promise<ProductCategoryDTO[]> {
  return prisma.productCategory.findMany({
    where: { tokoId: ctx.tokoId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

export async function createProductCategory(ctx: AuthContext, name: string): Promise<ProductCategoryDTO> {
  const normalizedName = name.trim()
  if (normalizedName.length < 2) throw new ValidationError("Category name must be at least 2 characters")
  if (normalizedName.length > 50) throw new ValidationError("Category name must be at most 50 characters")

  const existing = await prisma.productCategory.findFirst({
    where: { tokoId: ctx.tokoId, name: { equals: normalizedName, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) throw new ConflictError("Category already exists")

  return prisma.$transaction(async (tx) => {
    const category = await tx.productCategory.create({
      data: { tokoId: ctx.tokoId, name: normalizedName },
      select: { id: true, name: true },
    })
    await tx.activityLog.create({
      data: {
        tokoId: ctx.tokoId,
        actorId: ctx.actorId,
        action: "created_product_category",
        entityType: "ProductCategory",
        entityId: category.id,
      },
    })
    return category
  })
}
