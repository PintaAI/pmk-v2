import { useStoredImage } from "@/hooks/use-stored-image"

export function useTokoImage(imageUrl: string | null): string | null {
  return useStoredImage(imageUrl)
}
