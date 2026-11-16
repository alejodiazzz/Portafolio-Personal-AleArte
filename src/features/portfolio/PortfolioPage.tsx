import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toUserMessage } from '../../lib/errors'
import { priceLabel } from '../../lib/price'
import { useAsync } from '../../lib/useAsync'
import { portfolioApi, type ArtworkCard } from './api'
import { ArtworkImage } from './ArtworkImage'
import { ContactLinks } from './ContactLinks'

export function PortfolioPage() {
  const [params] = useSearchParams()
  const categorySlug = params.get('categoria') ?? undefined
  const categories = useAsync(() => portfolioApi.listCategories(), [])

  const [items, setItems] = useState<ArtworkCard[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    portfolioApi.listArtworks({ page, categorySlug }).then(
      (r) => {
        if (!alive) return
        setItems((prev) => (page === 0 ? r.items : [...prev, ...r.items]))
        setHasMore(r.hasMore)
        setLoading(false)
      },
      (e) => {
        if (!alive) return
        setError(toUserMessage(e))
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [page, categorySlug])

  // Al cambiar de categoría, volver a la primera página.
  useEffect(() => setPage(0), [categorySlug])

  return (
    <main>
      <h1>Ale Arte</h1>
      <nav aria-label="Categorías">
        <Link to="/">Todas</Link>
        {categories.status === 'ok' &&
          categories.data.map((c) => (
            <span key={c.id}>
              {' · '}
              <Link to={`/?categoria=${encodeURIComponent(c.slug)}`} aria-current={c.slug === categorySlug ? 'page' : undefined}>
                {c.name}
              </Link>
            </span>
          ))}
      </nav>

      {error && <p role="alert">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No hay obras en esta categoría todavía.</p>}

      <ul>
        {items.map((a) => (
          <li key={a.id}>
            <Link to={`/obra/${a.slug}`}>
              <ArtworkImage image={a.cover} sizes="(max-width: 600px) 100vw, 400px" fallbackAlt={a.title} />
              <span>{a.title}</span>
            </Link>{' '}
            — {priceLabel(a)}
          </li>
        ))}
      </ul>

      {loading && <p>Cargando…</p>}
      {hasMore && !loading && (
        <button type="button" onClick={() => setPage((p) => p + 1)}>
          Cargar más
        </button>
      )}
      <ContactLinks />
    </main>
  )
}
