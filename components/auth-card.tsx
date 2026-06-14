"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { signIn, signUp } from "@/lib/auth-client"

function friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes("invalid email or password") || lower.includes("invalid credentials")) {
    return "Email atau kata sandi salah."
  }
  if (lower.includes("email already exists") || lower.includes("already registered")) {
    return "Email sudah terdaftar. Silakan login."
  }
  if (lower.includes("password") && lower.includes("too short")) {
    return "Kata sandi terlalu pendek. Minimal 8 karakter."
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Terlalu banyak percobaan. Silakan tunggu sebentar."
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Gagal terhubung ke server. Periksa koneksi Anda."
  }
  return raw || "Terjadi kesalahan. Silakan coba lagi."
}

export function AuthCard() {
  const router = useRouter()
  const [tab, setTab] = useState("sign-in")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn(formData: FormData) {
    setLoading(true)
    setError(null)
    const { error: authError } = await signIn.email({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    })
    setLoading(false)
    if (authError) {
      setError(friendlyAuthError(authError.statusText || String(authError)))
    } else {
      router.push("/")
    }
  }

  async function handleSignUp(formData: FormData) {
    setLoading(true)
    setError(null)
    const { error: authError } = await signUp.email({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      name: formData.get("name") as string,
    })
    setLoading(false)
    if (authError) {
      setError(friendlyAuthError(authError.statusText || String(authError)))
    } else {
      router.push("/")
    }
  }

  return (
    <Card size="sm" className="relative isolate w-full max-w-sm bg-transparent p-3 ring-0">
      <div className="pointer-events-none absolute -left-12 -top-10 -z-10 size-44 rounded-full bg-[radial-gradient(circle,oklch(0.88_0.08_76/0.42),oklch(0.82_0.08_160/0.16)_44%,transparent_70%)] blur-xl dark:bg-[radial-gradient(circle,oklch(0.62_0.12_76/0.24),oklch(0.58_0.12_160/0.12)_44%,transparent_70%)]" />
      <div className="pointer-events-none absolute right-2 top-12 -z-10 h-20 w-36 rounded-full bg-[linear-gradient(135deg,oklch(0.72_0.06_210/0.18),transparent_68%)] blur-2xl dark:bg-[linear-gradient(135deg,oklch(0.62_0.08_210/0.16),transparent_68%)]" />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v)
          setError(null)
        }}
        className="gap-0"
      >
        <CardHeader className="gap-3 px-1 pb-4 pt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-foreground text-[0.6rem] font-semibold text-background">
                  P
                </span>
                <div>
                  <CardTitle className="text-base tracking-tight">Selamat datang</CardTitle>
                  <CardDescription className="text-xs">Akses akun Anda</CardDescription>
                </div>
              </div>
            </div>

            <TabsList
              variant="line"
              className="h-8 shrink-0 gap-1 bg-transparent p-0 text-xs"
            >
              <TabsTrigger
                value="sign-in"
                className="h-8 rounded-none bg-transparent px-2.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-foreground after:opacity-100 after:transition-transform data-active:after:scale-x-100 dark:data-active:bg-transparent"
              >
                Login
              </TabsTrigger>
              <TabsTrigger
                value="sign-up"
                className="h-8 rounded-none bg-transparent px-2.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-foreground after:opacity-100 after:transition-transform data-active:after:scale-x-100 dark:data-active:bg-transparent"
              >
                Daftar
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-foreground/60 via-foreground/10 to-transparent" />
        </CardHeader>

        <TabsContent value="sign-in">
          <form action={handleSignIn}>
            <CardContent className="grid gap-3 px-1 pb-3">
              {error && (
                <p className="rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
              <fieldset className="grid gap-1.5" disabled={loading}>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="si-email">
                  Email
                </label>
                <Input
                  id="si-email"
                  name="email"
                  type="email"
                  placeholder="email@kamu.com"
                  required
                  autoComplete="email"
                  className="h-8"
                />
              </fieldset>
              <fieldset className="grid gap-1.5" disabled={loading}>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="si-password">
                  Kata sandi
                </label>
                <Input
                  id="si-password"
                  name="password"
                  type="password"
                  placeholder="Kata sandi"
                  required
                  autoComplete="current-password"
                  className="h-8"
                />
              </fieldset>
            </CardContent>
            <CardFooter className="border-t-0 bg-transparent px-1 py-1">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                {loading ? "Login..." : "Login"}
              </Button>
            </CardFooter>
          </form>
        </TabsContent>

        <TabsContent value="sign-up">
          <form action={handleSignUp}>
            <CardContent className="grid gap-3 px-1 pb-3">
              {error && (
                <p className="rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
              <fieldset className="grid gap-1.5" disabled={loading}>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="su-name">
                  Nama
                </label>
                <Input
                  id="su-name"
                  name="name"
                  type="text"
                  placeholder="Jane Doe"
                  required
                  autoComplete="name"
                  className="h-8"
                />
              </fieldset>
              <fieldset className="grid gap-1.5" disabled={loading}>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="su-email">
                  Email
                </label>
                <Input
                  id="su-email"
                  name="email"
                  type="email"
                  placeholder="email@kamu.com"
                  required
                  autoComplete="email"
                  className="h-8"
                />
              </fieldset>
              <fieldset className="grid gap-1.5" disabled={loading}>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="su-password">
                  Kata sandi
                </label>
                <Input
                  id="su-password"
                  name="password"
                  type="password"
                  placeholder="Kata sandi"
                  required
                  autoComplete="new-password"
                  className="h-8"
                />
              </fieldset>
            </CardContent>
            <CardFooter className="border-t-0 bg-transparent px-1 py-1">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
                {loading ? "Mendaftar..." : "Daftar"}
              </Button>
            </CardFooter>
          </form>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
