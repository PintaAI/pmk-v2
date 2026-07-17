"use client"

import { useActionState, useDeferredValue, useEffect, useRef, useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2, Search, ShieldCheck, UserRound } from "lucide-react"
import {
  resetUserPasswordAction,
} from "@/app/actions/super-admin-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export type ManagedUser = {
  id: string
  name: string
  email: string
  tokoMemberships: Array<{ tokoName: string; role: string }>
}

const initialResetPasswordState = {
  success: false,
  message: "",
}

export function PasswordResetPanel({ users }: { users: ManagedUser[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(
    resetUserPasswordAction,
    initialResetPasswordState
  )
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  const selectedUser = users.find((user) => user.id === selectedUserId)
  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email}`.toLowerCase().includes(deferredQuery)
  )

  useEffect(() => {
    if (state.success) formRef.current?.reset()
  }, [state])

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <Card className="border-0 bg-card/80 shadow-[0_24px_80px_-42px_rgba(0,0,0,0.5)] ring-1 ring-foreground/10 backdrop-blur">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserRound className="size-4" />
                Direktori pengguna
              </CardTitle>
              <CardDescription>{users.length} akun terdaftar</CardDescription>
            </div>
            <Badge variant="outline">Internal</Badge>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama atau email"
              className="h-10 pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="max-h-[32rem] space-y-2 overflow-y-auto">
          {filteredUsers.map((user) => {
            const selected = user.id === selectedUserId
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserId(user.id)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  selected
                    ? "border-foreground/25 bg-foreground text-background"
                    : "border-transparent bg-muted/45 hover:border-foreground/10 hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className={`truncate text-xs ${selected ? "text-background/65" : "text-muted-foreground"}`}>
                      {user.email}
                    </p>
                  </div>
                  <span className={`mt-0.5 text-[0.65rem] uppercase tracking-[0.16em] ${selected ? "text-background/60" : "text-muted-foreground"}`}>
                    {user.tokoMemberships[0]?.role ?? "User"}
                  </span>
                </div>
              </button>
            )
          })}
          {filteredUsers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Pengguna tidak ditemukan.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="h-fit border-0 bg-[linear-gradient(145deg,color-mix(in_oklch,var(--card),var(--primary)_4%),var(--card))] shadow-[0_24px_80px_-42px_rgba(0,0,0,0.5)] ring-1 ring-foreground/10 lg:sticky lg:top-8">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-foreground text-background shadow-lg">
            <KeyRound className="size-4" />
          </div>
          <CardTitle className="text-lg">Reset kata sandi</CardTitle>
          <CardDescription>
            Tetapkan kata sandi sementara, lalu sampaikan langsung kepada pengguna.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedUser ? (
            <form ref={formRef} action={action} className="space-y-4">
              <input type="hidden" name="userId" value={selectedUser.id} />
              <div className="rounded-xl border border-foreground/10 bg-background/65 p-3">
                <p className="text-xs text-muted-foreground">Akun terpilih</p>
                <p className="mt-1 font-medium">{selectedUser.name}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                {selectedUser.tokoMemberships.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedUser.tokoMemberships.map((membership) => (
                      <Badge key={`${membership.tokoName}-${membership.role}`} variant="secondary">
                        {membership.tokoName} · {membership.role}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <fieldset className="space-y-3" disabled={pending}>
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="text-xs font-medium">Kata sandi baru</label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-1 top-1 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="password-confirmation" className="text-xs font-medium">Ulangi kata sandi</label>
                  <Input
                    id="password-confirmation"
                    name="passwordConfirmation"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                    className="h-10"
                  />
                </div>
              </fieldset>

              {state.message ? (
                <p
                  role="alert"
                  className={`rounded-lg px-3 py-2.5 text-xs ${
                    state.success
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {state.message}
                </p>
              ) : null}

              <Button type="submit" className="h-10 w-full" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                {pending ? "Mereset..." : "Reset dan cabut semua sesi"}
              </Button>
            </form>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Pilih pengguna dari direktori.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
