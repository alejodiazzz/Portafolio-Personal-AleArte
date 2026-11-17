import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { imageUrl } from '../../lib/cloudinary'
import { toUserMessage } from '../../lib/errors'
import type { Artwork, Category } from '../../types'
import { adminApi } from './api'

const AVAIL = { available: 'Disponible', sold: 'Vendida', commission: 'Por encargo' } as const

export function ArtworksListPage() {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [covers, setCovers] = useState<Map<string, string>>(new Map())
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [a, c, cv] = await Promise.all([adminApi.adminListArtworks(), adminApi.listCategories(), adminApi.listCovers()])
    setArtworks(a)
    setCategories(c)
    setCovers(cv)
  }, [])
  useEffect(() => {
    load().catch((e) => setMessage(toUserMessage(e)))
  }, [load])

  async function run(fn: () => Promise<unknown>) {
    setMessage(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setMessage(toUserMessage(e))
    }
  }
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—'

  return (
    <main>
      <div className="ad-page-head">
        <div>
          <h1>Obras</h1>
          <p className="ad-hint">{artworks.length} {artworks.length === 1 ? 'obra' : 'obras'} · este orden es el del escaparate</p>
        </div>
        <Link className="ad-btn" to="/admin/obras/nueva">+ Nueva obra</Link>
      </div>
      {message && <p role="alert">{message}</p>}
      <div className="ad-works">
      <table>
        <thead>
          <tr><th>Orden</th><th>Título</th><th>Categoría</th><th>Publicación</th><th>Disponibilidad</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {artworks.map((a, i) => (
            <tr key={a.id}>
              <td>
                <button type="button" className="ad-icon-btn is-ghost" aria-label="Subir" disabled={i === 0} onClick={() => run(() => adminApi.moveArtwork(a.id, 'up'))}>↑</button>
                <button type="button" className="ad-icon-btn is-ghost" aria-label="Bajar" disabled={i === artworks.length - 1} onClick={() => run(() => adminApi.moveArtwork(a.id, 'down'))}>↓</button>
              </td>
              <td>
                <div className="ad-work">
                  {covers.get(a.id) ? <img src={imageUrl(covers.get(a.id)!, 400)} alt="" loading="lazy" /> : <span className="ad-thumb-empty" />}
                  <Link to={`/admin/obras/${a.id}`}>{a.title}</Link>
                </div>
              </td>
              <td>{catName(a.category_id)}</td>
              <td>
                <span className={`ad-badge${a.publication_status === 'published' ? ' is-live' : ''}`}>{a.publication_status === 'published' ? 'Publicada' : 'Borrador'}</span>
                <button type="button" className="is-ghost is-small" onClick={() => run(() => adminApi.setPublication(a.id, a.publication_status === 'published' ? 'draft' : 'published'))}>
                  {a.publication_status === 'published' ? 'Despublicar' : 'Publicar'}
                </button>
              </td>
              <td>
                <select value={a.availability_status} onChange={(e) => run(() => adminApi.setAvailability(a.id, e.target.value as Artwork['availability_status']))}>
                  {Object.entries(AVAIL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </td>
              <td>
                {confirming === a.id ? (
                  <>
                    <span className="ad-confirm">¿Eliminar obra e imágenes?</span>{' '}<button type="button" className="is-danger is-small" onClick={() => run(() => adminApi.deleteArtwork(a.id)).then(() => setConfirming(null))}>Sí, eliminar</button>{' '}
                    <button type="button" className="is-ghost is-small" onClick={() => setConfirming(null)}>Cancelar</button>
                  </>
                ) : (
                  <button type="button" className="is-ghost is-small" onClick={() => setConfirming(a.id)}>Eliminar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {artworks.length === 0 && <p className="ad-hint">Aún no hay obras. Crea la primera con «Nueva obra».</p>}
    </main>
  )
}
