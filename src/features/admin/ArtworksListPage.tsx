import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { imageUrl } from '../../lib/cloudinary'
import { toUserMessage } from '../../lib/errors'
import { moveTo } from '../../lib/order'
import type { Artwork, Category } from '../../types'
import { adminApi } from './api'

const AVAIL = { available: 'Disponible', sold: 'Vendida', commission: 'Por encargo' } as const

export function ArtworksListPage() {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [covers, setCovers] = useState<Map<string, string>>(new Map())
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  // Arrastre en curso: la obra y el orden que se ve mientras se arrastra.
  const [drag, setDrag] = useState<{ id: string; ids: string[] } | null>(null)
  const [announce, setAnnounce] = useState('')
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())

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
  /** Guarda el nuevo lugar; la lista cambia al instante y se recarga desde la base al terminar. */
  function place(id: string, to: number) {
    const ids = artworks.map((a) => a.id)
    const next = moveTo(ids, id, to)
    if (next.every((x, n) => x === ids[n])) return
    setArtworks(next.map((x) => artworks.find((a) => a.id === x)!))
    const title = artworks.find((a) => a.id === id)?.title
    setAnnounce(`${title}: posición ${next.indexOf(id) + 1} de ${next.length}`)
    void run(() => adminApi.placeArtwork(id, next.indexOf(id)))
  }

  // Arrastre con eventos de puntero: funciona con mouse y con el dedo (el arrastre nativo no sirve en táctil).
  // Se escucha en la ventana: al reordenar en vivo la fila cambia de lugar en el DOM y la manija pierde la captura.
  const dragRef = useRef<{ id: string; ids: string[] } | null>(null)
  const placeRef = useRef(place)
  useEffect(() => { placeRef.current = place })
  const stopRef = useRef<() => void>(() => {})
  useEffect(() => () => stopRef.current(), [])

  function onDragStart(e: PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0 || dragRef.current) return
    e.preventDefault()
    dragRef.current = { id, ids: artworks.map((a) => a.id) }
    setDrag(dragRef.current)
    const move = (ev: globalThis.PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      // Posición = cuántas de las otras filas tienen su mitad por encima del puntero.
      const to = d.ids.filter((x) => x !== d.id).filter((x) => {
        const r = rowRefs.current.get(x)?.getBoundingClientRect()
        return r && r.top + r.height / 2 < ev.clientY
      }).length
      const ids = moveTo(d.ids, d.id, to)
      if (ids.some((x, n) => x !== d.ids[n])) setDrag((dragRef.current = { id: d.id, ids }))
      // Cerca del borde de la ventana, desplaza para poder llevarla lejos.
      if (ev.clientY < 60) window.scrollBy?.(0, -12)
      else if (ev.clientY > window.innerHeight - 60) window.scrollBy?.(0, 12)
    }
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      stopRef.current = () => {}
    }
    const end = () => {
      stop()
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (d) placeRef.current(d.id, d.ids.indexOf(d.id))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    stopRef.current = stop
  }
  function onHandleKey(e: KeyboardEvent<HTMLButtonElement>, i: number, id: string) {
    const to = { ArrowUp: i - 1, ArrowDown: i + 1, Home: 0, End: artworks.length - 1 }[e.key]
    if (to === undefined || to < 0 || to >= artworks.length) return
    e.preventDefault()
    place(id, to)
  }
  const shown = drag ? drag.ids.map((x) => artworks.find((a) => a.id === x)!) : artworks

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '—'

  return (
    <main>
      <div className="ad-page-head">
        <div>
          <h1>Obras</h1>
          <p className="ad-hint">{artworks.length} {artworks.length === 1 ? 'obra' : 'obras'} · este orden es el del escaparate. Arrastra <span aria-hidden="true">⠿</span> para cambiarlo.</p>
        </div>
        <Link className="ad-btn" to="/admin/obras/nueva">+ Nueva obra</Link>
      </div>
      {message && <p role="alert">{message}</p>}
      <p className="ad-sr" aria-live="polite">{announce}</p>
      <div className="ad-works">
      <table>
        <thead>
          <tr><th>Orden</th><th>Título</th><th>Categoría</th><th>Publicación</th><th>Disponibilidad</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          {shown.map((a, i) => (
            <tr key={a.id} ref={(el) => { if (el) rowRefs.current.set(a.id, el); else rowRefs.current.delete(a.id) }} className={drag?.id === a.id ? 'is-dragging' : undefined}>
              <td>
                <button
                  type="button"
                  className="ad-drag"
                  aria-label={`Reordenar ${a.title}`}
                  aria-describedby="ad-drag-help"
                  onPointerDown={(e) => onDragStart(e, a.id)}
                  onKeyDown={(e) => onHandleKey(e, i, a.id)}
                >
                  <span aria-hidden="true">⠿</span>
                </button>
                <span className="ad-pos">{i + 1}</span>
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
      <p id="ad-drag-help" className="ad-sr">Arrastra para mover, o usa las flechas arriba y abajo del teclado.</p>
      {artworks.length === 0 && <p className="ad-hint">Aún no hay obras. Crea la primera con «Nueva obra».</p>}
    </main>
  )
}
