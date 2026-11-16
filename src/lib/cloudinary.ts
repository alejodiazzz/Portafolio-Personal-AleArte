import { env } from '../config/env'

export const IMAGE_WIDTHS = [400, 800, 1600] as const
export type ImageWidth = (typeof IMAGE_WIDTHS)[number]

export function imageUrl(publicId: string, width: ImageWidth): string {
  return `https://res.cloudinary.com/${env.cloudinaryCloudName}/image/upload/f_auto,q_auto,c_limit,w_${width}/${publicId}`
}

export function imageSrcSet(publicId: string): string {
  return IMAGE_WIDTHS.map((w) => `${imageUrl(publicId, w)} ${w}w`).join(', ')
}
