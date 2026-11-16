import { imageSrcSet, imageUrl } from '../../lib/cloudinary'
import type { ArtworkImage as Img } from '../../types'

type Props = { image: Pick<Img, 'storage_path' | 'image_alt' | 'width' | 'height'> | null; sizes: string; fallbackAlt: string; priority?: boolean }

export function ArtworkImage({ image, sizes, fallbackAlt, priority = false }: Props) {
  if (!image) return <div role="img" aria-label="Sin imagen">Sin imagen</div>
  return (
    <img
      src={imageUrl(image.storage_path, 800)}
      srcSet={imageSrcSet(image.storage_path)}
      sizes={sizes}
      alt={image.image_alt ?? fallbackAlt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  )
}
