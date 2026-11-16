import { Link, useParams } from 'react-router-dom'
import { env } from '../../config/env'
import { priceLabel } from '../../lib/price'
import { useAsync } from '../../lib/useAsync'
import { portfolioApi } from './api'
import { ArtworkImage } from './ArtworkImage'
import { ContactLinks } from './ContactLinks'

const STATUS = { available: 'Disponible', sold: 'Vendida', commission: 'Por encargo' } as const

export function ArtworkPage() {
  const { slug = '' } = useParams()
  const state = useAsync(() => portfolioApi.getArtworkBySlug(slug), [slug])

  if (state.status === 'loading') return <p>Cargando…</p>
  if (state.status === 'error') return <p role="alert">{state.message}</p>
  const a = state.data
  if (!a) return <p>Obra no encontrada</p>

  const [main, ...rest] = a.images
  return (
    <article>
      <p><Link to="/">← Volver al portafolio</Link></p>
      <h1>{a.title}</h1>
      <ArtworkImage image={main ?? null} sizes="(max-width: 900px) 100vw, 900px" fallbackAlt={a.title} priority />
      {rest.map((img) => (
        <ArtworkImage key={img.id} image={img} sizes="(max-width: 900px) 100vw, 900px" fallbackAlt={a.title} />
      ))}
      <dl>
        {a.availability_status !== 'sold' && (
          <>
            <dt>Precio</dt>
            <dd>{priceLabel(a)}</dd>
          </>
        )}
        <dt>Estado</dt>
        <dd>{STATUS[a.availability_status]}</dd>
        {a.height != null && a.width != null && (
          <>
            <dt>Medidas</dt>
            <dd>{`${a.height} × ${a.width} ${a.measurement_unit ?? ''}`.trim()}</dd>
          </>
        )}
        {a.technique && (
          <>
            <dt>Técnica</dt>
            <dd>{a.technique}</dd>
          </>
        )}
      </dl>
      {a.description && <p style={{ whiteSpace: 'pre-line' }}>{a.description}</p>}
      <ContactLinks artworkTitle={a.title} artworkUrl={`${env.siteUrl}/obra/${a.slug}`} />
    </article>
  )
}
