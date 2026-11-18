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
import type { Auction, Category } from '../../types'
import { portfolioApi, type ShowcaseArtwork } from './api'
import { auctionView, formatCountdown, money, useLiveAuction, useNow } from './auction'
import { BidDialog } from './BidDialog'
import { BrandIcon } from './BrandIcon'
import { DetailsSheet } from './DetailsSheet'
import { IndexDialog } from './IndexDialog'
import { ZoomViewer } from './ZoomViewer'

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
  const [bidOpen, setBidOpen] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const anyDialog = indexOpen || bidOpen || zoomOpen || infoOpen

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

  // Teclado (desactivado con un diálogo abierto: las flechas también mueven el cursor en los campos).
  useEffect(() => {
    if (anyDialog || !current) return
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
    if (anyDialog || !current) return
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
      img.srcset = imageSrcSet(w.cover.storage_path, w.cover.width)
      img.src = imageUrl(w.cover.storage_path, 1600)
      // Decodificar de antemano: en el celular, decodificar al llegar es lo que dejaba el marco vacío.
      img.decode?.().catch(() => {})
    }
  }, [next, prevWork])

  const [auction, setAuction] = useLiveAuction(current?.auction ?? null)

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
          <SubLine work={current} auction={auction} />
          {current.technique && <p className="sc-tech">{current.technique}</p>}
          {current.description && <p className="sc-desc">{current.description}</p>}
          <div className="sc-actions">
            {auction ? (
              <AuctionCta auction={auction} onBid={() => setBidOpen(true)} whatsapp={buildWhatsAppLink({ artworkTitle: current.title, artworkUrl: url })} />
            ) : (
              <a className="sc-cta" href={buildWhatsAppLink({ artworkTitle: current.title, artworkUrl: url })} target="_blank" rel="noopener noreferrer">
                {CTA[current.availability_status]} <span aria-hidden="true">→</span>
              </a>
            )}
            {/* Solo visible en móvil: abre la ficha completa. */}
            <button type="button" className="sc-more" aria-label="Detalles de la obra" aria-haspopup="dialog" onClick={() => setInfoOpen(true)}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 11v6M12 7.2v.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {current.instagram_url && (
            <a className="sc-ig" href={current.instagram_url} target="_blank" rel="noopener noreferrer">
              <BrandIcon name="instagram" size={16} /> Ver en Instagram
            </a>
          )}
        </section>

        <Artwork current={current} dir={dir} onSwipe={step} onZoom={() => setZoomOpen(true)} />

        <aside className="sc-side">
          {auction ? <AuctionSide auction={auction} /> : <>
          <p className="sc-price">
            {current.availability_status === 'available' && current.price != null ? price.replace(/ COP$/, '') : price}
            {current.availability_status === 'available' && current.price != null && <small> COP</small>}
          </p>
          <p className={`sc-status is-${current.availability_status}`}><i aria-hidden="true" />{STATUS[current.availability_status]}</p>
          </>}
          <dl className="sc-specs">
            {size && <div><dt>Medidas</dt><dd>{size}</dd></div>}
            {category && <div><dt>Categoría</dt><dd>{category.name}</dd></div>}
          </dl>
        </aside>

        <footer className="sc-footer">
          <div className="sc-social">
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><BrandIcon name="instagram" /></a>
            {env.tiktokUrl && <a href={env.tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok"><BrandIcon name="tiktok" /></a>}
            <a href={buildWhatsAppLink()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><BrandIcon name="whatsapp" /></a>
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

      {infoOpen && (
        <DetailsSheet title={current.title} onClose={() => setInfoOpen(false)}>
          {current.technique && <p className="sc-tech">{current.technique}</p>}
          <div className="sc-sheet-price">
            {auction ? <AuctionSide auction={auction} /> : <>
              <p className="sc-price">{price}</p>
              <p className={`sc-status is-${current.availability_status}`}><i aria-hidden="true" />{STATUS[current.availability_status]}</p>
            </>}
          </div>
          {current.description && <p className="sc-desc">{current.description}</p>}
          <dl className="sc-specs">
            {size && <div><dt>Medidas</dt><dd>{size}</dd></div>}
            {category && <div><dt>Categoría</dt><dd>{category.name}</dd></div>}
          </dl>
          {current.instagram_url && (
            <a className="sc-ig" href={current.instagram_url} target="_blank" rel="noopener noreferrer">
              <BrandIcon name="instagram" size={16} /> Ver en Instagram
            </a>
          )}
        </DetailsSheet>
      )}

      {zoomOpen && current.cover && (
        <ZoomViewer
          image={current.cover}
          title={current.title}
          alt={current.cover.image_alt ?? `${current.title}${current.technique ? `, ${current.technique}` : ''}`}
          onClose={() => setZoomOpen(false)}
        />
      )}

      {bidOpen && auction && (
        <BidDialog
          artworkId={current.id}
          title={current.title}
          minNext={auctionView(auction, 0).minNext}
          onClose={() => setBidOpen(false)}
          onPlaced={(r) => setAuction({ ...auction, current_amount: r.currentAmount, bid_count: r.bidCount, ends_at: r.endsAt })}
        />
      )}

      {indexOpen && (
        <IndexDialog
          works={works}
          categories={usedCategories}
          initialCategory={activeCat}
          onClose={() => setIndexOpen(false)}
          onPick={(w, cat) => {
            setIndexOpen(false)
            setDir(1)
            go(w, cat)
          }}
        />
      )}
    </Frame>
  )
}

/** Línea breve bajo el título (vista móvil): técnica y precio, o el estado de la subasta. */
function SubLine({ work, auction }: { work: ShowcaseArtwork; auction: Auction | null }) {
  if (auction) return <AuctionLine auction={auction} />
  const price = work.availability_status === 'available' && work.price != null ? priceLabel(work) : STATUS[work.availability_status]
  return <p className="sc-sub">{[work.technique, price].filter(Boolean).join(' · ')}</p>
}
function AuctionLine({ auction }: { auction: Auction }) {
  const v = auctionView(auction, useNow())
  return (
    <p className="sc-sub" aria-live="off">
      {v.open ? `Subasta · ${money(v.amount)} · cierra en ${formatCountdown(v.msLeft)}` : `Subasta cerrada · ${money(v.amount)}`}
    </p>
  )
}

const offers = (n: number) => `${n} ${n === 1 ? 'oferta' : 'ofertas'}`
const closedAt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

/** Monto, estado y cuenta regresiva de la subasta (se actualiza cada segundo). */
function AuctionSide({ auction }: { auction: Auction }) {
  const v = auctionView(auction, useNow())
  const caption = v.hasBids
    ? `${v.open ? 'Oferta actual' : 'Oferta final'} · ${offers(auction.bid_count)}`
    : v.open ? 'Precio base · aún sin ofertas' : 'Sin ofertas'
  return (
    <>
      <p className="sc-price">{money(v.amount)}<small> COP</small></p>
      <p className="sc-bidinfo">{caption}</p>
      <p className={`sc-status ${v.open ? 'is-auction' : 'is-sold'}`}><i aria-hidden="true" />{v.open ? 'En subasta' : 'Subasta cerrada'}</p>
      <p className="sc-countdown" aria-live="off">
        {v.open ? `Cierra en ${formatCountdown(v.msLeft)}` : `Cerró el ${closedAt.format(new Date(auction.ends_at))}`}
      </p>
    </>
  )
}

function AuctionCta({ auction, onBid, whatsapp }: { auction: Auction; onBid: () => void; whatsapp: string }) {
  const open = auctionView(auction, useNow()).open
  return open ? (
    <button type="button" className="sc-cta" aria-haspopup="dialog" onClick={onBid}>Ofertar <span aria-hidden="true">→</span></button>
  ) : (
    <a className="sc-cta" href={whatsapp} target="_blank" rel="noopener noreferrer">Me interesa <span aria-hidden="true">→</span></a>
  )
}

/** La obra "colgada": entra en arco y la anterior sale; deslizar en móvil. */
function Artwork({ current, dir, onSwipe, onZoom }: { current: ShowcaseArtwork; dir: 1 | -1; onSwipe: (d: 1 | -1) => void; onZoom: () => void }) {
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
      <Piece key={current.id} work={current} className={`is-in${dir < 0 ? ' is-back' : ''}`} priority onZoom={onZoom} />
      {current.cover && (
        // Botón explícito: en el celular, tocar la obra no la abre (se confundiría con deslizar).
        <button type="button" className="sc-zoom-btn" aria-haspopup="dialog" onClick={onZoom}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Ver detalle
        </button>
      )}
    </div>
  )
}

