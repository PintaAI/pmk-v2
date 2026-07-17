"use client"

import { useState, useRef } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { Edit3, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { useSession } from "@/lib/auth-client"
import { processImageForUpload } from "@/lib/image-processor"
import {
  changePassword,
  updateProfile,
  type PasswordActionState,
  type ProfileActionState,
} from "@/app/actions/profile"

export function ProfileSection() {
  const { data: session, isPending: sessionLoading, refetch } = useSession()
  const { toast } = useToast()
  const [name, setName] = useState(session?.user?.name ?? "")
  const [state, setState] = useState<ProfileActionState>({ status: "idle", message: "" })
  const [photoPending, setPhotoPending] = useState(false)
  const [namePending, setNamePending] = useState(false)
  const [passwordPending, setPasswordPending] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordState, setPasswordState] = useState<PasswordActionState>({ status: "idle", message: "" })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const passwordFormRef = useRef<HTMLFormElement>(null)

  const user = session?.user
  const nameChanged = name.trim() !== user?.name?.trim()

  if (sessionLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-20 rounded-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-10" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      </div>
    )
  }

  async function handlePhotoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.currentTarget.value = ""

    setPhotoPending(true)
    setState({ status: "idle", message: "" })

    const preview = URL.createObjectURL(file)
    setPreviewUrl(preview)

    const { file: processed } = await processImageForUpload(file)

    const formData = new FormData()
    formData.set("name", name.trim() || user?.name || "")
    formData.set("image", processed)

    try {
      const result = await updateProfile({ status: "idle", message: "" }, formData)
      setState(result)
      if (result.status === "success") {
        void refetch()
        toast("success", result.message)
      } else {
        toast("error", result.message)
      }
    } catch {
      toast("error", "Gagal mengupload foto. Coba lagi.")
    } finally {
      setPhotoPending(false)
      URL.revokeObjectURL(preview)
      setPreviewUrl(null)
    }
  }

  async function handleNameSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || !nameChanged) return
    setNamePending(true)
    setState({ status: "idle", message: "" })

    const formData = new FormData()
    formData.set("name", name.trim())

    try {
      const result = await updateProfile({ status: "idle", message: "" }, formData)
      setState(result)
      if (result.status === "success") {
        void refetch()
        toast("success", result.message)
      } else {
        toast("error", result.message)
      }
    } catch {
      toast("error", "Gagal menyimpan nama. Coba lagi.")
    } finally {
      setNamePending(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordPending(true)
    setPasswordState({ status: "idle", message: "" })

    try {
      const result = await changePassword(
        { status: "idle", message: "" },
        new FormData(e.currentTarget)
      )
      setPasswordState(result)

      if (result.status === "success") {
        passwordFormRef.current?.reset()
        setShowPasswords(false)
        toast("success", result.message)
      } else {
        toast("error", result.message)
      }
    } catch {
      toast("error", "Gagal mengubah kata sandi. Coba lagi.")
    } finally {
      setPasswordPending(false)
    }
  }

  const displayImage = previewUrl || user?.image || null

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <label className="group relative cursor-pointer" aria-label="Ganti foto profil">
          <Avatar size="lg" className="size-20 text-2xl font-semibold">
            {displayImage ? (
              <AvatarImage src={displayImage} alt="Foto profil" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
            <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors group-hover:bg-muted">
              {photoPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Edit3 className="size-3" />
              )}
            </span>
          </Avatar>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoSelect}
            className="hidden"
            disabled={photoPending}
          />
        </label>
      </div>

      <form onSubmit={handleNameSubmit} className="space-y-1">
        <p className="text-xs text-muted-foreground">Nama</p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={80}
            disabled={namePending || photoPending}
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={namePending || photoPending || !nameChanged || name.trim().length < 2}
          >
            {namePending ? <Loader2 className="size-3.5 animate-spin" /> : "Simpan"}
          </Button>
        </div>
      </form>

      {user?.email && (
        <p className="text-xs text-muted-foreground text-center">{user.email}</p>
      )}

      {state.message && (
        <p
          className={`text-xs text-center ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {state.message}
        </p>
      )}

      <div className="border-t border-foreground/10 pt-4">
        <div className="mb-3 flex items-start gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-3.5" />
          </div>
          <div>
            <p className="text-sm font-medium">Ganti kata sandi</p>
            <p className="text-xs text-muted-foreground">
              Sesi aktif di perangkat lain akan otomatis dikeluarkan.
            </p>
          </div>
        </div>

        <form ref={passwordFormRef} onSubmit={handlePasswordSubmit} className="space-y-3">
          <fieldset disabled={passwordPending} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-xs text-muted-foreground">
                Kata sandi saat ini
              </label>
              <Input
                id="current-password"
                name="currentPassword"
                type={showPasswords ? "text" : "password"}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-xs text-muted-foreground">
                Kata sandi baru
              </label>
              <div className="relative">
                <Input
                  id="new-password"
                  name="newPassword"
                  type={showPasswords ? "text" : "password"}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((visible) => !visible)}
                  className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={showPasswords ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPasswords ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password-confirmation" className="text-xs text-muted-foreground">
                Ulangi kata sandi baru
              </label>
              <Input
                id="password-confirmation"
                name="passwordConfirmation"
                type={showPasswords ? "text" : "password"}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </div>
          </fieldset>

          {passwordState.message ? (
            <p
              className={`text-xs ${passwordState.status === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}
              role="alert"
            >
              {passwordState.message}
            </p>
          ) : null}

          <Button type="submit" size="sm" className="w-full" disabled={passwordPending}>
            {passwordPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            {passwordPending ? "Mengubah..." : "Ubah kata sandi"}
          </Button>
        </form>
      </div>
    </div>
  )
}
