import type { AxiosProgressEvent } from "axios"

const DEFAULT_UPLOAD_CONCURRENCY = 3
const DEFAULT_MAX_IMAGE_DIMENSION = 1920
const DEFAULT_IMAGE_QUALITY = 0.82
const SKIP_COMPRESSION_BELOW_BYTES = 500 * 1024

export function getUploadPercent(progressEvent: AxiosProgressEvent): number {
  if (!progressEvent.total) {
    return 0
  }

  return Math.min(100, Math.round((progressEvent.loaded * 100) / progressEvent.total))
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }

  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()))
  return results
}

export async function compressImageForUpload(
  file: File,
  options?: {
    maxDimension?: number
    quality?: number
  },
): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SKIP_COMPRESSION_BELOW_BYTES) {
    return file
  }

  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION
  const quality = options?.quality ?? DEFAULT_IMAGE_QUALITY

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) {
      bitmap.close()
      return file
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const outputType = file.type === "image/png" || file.type === "image/webp"
      ? file.type
      : "image/jpeg"

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, quality)
    })

    if (!blob || blob.size >= file.size) {
      return file
    }

    const extension = outputType === "image/png"
      ? "png"
      : outputType === "image/webp"
        ? "webp"
        : "jpg"

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo"
    return new File([blob], `${baseName}.${extension}`, {
      type: outputType,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  }
}

export async function compressImagesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressImageForUpload(file)))
}

export function createByteProgressTracker(
  fileSizes: number[],
  onPercent?: (percent: number) => void,
) {
  const loadedBytes = new Array(fileSizes.length).fill(0)
  const totalBytes = fileSizes.reduce((sum, size) => sum + size, 0)

  const report = () => {
    if (!onPercent || totalBytes <= 0) {
      return
    }

    const loaded = loadedBytes.reduce((sum, size) => sum + size, 0)
    onPercent(Math.min(100, Math.round((loaded * 100) / totalBytes)))
  }

  return {
    update(index: number, loaded: number) {
      loadedBytes[index] = Math.min(fileSizes[index] ?? loaded, loaded)
      report()
    },
    complete(index: number) {
      loadedBytes[index] = fileSizes[index] ?? loadedBytes[index]
      report()
    },
  }
}

export { DEFAULT_UPLOAD_CONCURRENCY }
