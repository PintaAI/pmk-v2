import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react"
import { PasswordResetPanel } from "@/components/super-admin/password-reset-panel"
import { prisma } from "@/lib/prisma"
import { isSuperAdminEmail } from "@/lib/super-admin"
import { requireUser } from "@/lib/auth-required"
import { buttonVariants } from "@/components/ui/button"

export default async function SuperAdminPage() {
  const currentUser = await requireUser()

  if (!isSuperAdminEmail(currentUser.email)) {
    redirect("/")
  }

  const users = await prisma.user.findMany({
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
  })

  const managedUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    tokoMemberships: user.tokoUsers.map((membership) => ({
      tokoName: membership.toko.name,
      role: membership.role,
    })),
  }))

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
              Pemulihan akses pengguna
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Reset manual untuk pengguna yang kehilangan kata sandi. Setiap reset otomatis mengakhiri seluruh sesi aktif akun tersebut.
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

        <PasswordResetPanel users={managedUsers} />
      </div>
    </main>
  )
}
