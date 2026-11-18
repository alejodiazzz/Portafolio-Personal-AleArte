import { env } from '../config/env'

export const IMAGE_WIDTHS = [400, 800, 1200, 1600] as const
export type ImageWidth = (typeof IMAGE_WIDTHS)[number]

export function imageUrl(publicId: string, width: ImageWidth): string {
  return `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/f_auto,q_auto,c_limit,w_${width}/${publicId}`
}

/**
 * srcset con descriptores honestos: c_limit nunca agranda, así que si el original es más angosto
 * que un ancho de la lista, esa variante se anuncia con el ancho real (y las mayores se omiten).
 * Si se anunciara "1600w" para una foto de 700 px, el navegador la mostraría a menos de la mitad.
 */
export function imageSrcSet(publicId: string, originalWidth?: number | null): string {
  const out: string[] = []
  for (const w of IMAGE_WIDTHS) {
    if (!originalWidth || w < originalWidth) out.push(`${imageUrl(publicId, w)} ${w}w`)
    else { out.push(`${imageUrl(publicId, w)} ${originalWidth}w`); break }
  }
  return out.join(', ')
}

/** Versión grande para el visor de detalle (c_limit: nunca agranda más allá del original). */
export function zoomImageUrl(publicId: string): string {
  return `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/f_auto,q_auto:best,c_limit,w_2560/${publicId}`
}
