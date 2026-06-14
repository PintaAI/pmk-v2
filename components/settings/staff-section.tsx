"use client"

import { useState, useEffect, useActionState } from "react"
import { UserPlus, Trash2, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { addStaffAction, removeStaffAction, listStaffAction } from "@/app/actions/toko-actions"
import type { StaffMember } from "@/app/actions/toko-actions"
import { useToko } from "@/components/providers/toko-provider"

function wrapAddStaff(_prev: unknown, formData: FormData) {
  return addStaffAction(formData.get("email") as string)
}

export function StaffSettings() {
  const { toko, isLoading: tokoLoading } = useToko()
  const { toast } = useToast()
  const [members, setMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [addState, addFormAction, isAdding] = useActionState(wrapAddStaff, null)
  const [email, setEmail] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function loadMembers() {
    setLoading(true)
    const result = await listStaffAction()
    if (result.success) {
      setMembers(result.data)
    } else {
      toast("error", result.error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (toko) {
      loadMembers()
    }
  }, [toko?.id])

  useEffect(() => {
    if (addState?.success) {
      setEmail("")
      loadMembers()
      toast("success", "Staff berhasil ditambahkan.")
    } else if (addState && !addState.success) {
      toast("error", addState.error)
    }
  }, [addState])

  async function handleRemove(tokoUserId: string) {
    setRemovingId(tokoUserId)
    const result = await removeStaffAction(tokoUserId)
    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.id !== tokoUserId))
      toast("success", "Staff berhasil dihapus.")
    } else {
      toast("error", result.error)
    }
    setRemovingId(null)
  }

  if (tokoLoading || loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border rounded-lg border">
        {members.map((member) => {
          const isMemberOwner = member.role === "OWNER"

          return (
            <div key={member.id} className="flex items-center gap-3 px-3 py-2.5">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isMemberOwner
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {member.userName.charAt(0).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.userName}</p>
                <p className="truncate text-xs text-muted-foreground">{member.userEmail}</p>
              </div>

              <Badge variant={isMemberOwner ? "default" : "secondary"} className="shrink-0 gap-1">
                {isMemberOwner && <Shield className="size-2.5" />}
                {member.role}
              </Badge>

              {!isMemberOwner && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(member.id)}
                  disabled={removingId === member.id}
                  aria-label={`Remove ${member.userName}`}
                >
                  {removingId === member.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <form action={addFormAction} className="flex items-center gap-2">
        <UserPlus className="size-4 shrink-0 text-muted-foreground" />
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Tambah staff via email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 min-w-0 flex-1 text-sm"
        />
        <Button type="submit" size="sm" disabled={isAdding || !email.trim()}>
          {isAdding ? "Menambahkan..." : "Tambah"}
        </Button>
      </form>

        {addState && !addState.success && (
          <p className="text-xs text-destructive">{addState.error}</p>
        )}
    </div>
  )
}
