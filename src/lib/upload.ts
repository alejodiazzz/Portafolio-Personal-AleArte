import type { ArtworkImage } from '../types'
import { prepareImage, validateImageFile } from './images'
import { supabase } from './supabase'

type Signature = { cloudName: string; apiKey: string; timestamp: number; publicId: string; signature: string; allowedFormats: string }

export class UploadValidationError extends Error {
  readonly reason: 'type' | 'size'
  constructor(reason: 'type' | 'size') {
    super(reason === 'type' ? 'Formato no permitido (usa JPG, PNG o WebP)' : 'La imagen supera 15 MB')
    this.reason = reason
  }
}

/** Valida → prepara (WebP) → pide firma → sube a Cloudinary → registra en artwork_images. */
export async function uploadArtworkImage(
  artworkId: string,
  file: File,
  alt: string,
  opts: { isCover?: boolean; displayOrder?: number } = {},
): Promise<ArtworkImage> {
  const check = await validateImageFile(file)
  if (!check.ok) throw new UploadValidationError(check.reason)

  const prepared = await prepareImage(file)

  const { data: sig, error: sigError } = await supabase.functions.invoke<Signature>('media-sign', { body: { artworkId } })
  if (sigError || !sig) throw sigError ?? new Error('Sin firma')

  const form = new FormData()
  form.append('file', prepared.blob, 'image.webp')
  form.append('api_key', sig.apiKey)
  form.append('timestamp', String(sig.timestamp))
  form.append('public_id', sig.publicId)
  form.append('allowed_formats', sig.allowedFormats)
  form.append('signature', sig.signature)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Cloudinary ${res.status}`)
  const uploaded = (await res.json()) as { public_id: string; width: number; height: number; format: string; bytes: number }

  const { data, error } = await supabase
    .from('artwork_images')
    .insert({
      artwork_id: artworkId,
      storage_path: uploaded.public_id,
      image_alt: alt.trim() || null,
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format,
      bytes: uploaded.bytes,
      is_cover: opts.isCover ?? false,
      display_order: opts.displayOrder ?? 0,
    })
    .select('*')
    .single()
  if (error) throw error // el archivo queda huérfano → lo recoge media-cleanup
  return data as ArtworkImage
}
