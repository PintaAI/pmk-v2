import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getAnalytics } from "@/server/domain/reports/report-service"
import { ReportsAnalyticsCharts } from "@/components/reports/analytics-charts"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Please sign in
      </div>
    )
  }

  const tokoUser = await prisma.tokoUser.findFirst({
    where: { userId: session.user.id },
    select: { tokoId: true, role: true },
    orderBy: { createdAt: "asc" },
  })

  if (!tokoUser?.tokoId) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No toko selected
      </div>
    )
  }

  const analytics = await getAnalytics({
    actorId: session.user.id,
    tokoId: tokoUser.tokoId,
    role: tokoUser.role as "OWNER" | "STAFF",
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold sm:text-xl">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sales performance, expenses, and product insights
        </p>
      </div>
      <ReportsAnalyticsCharts data={analytics} />
    </div>
  )
}
