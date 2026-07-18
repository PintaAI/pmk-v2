import { useStoredImage } from "@/hooks/use-stored-image"

export function useProductImage(imageUrl: string | null): string | null {
  return useStoredImage(imageUrl)
}
