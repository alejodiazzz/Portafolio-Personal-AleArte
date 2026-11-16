// Validación y preparación de imágenes en el navegador del administrador.

export const MAX_INPUT_BYTES = 15 * 1024 * 1024
export const MAX_DIMENSION = 2560
export const WEBP_QUALITY = 0.9
export type ImageType = 'jpeg' | 'png' | 'webp'

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len))

/** Tipo real por "magic bytes" (no confía en la extensión ni en file.type). */
export function detectImageType(b: Uint8Array): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'png'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp'
  return null
}

export async function validateImageFile(file: File): Promise<{ ok: true } | { ok: false; reason: 'type' | 'size' }> {
  if (file.size > MAX_INPUT_BYTES) return { ok: false, reason: 'size' }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  return detectImageType(head) ? { ok: true } : { ok: false, reason: 'type' }
}

/** Reescala (lado mayor ≤ 2560 px) y convierte a WebP q0.9. */
export async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', WEBP_QUALITY))
  if (!blob || blob.type !== 'image/webp') throw new Error('El navegador no pudo convertir a WebP')
  return { blob, width, height }
}
