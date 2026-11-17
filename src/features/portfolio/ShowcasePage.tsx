import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/fraunces/opsz-italic.css'
import '@fontsource-variable/manrope/index.css'
import './showcase.css'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { buildWhatsAppLink, instagramUrl } from '../../config/contact'
import { env } from '../../config/env'
import { imageSrcSet, imageUrl } from '../../lib/cloudinary'
import { isLightColor, safeColor } from '../../lib/color'
import { priceLabel } from '../../lib/price'
import { useAsync } from '../../lib/useAsync'
import type { Category } from '../../types'
import { portfolioApi, type ShowcaseArtwork } from './api'
import { IndexDialog } from './IndexDialog'

const STATUS: Record<ShowcaseArtwork['availability_status'], string> = {
  available: 'Disponible',
  sold: 'Vendida',
  commission: 'Por encargo',
}
const CTA: Record<ShowcaseArtwork['availability_status'], string> = {
  available: 'Lo quiero',
  sold: 'Encarga una similar',
  commission: 'Cotiza la tuya',
}
const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const pad = (n: number) => String(n).padStart(2, '0')
const LEAVE_MS = 700
const PIECE_SIZES = '(max-width: 820px) 92vw, 40vw'

function sizeLabel(a: ShowcaseArtwork): string | null {
  if (a.height == null || a.width == null) return null
  return `${num.format(a.height)} × ${num.format(a.width)}${a.measurement_unit ? ` ${a.measurement_unit}` : ''}`
}

export function ShowcasePage() {
  const state = useAsync(() => Promise.all([portfolioApi.listShowcase(), portfolioApi.listCategories()]), [])
  if (state.status === 'loading') return <Frame color={null}><p className="sc-message">Cargando obras…</p></Frame>
  if (state.status === 'error') return <Frame color={null}><p className="sc-message" role="alert">{state.message}</p></Frame>
  const [works, categories] = state.data
  if (!works.length) return <Frame color={null}><p className="sc-message">Pronto habrá obras aquí.</p></Frame>
  return <Showcase works={works} categories={categories} />
}

/** Contenedor de pantalla completa: color de fondo de la obra y contraste del texto. */
function Frame({ color, children }: { color: string | null; children: React.ReactNode }) {
  const bg = safeColor(color)
  useEffect(() => {
    document.body.style.backgroundColor = bg // evita el blanco al hacer "rebote" en móvil
    return () => { document.body.style.backgroundColor = '' }
  }, [bg])
  return (
    <div data-testid="showcase" className={`sc${isLightColor(bg) ? ' is-light' : ''}`} style={{ '--bg': bg } as CSSProperties}>
      {children}
    </div>
  )
}

