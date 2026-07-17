"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Building2, Loader2, Trash2, UserRoundX } from "lucide-react"
import {
  forceDeleteTokoAction,
  forceDeleteUserAction,
  initialDeleteEntityState,
} from "@/app/actions/super-admin-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type DangerUser = {
  id: string
  name: string
  email: string
  protected: boolean
  ownedStoreCount: number
}

type DangerStore = {
  id: string
  name: string
  memberCount: number
  transactionCount: number
}

export function SuperAdminDangerZone({ users, stores }: { users: DangerUser[]; stores: DangerStore[] }) {
  const router = useRouter()
  const deletableUsers = users.filter((user) => !user.protected)
  const [userId, setUserId] = useState(deletableUsers[0]?.id ?? "")
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "")
  const [userConfirmation, setUserConfirmation] = useState("")
  const [storeConfirmation, setStoreConfirmation] = useState("")
  const [userState, deleteUser, deletingUser] = useActionState(handleDeleteUser, initialDeleteEntityState)
  const [storeState, deleteStore, deletingStore] = useActionState(handleDeleteStore, initialDeleteEntityState)
  const selectedUser = users.find((user) => user.id === userId)
  const selectedStore = stores.find((store) => store.id === storeId)

  async function handleDeleteUser(previousState: typeof initialDeleteEntityState, formData: FormData) {
    const result = await forceDeleteUserAction(previousState, formData)
    if (result.success) {
      setUserConfirmation("")
      setUserId("")
      router.refresh()
    }
    return result
  }

  async function handleDeleteStore(previousState: typeof initialDeleteEntityState, formData: FormData) {
    const result = await forceDeleteTokoAction(previousState, formData)
    if (result.success) {
      setStoreConfirmation("")
      setStoreId("")
      router.refresh()
    }
    return result
  }

  return (
    <section className="mt-8 border-t border-destructive/20 pt-8">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive">Zona berbahaya</p>
          <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">Penghapusan permanen</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Operasi berikut tidak dapat dibatalkan. Pastikan data penting telah dicadangkan sebelum melanjutkan.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 bg-destructive/[0.035] ring-1 ring-destructive/20">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRoundX className="size-4 text-destructive" /> Hapus akun
                </CardTitle>
                <CardDescription>
                  Menghapus login, seluruh sesi, dan membership toko. Data toko tetap ada.
                </CardDescription>
              </div>
              <Badge variant="destructive">Permanen</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {deletableUsers.length ? (
              <form action={deleteUser} className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="delete-user" className="text-xs font-medium">Akun target</label>
                  <select
                    id="delete-user"
                    name="userId"
                    value={userId}
                    onChange={(event) => {
                      setUserId(event.target.value)
                      setUserConfirmation("")
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
                    disabled={deletingUser}
                    required
                  >
                    <option value="" disabled>Pilih akun</option>
                    {deletableUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.name} - {user.email}</option>
                    ))}
                  </select>
                </div>

                {selectedUser?.ownedStoreCount ? (
                  <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    Akun ini merupakan OWNER pada {selectedUser.ownedStoreCount} toko. Toko tersebut dapat menjadi tanpa owner.
                  </p>
                ) : null}

                <div className="space-y-1.5">
                  <label htmlFor="delete-user-confirmation" className="text-xs text-muted-foreground">
                    Ketik <strong className="text-foreground">{selectedUser?.email ?? "email akun"}</strong> untuk konfirmasi
                  </label>
                  <Input
                    id="delete-user-confirmation"
                    name="confirmation"
                    value={userConfirmation}
                    onChange={(event) => setUserConfirmation(event.target.value)}
                    autoComplete="off"
                    disabled={deletingUser}
                    required
                  />
                </div>

                {userState.message ? (
                  <ResultMessage success={userState.success} message={userState.message} />
                ) : null}

                <Button
                  type="submit"
                  variant="destructive"
                  className="w-full"
                  disabled={deletingUser || !selectedUser || userConfirmation !== selectedUser.email}
                >
                  {deletingUser ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  {deletingUser ? "Menghapus akun..." : "Hapus akun permanen"}
                </Button>
              </form>
            ) : (
              <p className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                Tidak ada akun yang dapat dihapus.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-destructive/[0.035] ring-1 ring-destructive/20">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4 text-destructive" /> Hapus toko
                </CardTitle>
                <CardDescription>
                  Menghapus seluruh transaksi, produk, inventori, produksi, pesanan, dan membership.
                </CardDescription>
              </div>
              <Badge variant="destructive">Permanen</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {stores.length ? (
              <form action={deleteStore} className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="delete-store" className="text-xs font-medium">Toko target</label>
                  <select
                    id="delete-store"
                    name="tokoId"
                    value={storeId}
                    onChange={(event) => {
                      setStoreId(event.target.value)
                      setStoreConfirmation("")
                    }}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
                    disabled={deletingStore}
                    required
                  >
                    <option value="" disabled>Pilih toko</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                </div>

                {selectedStore ? (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    Akan menghapus {selectedStore.transactionCount.toLocaleString("id-ID")} transaksi dan mencabut akses {selectedStore.memberCount.toLocaleString("id-ID")} anggota.
                  </p>
                ) : null}

                <div className="space-y-1.5">
                  <label htmlFor="delete-store-confirmation" className="text-xs text-muted-foreground">
                    Ketik <strong className="text-foreground">HAPUS {selectedStore?.name ?? "nama toko"}</strong> untuk konfirmasi
                  </label>
                  <Input
                    id="delete-store-confirmation"
                    name="confirmation"
                    value={storeConfirmation}
                    onChange={(event) => setStoreConfirmation(event.target.value)}
                    autoComplete="off"
                    disabled={deletingStore}
                    required
                  />
                </div>

                {storeState.message ? (
                  <ResultMessage success={storeState.success} message={storeState.message} />
                ) : null}

                <Button
                  type="submit"
                  variant="destructive"
                  className="w-full"
                  disabled={deletingStore || !selectedStore || storeConfirmation !== `HAPUS ${selectedStore.name}`}
                >
                  {deletingStore ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  {deletingStore ? "Menghapus toko..." : "Hapus toko dan seluruh data"}
                </Button>
              </form>
            ) : (
              <p className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                Tidak ada toko yang dapat dihapus.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function ResultMessage({ success, message }: { success: boolean; message: string }) {
  return (
    <p
      role="alert"
      className={`rounded-lg px-3 py-2 text-xs ${
        success
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {message}
    </p>
  )
}
