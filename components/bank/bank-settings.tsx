"use client"

import { useState } from "react"
import { Building2, Trash2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBank, type BankInfo } from "@/hooks/use-bank"

const INDONESIAN_BANKS = [
  "BCA",
  "Mandiri",
  "BNI",
  "BRI",
  "CIMB Niaga",
  "Danamon",
  "Permata",
  "OCBC NISP",
  "Maybank",
  "Panin",
  "BTPN",
  "BTN",
  "Mega",
  "Sinarmas",
  "Muamalat",
  "BSI",
  "BJB",
  "Jago",
  "Seabank",
  "Jenius (BTPN)",
  "DBS",
  "HSBC",
  "UOB",
  "Citibank",
  "BNI Syariah",
  "BRI Syariah",
  "Mandiri Syariah",
  "BCA Syariah",
  "Danamon Syariah",
  "Lainnya",
]

export function BankSettings() {
  const { bankInfo, hasBankInfo, setBankInfo, clearBankInfo } = useBank()
  const [pending, setPending] = useState<BankInfo | null>(null)
  const [editing, setEditing] = useState(false)

  function handleSave() {
    if (pending && pending.bankName && pending.accountNumber && pending.accountHolder) {
      setBankInfo(pending)
      setPending(null)
      setEditing(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Transfer Bank</span>
        {hasBankInfo && !editing && (
          <Badge variant="default" className="ml-auto text-[10px]">Tersimpan</Badge>
        )}
      </div>

      <div className="ml-3 space-y-3">
        {hasBankInfo && !editing && (
          <div className="rounded-lg border bg-muted/10 p-3 text-sm space-y-0.5">
            <p className="font-medium">{bankInfo!.bankName}</p>
            <p className="font-mono tracking-wider text-muted-foreground">
              {formatAccountNumber(bankInfo!.accountNumber)}
            </p>
            <p className="text-xs text-muted-foreground">a.n. {bankInfo!.accountHolder}</p>
          </div>
        )}

        {(editing || !hasBankInfo) && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select
                value={pending?.bankName ?? ""}
                onValueChange={(value: string | null) =>
                  setPending((prev) => ({
                    ...(prev ?? { accountNumber: "", accountHolder: "" }),
                    bankName: value ?? "",
                  }))
                }
              >
                <SelectTrigger className="w-[140px] shrink-0">
                  <SelectValue placeholder="Bank..." />
                </SelectTrigger>
                <SelectContent>
                  {INDONESIAN_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Nomor rekening"
                value={pending?.accountNumber ?? ""}
                onChange={(e) =>
                  setPending((prev) => ({
                    ...(prev ?? { bankName: "", accountHolder: "" }),
                    accountNumber: e.target.value,
                  }))
                }
                className="flex-1"
              />
            </div>
            <Input
              placeholder="Atas nama"
              value={pending?.accountHolder ?? ""}
              onChange={(e) =>
                setPending((prev) => ({
                  ...(prev ?? { bankName: "", accountNumber: "" }),
                  accountHolder: e.target.value,
                }))
              }
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!editing && !hasBankInfo && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { setEditing(true); setPending({ bankName: "", accountNumber: "", accountHolder: "" }) }}
              className="gap-1.5"
            >
              <Building2 className="size-3.5" />
              Tambah Rekening
            </Button>
          )}

          {!editing && hasBankInfo && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { setEditing(true); setPending(bankInfo) }}
              className="gap-1.5"
            >
              <Building2 className="size-3.5" />
              Ubah
            </Button>
          )}

          {editing && (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!pending?.bankName || !pending?.accountNumber || !pending?.accountHolder}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              Simpan
            </Button>
          )}

          {editing && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setPending(null); setEditing(false) }}
            >
              Batal
            </Button>
          )}

          {hasBankInfo && !editing && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive gap-1.5"
              onClick={clearBankInfo}
            >
              <Trash2 className="size-3.5" />
              Hapus
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatAccountNumber(number: string) {
  return number.replace(/(\d{4})/g, "$1 ").trim()
}
