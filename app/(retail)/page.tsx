import { HomeDashboard } from "@/components/home/home-dashboard"
import { QuickActionDrawer } from "@/components/home/quick-action-drawer"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function RetailHomePage() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let tokoId: string | null = null

  if (session?.user) {
    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: session.user.id },
      select: { tokoId: true },
      orderBy: { createdAt: 'asc' },
    })
    tokoId = tokoUser?.tokoId ?? null
  }

  const baseFilter = tokoId ? { tokoId } : { tokoId: '__none__' }

  const [activity, salesAgg, belanjaAgg, pesananPending] = await Promise.all([
    prisma.activityLog.findMany({
      where: baseFilter,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.sale.aggregate({
      where: { ...baseFilter, status: "COMPLETED", date: { gte: thirtyDaysAgo } },
      _sum: { totalAmount: true },
    }),
    prisma.belanja.aggregate({
      where: { ...baseFilter, status: "COMPLETED", date: { gte: thirtyDaysAgo } },
      _sum: { totalAmount: true },
    }),
    prisma.pesanan.count({
      where: {
        ...baseFilter,
        NOT: { statusPengiriman: 'DIKIRIM', statusPembayaran: 'DIBAYAR' },
      },
    }),
  ])

  const gross = Number(salesAgg._sum.totalAmount ?? 0)
  const expense = Number(belanjaAgg._sum.totalAmount ?? 0)

  return (
    <>
      <HomeDashboard
        activity={activity.map((item) => ({
          id: item.id,
          action: item.action,
          entityType: item.entityType,
          entityId: item.entityId,
          metadata: item.metadata,
          createdAt: item.createdAt.toISOString(),
        }))}
        gross={gross}
        expense={expense}
        net={gross - expense}
        pesananPending={pesananPending}
      />
      <QuickActionDrawer />
    </>
  )
}