const FINE_POINTER = '(hover: hover) and (pointer: fine)'

function Piece({ work, className, priority = false, onZoom }: { work: ShowcaseArtwork; className: string; priority?: boolean; onZoom?: () => void }) {
  const img = work.cover
  // La entrada se pausa hasta que la imagen carga: si no, se anima un marco vacío.
  const [loaded, setLoaded] = useState(!img || className.includes('is-out'))
  const markLoaded = () => setLoaded(true)
  // "Cargada" = descargada y decodificada (lista para pintarse). Tope de 1,5 s para no quedarse esperando.
  const whenReady = (el: HTMLImageElement) => {
    if (loaded) return
    if (!el.decode) return markLoaded()
    const t = setTimeout(markLoaded, 1500)
    el.decode().catch(() => {}).finally(() => { clearTimeout(t); markLoaded() })
  }
  return (
    <div className={`sc-piece ${className}${loaded ? '' : ' is-loading'}`} aria-hidden={className.includes('is-out') || undefined}>
      {/* En escritorio, clic en la obra también abre el visor. */}
      <figure onClick={() => onZoom && img && window.matchMedia?.(FINE_POINTER).matches && onZoom()}>
        {img ? (
          <img
            ref={(el) => { if (el?.complete && el.naturalWidth > 0) whenReady(el) }}
            onLoad={(e) => whenReady(e.currentTarget)}
            onError={markLoaded}
            src={imageUrl(img.storage_path, 1600)}
            srcSet={imageSrcSet(img.storage_path, img.width)}
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
