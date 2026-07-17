"use client"

import { useState } from "react"
import Image from "next/image"
import { Store } from "lucide-react"
import { useTokoImage } from "@/hooks/use-toko-image"

export function StoreLogo({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const resolvedUrl = useTokoImage(imageUrl)
  const [failed, setFailed] = useState(false)

  if (!resolvedUrl || failed) {
    return <Store className="size-5" aria-hidden="true" />
  }

  return (
    <Image
      src={resolvedUrl}
      alt={`Logo ${name}`}
      fill
      sizes="44px"
      unoptimized
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  )
}
