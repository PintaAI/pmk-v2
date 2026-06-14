const MAX_SIZE_BYTES = 900 * 1024
const MAX_DIMENSION = 512
const JPEG_QUALITY = 0.72

type ProcessResult = {
  file: File
  originalSize: number
  processedSize: number
}

export async function processImageForUpload(file: File): Promise<ProcessResult> {
  const originalSize = file.size

  if (originalSize <= MAX_SIZE_BYTES && file.type === "image/jpeg") {
    return { file, originalSize, processedSize: originalSize }
  }

  const bitmap = await createImageBitmap(file)
  const { width, height } = calcDimensions(bitmap.width, bitmap.height, MAX_DIMENSION)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    return { file, originalSize, processedSize: originalSize }
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", JPEG_QUALITY)
  )

  const processedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  })

  return { file: processedFile, originalSize, processedSize: processedFile.size }
}

function calcDimensions(
  w: number,
  h: number,
  maxDim: number
): { width: number; height: number } {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h }
  if (w >= h) {
    return { width: maxDim, height: Math.round((h / w) * maxDim) }
  }
  return { width: Math.round((w / h) * maxDim), height: maxDim }
}
