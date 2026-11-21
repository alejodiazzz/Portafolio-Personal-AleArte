import { env } from '../config/env'

export const IMAGE_WIDTHS = [400, 800, 1200, 1600] as const
export type ImageWidth = (typeof IMAGE_WIDTHS)[number]

/** Opciones de entrega: `cutout` = obra recortada (fondo transparente) con marco que sigue su forma. */
export type ImageOptions = { cutout?: boolean }

/** Color del marco (= --mat en showcase.css). */
const MAT_HEX = 'f6f2ea'
/** Margen transparente y grosor del contorno, en fracción del ancho entregado. El margen evita que se corte. */
const CUTOUT_MARGIN = 0.04
const CUTOUT_OUTLINE = 0.025

function cutoutParts(width: number) {
  const margin = Math.round(width * CUTOUT_MARGIN)
  return { margin, outline: Math.round(width * CUTOUT_OUTLINE), inner: width - 2 * margin }
}

export function imageUrl(publicId: string, width: ImageWidth, opts: ImageOptions = {}): string {
  const base = `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/f_auto,q_auto,c_limit`
  if (!opts.cutout) return `${base},w_${width}/${publicId}`
  // Cloudinary dibuja el contorno siguiendo la transparencia; antes se agrega margen para que quepa.
  const { margin, outline, inner } = cutoutParts(width)
  return `${base},w_${inner}/bo_${margin}px_solid_rgb:00000000/e_outline:outer:${outline}:0,co_rgb:${MAT_HEX}/${publicId}`
}

/** Tamaño final de una obra recortada (para width/height del <img>): el margen se suma a ambos lados. */
export function cutoutSize(width: number, height: number): { width: number; height: number } {
  return { width, height: Math.round(height * (1 - 2 * CUTOUT_MARGIN) + width * 2 * CUTOUT_MARGIN) }
}

/**
 * srcset con descriptores honestos: c_limit nunca agranda, así que si el original es más angosto
 * que un ancho de la lista, esa variante se anuncia con el ancho real (y las mayores se omiten).
 * Si se anunciara "1600w" para una foto de 700 px, el navegador la mostraría a menos de la mitad.
 */
export function imageSrcSet(publicId: string, originalWidth?: number | null, opts: ImageOptions = {}): string {
  const out: string[] = []
  for (const w of IMAGE_WIDTHS) {
    // Con marco recortado, c_limit actúa sobre la obra sin el margen, que luego se suma.
    const { margin, inner } = opts.cutout ? cutoutParts(w) : { margin: 0, inner: w }
    if (!originalWidth || inner < originalWidth) out.push(`${imageUrl(publicId, w, opts)} ${w}w`)
    else { out.push(`${imageUrl(publicId, w, opts)} ${originalWidth + 2 * margin}w`); break }
  }
  return out.join(', ')
}

/** Versión grande para el visor de detalle (c_limit: nunca agranda más allá del original). */
export function zoomImageUrl(publicId: string): string {
  return `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/f_auto,q_auto:best,c_limit,w_2560/${publicId}`
}
