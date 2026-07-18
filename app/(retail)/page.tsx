import { HomeDashboard } from "@/components/home/home-dashboard"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import type { OperationalMode } from "@/server/domain/types"
import { getDashboard } from "@/server/domain/reports/report-service"

export const dynamic = "force-dynamic"

export default async function RetailHomePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let tokoId: string | null = null
  let role = "STAFF"
  let operationalMode: OperationalMode = "WITH_INVENTORY"

  if (session?.user) {
    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: session.user.id },
      select: { tokoId: true, role: true, toko: { select: { operationalMode: true } } },
      orderBy: { createdAt: 'asc' },
    })
    tokoId = tokoUser?.tokoId ?? null
    role = tokoUser?.role ?? "STAFF"
    operationalMode = (tokoUser?.toko.operationalMode ?? "WITH_INVENTORY") as OperationalMode
  }

  const dashboard = tokoId
    ? await getDashboard({ actorId: session?.user?.id ?? "", tokoId, role: role as "OWNER" | "STAFF" })
    : { totalRevenue: "0", totalExpenses: "0", totalOrders: 0, netProfit: "0", pendingOrders: [], recentActivity: [], periodDays: 30 }

  const activity = tokoId
    ? await prisma.activityLog.findMany({
        where: { tokoId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true },
      })
    : []

  const gross = Number(dashboard.totalRevenue)
  const expense = Number(dashboard.totalExpenses)

  return (
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
        pesananPending={dashboard.pendingOrders.length}
        operationalMode={operationalMode}
      />
  )
}