function Showcase({ works, categories }: { works: ShowcaseArtwork[]; categories: Category[] }) {
  const { slug } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [indexOpen, setIndexOpen] = useState(false)

  const usedCategories = useMemo(() => categories.filter((c) => works.some((w) => w.category_id === c.id)), [categories, works])
  const activeCat = usedCategories.find((c) => c.slug === search.get('categoria')) ?? null
  const inCat = activeCat ? works.filter((w) => w.category_id === activeCat.id) : works
  // Un enlace a una obra de otra categoría ignora el filtro en lugar de fallar.
  const list = slug && !inCat.some((w) => w.slug === slug) ? works : inCat
  const index = slug ? list.findIndex((w) => w.slug === slug) : 0
  const current = index >= 0 ? list[index] : null

  const go = (target: ShowcaseArtwork, cat: Category | null = activeCat) =>
    navigate(`/obra/${target.slug}${cat ? `?categoria=${cat.slug}` : ''}`, { replace: true })
  const [dir, setDir] = useState<1 | -1>(1)
  const step = (d: 1 | -1) => {
    setDir(d)
    go(list[(index + d + list.length) % list.length])
  }

  // En móvil la barra de categorías se desplaza: mantener visible la activa.
  const pillsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = pillsRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (nav && active) nav.scrollLeft = active.offsetLeft - 16
  }, [activeCat?.id])

  // Teclado (desactivado con el índice abierto: el diálogo maneja Escape).
  useEffect(() => {
    if (indexOpen || !current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Rueda del mouse en escritorio (una obra por gesto).
  const wheelLock = useRef(0)
  useEffect(() => {
    if (indexOpen || !current) return
    const onWheel = (e: WheelEvent) => {
      if (!window.matchMedia?.('(min-width: 821px)').matches) return
      if (Date.now() < wheelLock.current || Math.abs(e.deltaY) < 30) return
      wheelLock.current = Date.now() + 900
      step(e.deltaY > 0 ? 1 : -1)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  })

  useEffect(() => {
    if (current) document.title = `${current.title} · Ale Arte`
  }, [current])

  // Precarga las obras vecinas (ambos sentidos) con el mismo srcset/sizes que <Piece>,
  // para que el navegador descargue exactamente la variante que va a mostrar.
  const next = list.length > 1 && index >= 0 ? list[(index + 1) % list.length] : null
  const prevWork = list.length > 2 && index >= 0 ? list[(index - 1 + list.length) % list.length] : null
  useEffect(() => {
    for (const w of [next, prevWork]) {
      if (!w?.cover) continue
      const img = new Image()
      img.sizes = PIECE_SIZES
      img.srcset = imageSrcSet(w.cover.storage_path)
      img.src = imageUrl(w.cover.storage_path, 1600)
    }
  }, [next, prevWork])

  if (!current)
    return (
      <Frame color={null}>
        <div className="sc-message">
          <p>Esta obra no está disponible.</p>
          <Link className="sc-cta" to="/">Ver todas las obras</Link>
        </div>
      </Frame>
    )

  const url = `${env.siteUrl}/obra/${current.slug}`
  const size = sizeLabel(current)
  const category = categories.find((c) => c.id === current.category_id)
  const price = priceLabel(current)

  return (
    <Frame color={current.cover?.dominant_color ?? null}>
      <div className="sc-stage">
        <header className="sc-header">
          <Link to="/" className="sc-brand">Ale Arte</Link>
          <nav ref={pillsRef} className="sc-pills" aria-label="Categorías">
            <button type="button" aria-pressed={!activeCat} onClick={() => go(works[0], null)}>Todas</button>
            {usedCategories.map((c) => (
              <button key={c.id} type="button" aria-pressed={activeCat?.id === c.id}
                onClick={() => go(works.find((w) => w.category_id === c.id)!, c)}>
                {c.name}
              </button>
            ))}
          </nav>
          <button type="button" className="sc-ghost" aria-haspopup="dialog" onClick={() => setIndexOpen(true)}>
            <span aria-hidden="true">☰</span> Índice
          </button>
        </header>

        <section className="sc-info" aria-live="polite">
          <div className="sc-nav">
            <button type="button" className="sc-arrow" aria-label="Obra anterior" onClick={() => step(-1)}>←</button>
            <button type="button" className="sc-arrow" aria-label="Obra siguiente" onClick={() => step(1)}>→</button>
            <span className="sc-count">{pad(index + 1)} / {pad(list.length)}</span>
          </div>
          <h1 className="sc-title">{current.title}</h1>
          {current.technique && <p className="sc-tech">{current.technique}</p>}
          {current.description && <p className="sc-desc">{current.description}</p>}
          <a className="sc-cta" href={buildWhatsAppLink({ artworkTitle: current.title, artworkUrl: url })} target="_blank" rel="noopener noreferrer">
            {CTA[current.availability_status]} <span aria-hidden="true">→</span>
          </a>
        </section>

        <Artwork current={current} dir={dir} onSwipe={step} />

        <aside className="sc-side">
          <p className="sc-price">
            {current.availability_status === 'available' && current.price != null ? price.replace(/ COP$/, '') : price}
            {current.availability_status === 'available' && current.price != null && <small> COP</small>}
          </p>
          <p className={`sc-status is-${current.availability_status}`}><i aria-hidden="true" />{STATUS[current.availability_status]}</p>
          <dl className="sc-specs">
            {size && <div><dt>Medidas</dt><dd>{size}</dd></div>}
            {category && <div><dt>Categoría</dt><dd>{category.name}</dd></div>}
          </dl>
        </aside>

        <footer className="sc-footer">
          <div className="sc-social">
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a>
            <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
          <p className="sc-motto">Arte hecho a mano,<br />pensado para quedarse.</p>
          {next && (
            <button type="button" className="sc-next" onClick={() => step(1)} aria-label={`Siguiente: ${next.title}`}>
              <span aria-hidden="true">Siguiente</span>
              {next.cover && <img src={imageUrl(next.cover.storage_path, 400)} alt="" width={56} height={56} />}
            </button>
          )}
        </footer>
      </div>

      {indexOpen && (
        <IndexDialog
          works={list}
          onClose={() => setIndexOpen(false)}
          onPick={(w) => {
            setIndexOpen(false)
            setDir(1)
            go(w)
          }}
        />
      )}
    </Frame>
  )
}

/** La obra "colgada": entra en arco y la anterior sale; deslizar en móvil. */
function Artwork({ current, dir, onSwipe }: { current: ShowcaseArtwork; dir: 1 | -1; onSwipe: (d: 1 | -1) => void }) {
  const [leaving, setLeaving] = useState<{ work: ShowcaseArtwork; dir: 1 | -1 } | null>(null)
  const prev = useRef(current)
  useEffect(() => {
    if (prev.current.id === current.id) return
    setLeaving({ work: prev.current, dir })
    prev.current = current
    const t = setTimeout(() => setLeaving(null), LEAVE_MS)
    return () => clearTimeout(t)
  }, [current, dir])

  const touchX = useRef<number | null>(null)
  return (
    <div
      className="sc-art"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const d = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(d) > 50) onSwipe(d < 0 ? 1 : -1)
      }}
    >
      {leaving && <Piece key={`out-${leaving.work.id}`} work={leaving.work} className={`is-out${leaving.dir < 0 ? ' is-back' : ''}`} />}
      <Piece key={current.id} work={current} className={`is-in${dir < 0 ? ' is-back' : ''}`} priority />
    </div>
  )
}

function Piece({ work, className, priority = false }: { work: ShowcaseArtwork; className: string; priority?: boolean }) {
  const img = work.cover
  // La entrada se pausa hasta que la imagen carga: si no, se anima un marco vacío.
  const [loaded, setLoaded] = useState(!img || className.includes('is-out'))
  const markLoaded = () => setLoaded(true)
  return (
    <div className={`sc-piece ${className}${loaded ? '' : ' is-loading'}`} aria-hidden={className.includes('is-out') || undefined}>
      <figure>
        {img ? (
          <img
            ref={(el) => { if (el?.complete && el.naturalWidth > 0) markLoaded() }}
            onLoad={markLoaded}
            onError={markLoaded}
            src={imageUrl(img.storage_path, 1600)}
            srcSet={imageSrcSet(img.storage_path)}
            sizes={PIECE_SIZES}
            alt={img.image_alt ?? `${work.title}${work.technique ? `, ${work.technique}` : ''}`}
            width={img.width ?? undefined}
            height={img.height ?? undefined}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
          />
        ) : (
          <div className="sc-noimg" role="img" aria-label="Sin imagen">Sin imagen</div>
        )}
      </figure>
      <div className="sc-floor" aria-hidden="true" />
    </div>
  )
}
