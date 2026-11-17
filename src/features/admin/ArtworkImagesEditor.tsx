import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { imageUrl } from '../../lib/cloudinary'
import { toUserMessage } from '../../lib/errors'
import { UploadValidationError } from '../../lib/upload'
import type { ArtworkImage } from '../../types'
import { adminApi } from './api'

const describe = (e: unknown) => (e instanceof UploadValidationError ? e.message : toUserMessage(e))

export function ArtworkImagesEditor({ artworkId, defaultAlt }: { artworkId: string; defaultAlt: string }) {
  const [images, setImages] = useState<ArtworkImage[]>([])
  const [progress, setProgress] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await adminApi.adminGetArtwork(artworkId)
    setImages(r?.images ?? [])
  }, [artworkId])
  useEffect(() => {
    load().catch((e) => setMessage(toUserMessage(e)))
  }, [load])

  async function run(fn: () => Promise<unknown>) {
    setMessage(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setMessage(describe(e))
    }
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    let order = images.length
    for (const file of files) {
      setProgress((p) => [...p, `Subiendo ${file.name}…`])
      try {
        await adminApi.uploadImage(artworkId, file, defaultAlt, { isCover: images.length === 0 && order === 0, displayOrder: order++ })
        setProgress((p) => [...p, `✓ ${file.name}`])
      } catch (err) {
        setProgress((p) => [...p, `✗ ${file.name}: ${describe(err)}`])
      }
    }
    await load()
  }

  return (
    <section className="ad-card">
      <div className="ad-card-head"><h2>Imágenes</h2></div>
      <p className="ad-upload">
        <label>
          Agregar imágenes (JPG, PNG o WebP, máx. 15 MB){' '}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} />
        </label>
      </p>
      {progress.length > 0 && <ul aria-live="polite">{progress.map((p, i) => <li key={i}>{p}</li>)}</ul>}
      {message && <p role="alert">{message}</p>}
      <ol className="ad-images">
        {images.map((img, i) => (
          <li key={img.id}>
            <img src={imageUrl(img.storage_path, 400)} alt={img.image_alt ?? ''} width={160} loading="lazy" />
            {img.is_cover && <span className="ad-badge is-live">Portada</span>}
            <p>
              <label>
                Texto alternativo{' '}
                <input defaultValue={img.image_alt ?? ''} maxLength={250} onBlur={(e) => run(() => adminApi.updateImageAlt(img.id, e.target.value))} />
              </label>
            </p>
            <p className="ad-tools">
              <button type="button" className="ad-icon-btn is-ghost" aria-label="Mover antes" disabled={i === 0} onClick={() => run(() => adminApi.moveImage(img.id, 'up'))}>↑</button>{' '}
              <button type="button" className="ad-icon-btn is-ghost" aria-label="Mover después" disabled={i === images.length - 1} onClick={() => run(() => adminApi.moveImage(img.id, 'down'))}>↓</button>{' '}
              {!img.is_cover && <button type="button" className="is-small" onClick={() => run(() => adminApi.setCover(img.id))}>Marcar como portada</button>}{' '}
              <label>
                Reemplazar{' '}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void run(() => adminApi.replaceImage(img.id, f))
                  }}
                />
              </label>{' '}
              {confirming === img.id ? (
                <>
                  <span className="ad-confirm">¿Eliminar?</span> <button type="button" className="is-danger is-small" onClick={() => run(() => adminApi.deleteImage(img.id)).then(() => setConfirming(null))}>Sí, eliminar</button>{' '}
                  <button type="button" className="is-ghost is-small" onClick={() => setConfirming(null)}>Cancelar</button>
                </>
              ) : (
                <button type="button" className="is-ghost is-small" onClick={() => setConfirming(img.id)}>Eliminar</button>
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
