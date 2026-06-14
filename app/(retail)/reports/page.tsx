import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { fetchAnalytics } from "@/lib/analytics"
import { ReportsAnalyticsCharts } from "@/components/reports/analytics-charts"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  let tokoId: string | null = null

  if (session?.user) {
    const tokoUser = await prisma.tokoUser.findFirst({
      where: { userId: session.user.id },
      select: { tokoId: true },
      orderBy: { createdAt: "asc" },
    })
    tokoId = tokoUser?.tokoId ?? null
  }

  if (!tokoId) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No toko selected
      </div>
    )
  }

  const analytics = await fetchAnalytics(tokoId)

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
