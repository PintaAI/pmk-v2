"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

type QuantityStepperProps = {
  value: number
  max: number
  disabledIncrement?: boolean
  onChange: (value: number) => void
}

export function QuantityStepper({
  value,
  max,
  disabledIncrement = false,
  onChange,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-background p-1 ring-1 ring-border">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={value === 0}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon />
        <span className="sr-only">Kurangi</span>
      </Button>
      <span className="w-6 text-center text-sm font-semibold">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabledIncrement || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon />
        <span className="sr-only">Tambah</span>
      </Button>
    </div>
  )
}
