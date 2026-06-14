"use client"

import * as React from "react"
import Image from "next/image"
import QRCode from "qrcode"

type QrisDisplayProps = {
  payload: string
  size?: number
}

export function QrisDisplay({ payload, size = 240 }: QrisDisplayProps) {
  const [result, setResult] = React.useState<{ payload: string; dataUrl: string | null; error: string | null }>({
    payload: "",
    dataUrl: null,
    error: null,
  })

  React.useEffect(() => {
    let cancelled = false

    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
    })
      .then((url) => {
        if (!cancelled) setResult({ payload, dataUrl: url, error: null })
      })
      .catch(() => {
        if (!cancelled) setResult({ payload, dataUrl: null, error: "Gagal membuat QR code" })
      })

    return () => {
      cancelled = true
    }
  }, [payload, size])

  if (result.payload === payload && result.error) {
    return <p className="text-sm text-destructive">{result.error}</p>
  }

  if (result.payload !== payload || !result.dataUrl) {
    return <div className="grid h-60 place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Membuat QR...</div>
  }

  return (
    <div className="grid place-items-center rounded-2xl border bg-background p-3 shadow-sm">
      <Image unoptimized src={result.dataUrl} alt="QRIS dinamis" width={size} height={size} className="rounded-lg" />
    </div>
  )
}
