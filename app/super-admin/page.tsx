import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react"
import { PasswordResetPanel } from "@/components/super-admin/password-reset-panel"
import { StorePerformanceSummary, type StoreSummary } from "@/components/super-admin/store-summary"
import { SuperAdminDangerZone } from "@/components/super-admin/danger-zone"
import { prisma } from "@/lib/prisma"
import { isSuperAdminEmail } from "@/lib/super-admin"
import { requireUser } from "@/lib/auth-required"
import { buttonVariants } from "@/components/ui/button"

export default async function SuperAdminPage() {
  const currentUser = await requireUser()

  if (!isSuperAdminEmail(currentUser.email)) {
    redirect("/")
  }

  const { start: todayStart, end: todayEnd } = getJakartaDayRange(new Date())

  const [users, stores, salesByStore, todaySalesByStore, expensesByStore] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        tokoUsers: {
          select: {
            role: true,
            toko: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    prisma.toko.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
        address: true,
        operationalMode: true,
        createdAt: true,
        _count: {
          select: {
            tokoUsers: true,
            items: { where: { type: "PRODUCT", isActive: true } },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    }),
    prisma.order.groupBy({
      by: ["tokoId"],
      where: { status: "COMPLETED" },
      _sum: { total: true },
      _count: true,
      _min: { createdAt: true },
    }),
    prisma.order.groupBy({
      by: ["tokoId"],
      where: {
        status: "COMPLETED",
        createdAt: { gte: todayStart, lt: todayEnd },
      },
      _sum: { total: true },
    }),
    prisma.purchase.groupBy({
      by: ["tokoId"],
      where: { status: "COMPLETED" },
      _sum: { totalAmount: true },
    }),
  ])

  const managedUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    tokoMemberships: user.tokoUsers.map((membership) => ({
      tokoName: membership.toko.name,
      role: membership.role,
    })),
  }))

  const salesMap = new Map(salesByStore.map((sale) => [sale.tokoId, sale]))
  const todaySalesMap = new Map(todaySalesByStore.map((sale) => [sale.tokoId, sale]))
  const expensesMap = new Map(expensesByStore.map((expense) => [expense.tokoId, expense]))
  const now = new Date()
  const storeSummaries: StoreSummary[] = stores.map((store) => {
    const sales = salesMap.get(store.id)
    const revenue = Number(sales?._sum.total ?? 0)

    return {
      id: store.id,
      name: store.name,
      imageUrl: store.imageUrl,
      address: store.address,
      operationalMode: store.operationalMode,
      createdAt: store.createdAt.toISOString(),
      revenue,
      revenueToday: Number(todaySalesMap.get(store.id)?._sum.total ?? 0),
      dailyRate: revenue / getElapsedDays(sales?._min.createdAt ?? null, now),
      expenses: Number(expensesMap.get(store.id)?._sum.totalAmount ?? 0),
      transactionCount: sales?._count ?? 0,
      memberCount: store._count.tokoUsers,
      activeProductCount: store._count.items,
    }
  })

  const totalRevenue = storeSummaries.reduce((sum, store) => sum + store.revenue, 0)
  const firstSale = salesByStore.reduce<Date | null>((earliest, sale) => {
    const date = sale._min.createdAt
    return date && (!earliest || date < earliest) ? date : earliest
  }, null)
  const globalSummary = {
    revenue: totalRevenue,
    revenueToday: storeSummaries.reduce((sum, store) => sum + store.revenueToday, 0),
    dailyRate: totalRevenue / getElapsedDays(firstSale, now),
    storeCount: stores.length,
    userCount: users.length,
    transactionCount: storeSummaries.reduce((sum, store) => sum + store.transactionCount, 0),
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-muted/25 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,color-mix(in_oklch,var(--primary),transparent_86%),transparent_28%),linear-gradient(to_right,color-mix(in_oklch,var(--foreground),transparent_96%)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground),transparent_96%)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]" />
      <div className="relative mx-auto max-w-6xl">
        <Link href="/" className={buttonVariants({ variant: "ghost", className: "-ml-2 mb-6" })}>
          <ArrowLeft /> Kembali ke aplikasi
        </Link>

        <header className="mb-7 grid gap-5 border-b border-foreground/10 pb-7 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-600" />
              Ruang terbatas
            </div>
            <h1 className="max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Kendali jaringan toko
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Pantau performa seluruh toko dan pulihkan akses pengguna dari satu ruang operasional.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-background/70 px-3.5 py-3 shadow-sm backdrop-blur">
            <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <LockKeyhole className="size-4" />
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Super admin</p>
              <p className="max-w-52 truncate text-sm font-medium">{currentUser.email}</p>
            </div>
          </div>
        </header>

        <StorePerformanceSummary global={globalSummary} stores={storeSummaries} />

        <section>
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Administrasi akses</p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">Reset kata sandi pengguna</h2>
          </div>
          <PasswordResetPanel users={managedUsers} />
        </section>

        <SuperAdminDangerZone
          users={users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            protected: user.id === currentUser.id || isSuperAdminEmail(user.email),
            ownedStoreCount: user.tokoUsers.filter((membership) => membership.role === "OWNER").length,
          }))}
          stores={storeSummaries.map((store) => ({
            id: store.id,
            name: store.name,
            memberCount: store.memberCount,
            transactionCount: store.transactionCount,
          }))}
        />
      </div>
    </main>
  )
}

function getElapsedDays(firstActivity: Date | null, now: Date) {
  if (!firstActivity) return 1
  return Math.max(1, Math.ceil((now.getTime() - firstActivity.getTime()) / 86_400_000))
}

function getJakartaDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const start = new Date(`${values.year}-${values.month}-${values.day}T00:00:00+07:00`)

  return {
    start,
    end: new Date(start.getTime() + 86_400_000),
  }
}
