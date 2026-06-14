"use client"

import { Bluetooth, Loader2 } from "lucide-react"
import type { BtPrintState } from "./bt-printer"

type Props = {
  state: BtPrintState
  onSelect: (address: string) => void
  onClose: () => void
  onRetry: () => void
}

export function BtPrintDialog({ state, onSelect, onClose, onRetry }: Props) {
  if (state.phase === "idle") return null

  const canCloseFromBackdrop = state.phase === "done" || state.phase === "error"

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={canCloseFromBackdrop ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-blue-100">
            <Bluetooth className="size-6 text-blue-600" />
          </div>

          {state.phase === "checking_permissions" && (
            <>
              <Loader2 className="size-6 animate-spin text-blue-600" />
              <p className="text-sm text-slate-600">Memeriksa izin Bluetooth...</p>
            </>
          )}

          {state.phase === "enabling" && (
            <>
              <Loader2 className="size-6 animate-spin text-blue-600" />
              <p className="text-sm text-slate-600">Mengaktifkan Bluetooth...</p>
            </>
          )}

          {state.phase === "scanning" && (
            <>
              <Loader2 className="size-6 animate-spin text-blue-600" />
              <p className="text-sm text-slate-600">Mencari printer MP-58N...</p>
            </>
          )}

          {state.phase === "select_device" && (
            <>
              <p className="font-semibold text-slate-900">Pilih Printer</p>
              <div className="flex w-full flex-col gap-2">
                {state.devices.map((d) => (
                  <button
                    key={d.address}
                    onClick={() => onSelect(d.address)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-left text-sm hover:bg-blue-50"
                  >
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-slate-400">{d.address}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-6 py-2 text-sm font-medium text-slate-700"
              >
                Batal
              </button>
            </>
          )}

          {state.phase === "connecting" && (
            <>
              <Loader2 className="size-6 animate-spin text-blue-600" />
              <p className="text-sm text-slate-600">
                Menghubungkan ke {state.deviceName}...
              </p>
            </>
          )}

          {state.phase === "printing" && (
            <>
              <Loader2 className="size-6 animate-spin text-blue-600" />
              <p className="text-sm text-slate-600">Mencetak struk...</p>
            </>
          )}

          {state.phase === "done" && (
            <>
              <p className="font-semibold text-green-700">Struk berhasil dicetak!</p>
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-medium text-white"
              >
                Selesai
              </button>
            </>
          )}

          {state.phase === "error" && (
            <>
              <p className="font-semibold text-red-600">Gagal</p>
              <p className="text-sm text-slate-600">{state.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={onRetry}
                  className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-medium text-white"
                >
                  Coba Lagi
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-6 py-2 text-sm font-medium text-slate-700"
                >
                  Tutup
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
