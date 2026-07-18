"use client"

import { useState, useTransition } from "react"
import { Loader2, Plus } from "lucide-react"
import { createProductCategoryAction } from "@/app/actions/product-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"

export type ProductCategoryOption = {
  id: string
  name: string
}

export function ProductCategoryField({
  categories,
  value,
  onChange,
}: {
  categories: ProductCategoryOption[]
  value: string
  onChange: (categoryId: string, categoryName?: string) => void
}) {
  const { toast } = useToast()
  const [createdCategories, setCreatedCategories] = useState<ProductCategoryOption[]>([])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isPending, startTransition] = useTransition()

  const localCategories = [...categories, ...createdCategories.filter(
    (created) => !categories.some((category) => category.id === created.id),
  )].sort((a, b) => a.name.localeCompare(b.name, "id"))
  const selectedCategoryName = localCategories.find((category) => category.id === value)?.name

  function addCategory() {
    const name = newCategoryName.trim()
    if (!name) return

    startTransition(async () => {
      const result = await createProductCategoryAction({ name })
      if (!result.success) {
        toast("error", result.error)
        return
      }

      setCreatedCategories((current) => [...current, result.data])
      onChange(result.data.id, result.data.name)
      setNewCategoryName("")
      toast("success", "Kategori berhasil ditambahkan.")
    })
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="categoryId" value={value} />
      <label className="text-xs font-medium text-muted-foreground">Kategori (opsional)</label>
      <Select
        value={value || "none"}
        onValueChange={(nextValue) => {
          if (nextValue === null) return
          const category = localCategories.find((item) => item.id === nextValue)
          onChange(nextValue === "none" ? "" : nextValue, category?.name)
        }}
      >
        <SelectTrigger className="w-full">
          <span className="flex flex-1 text-left">{selectedCategoryName ?? "Tanpa kategori"}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Tanpa kategori</SelectItem>
          {localCategories.map((category) => (
            <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input
          value={newCategoryName}
          maxLength={50}
          placeholder="Kategori baru"
          className="min-w-0 flex-1"
          onChange={(event) => setNewCategoryName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addCategory()
            }
          }}
        />
        <Button type="button" variant="outline" disabled={isPending || newCategoryName.trim().length < 2} onClick={addCategory}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Kategori
        </Button>
      </div>
    </div>
  )
}
