import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toUserMessage } from '../../lib/errors'
import type { Artwork, Category } from '../../types'
import { adminApi } from './api'

const AVAIL = { available: 'Disponible', sold: 'Vendida', commission: 'Por encargo' } as const

export function ArtworksListPage() {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [a, c] = await Promise.all([adminApi.adminListArtworks(), adminApi.listCategories()])
    setArtworks(a)
    setCategories(c)
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
      <h1>Obras</h1>
      <p>
        <Link to="/admin/obras/nueva">+ Nueva obra</Link> · <Link to="/admin/categorias">Categorías</Link>
      </p>
      {message && <p role="alert">{message}</p>}
      <table>
        <thead>
          <tr><th>Orden</th><th>Título</th><th>Categoría</th><th>Publicación</th><th>Disponibilidad</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {artworks.map((a, i) => (
            <tr key={a.id}>
              <td>
                <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => run(() => adminApi.moveArtwork(a.id, 'up'))}>↑</button>
                <button type="button" aria-label="Bajar" disabled={i === artworks.length - 1} onClick={() => run(() => adminApi.moveArtwork(a.id, 'down'))}>↓</button>
              </td>
              <td><Link to={`/admin/obras/${a.id}`}>{a.title}</Link></td>
              <td>{catName(a.category_id)}</td>
              <td>
                {a.publication_status === 'published' ? 'Publicada' : 'Borrador'}{' '}
                <button type="button" onClick={() => run(() => adminApi.setPublication(a.id, a.publication_status === 'published' ? 'draft' : 'published'))}>
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
                    ¿Eliminar obra e imágenes? <button type="button" onClick={() => run(() => adminApi.deleteArtwork(a.id)).then(() => setConfirming(null))}>Sí, eliminar</button>{' '}
                    <button type="button" onClick={() => setConfirming(null)}>Cancelar</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirming(a.id)}>Eliminar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {artworks.length === 0 && <p>Aún no hay obras.</p>}
    </main>
  )
}
