import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { imageUrl, zoomImageUrl } from '../../lib/cloudinary'
import type { ArtworkImage } from '../../types'
import { clampView, MAX_SCALE, zoomAt, type View } from './zoom'

const STEP = 1.6
const TAP_MS = 300

/**
 * Visor a pantalla completa para ver detalles: pellizcar, doble toque, rueda del mouse y arrastre.
 * Teclado: + / − / 0 / Escape. Empieza con la imagen ya cargada y cambia a alta resolución al llegar.
 */
export function ZoomViewer({ image, title, alt, onClose }: { image: ArtworkImage; title: string; alt: string; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 })
  const [src, setSrc] = useState(() => imageUrl(image.storage_path, 1600))
  const [hiRes, setHiRes] = useState(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const lastTap = useRef({ t: 0, x: 0, y: 0 })

  // Medidas: la imagen ajustada a 1× (offsetWidth ignora el transform) y la caja visible.
  const sizes = () => {
    const box = boxRef.current?.getBoundingClientRect()
    const img = imgRef.current
    return {
      base: { w: img?.offsetWidth ?? 0, h: img?.offsetHeight ?? 0 },
      box: { w: box?.width ?? 0, h: box?.height ?? 0 },
      center: { x: (box?.left ?? 0) + (box?.width ?? 0) / 2, y: (box?.top ?? 0) + (box?.height ?? 0) / 2 },
    }
  }
  const zoomBy = (factor: number, clientX?: number, clientY?: number) => {
    const { base, box, center } = sizes()
    const p = clientX == null ? { x: 0, y: 0 } : { x: clientX - center.x, y: clientY! - center.y }
    setView((v) => zoomAt(v, factor, p, base, box))
  }
  const reset = () => setView({ s: 1, x: 0, y: 0 })

  // Alta resolución en segundo plano.
  useEffect(() => {
    const hi = new Image()
    hi.onload = () => { setSrc(hi.src); setHiRes(true) }
    hi.src = zoomImageUrl(image.storage_path)
  }, [image.storage_path])

  // Foco, teclado y bloqueo del scroll de fondo.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') zoomBy(STEP)
      else if (e.key === '-') zoomBy(1 / STEP)
      else if (e.key === '0') reset()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
    // zoomBy solo lee refs y usa setView funcional: no necesita ser dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  // Rueda: listener nativo no pasivo para poder evitar el scroll de la página.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY)
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPointerDown(e: RPointerEvent) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  function onPointerMove(e: RPointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const pts = [...pointers.current.values()]
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const { base, box, center } = sizes()
    if (pts.length >= 2) {
      // Pellizco: escala por la razón de distancias y desplaza con el punto medio.
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)![1]
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y)
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      if (d0 < 1) return
      const mid = { x: (e.clientX + other.x) / 2 - center.x, y: (e.clientY + other.y) / 2 - center.y }
      const dx = (e.clientX - prev.x) / 2, dy = (e.clientY - prev.y) / 2
      setView((v) => {
        const z = zoomAt(v, d1 / d0, mid, base, box)
        return clampView({ ...z, x: z.x + dx, y: z.y + dy }, base, box)
      })
    } else {
      setView((v) => (v.s > 1 ? clampView({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }, base, box) : v))
    }
  }
  function onPointerUp(e: RPointerEvent) {
    const start = pointers.current.get(e.pointerId)
    pointers.current.delete(e.pointerId)
    if (!start || pointers.current.size > 0) return
    // Doble toque / doble clic: alterna entre 1× y 2,5× en ese punto.
    const now = performance.now(), t = lastTap.current
    if (now - t.t < TAP_MS && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) {
      lastTap.current = { t: 0, x: 0, y: 0 }
      if (view.s > 1.05) reset()
      else zoomBy(2.5, e.clientX, e.clientY)
    } else lastTap.current = { t: now, x: e.clientX, y: e.clientY }
  }

  const zoomed = view.s > 1.05
  return (
    <div className="sc-zoom" role="dialog" aria-modal="true" aria-label={`Detalle de ${title}`}>
      <div className="sc-zoom-bar">
        <p className="sc-zoom-title">{title}</p>
        <button ref={closeRef} type="button" className="sc-ghost" onClick={onClose}>Cerrar <span aria-hidden="true">✕</span></button>
      </div>
      <div
        ref={boxRef}
        className={`sc-zoom-box${zoomed ? ' is-zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sc-zoom-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
          <img ref={imgRef} src={src} alt={alt} draggable={false} />
        </div>
      </div>
      <div className="sc-zoom-tools">
        <button type="button" className="sc-arrow" aria-label="Alejar" disabled={view.s <= 1} onClick={() => zoomBy(1 / STEP)}>−</button>
        <button type="button" className="sc-zoom-level" aria-label="Restablecer tamaño" onClick={reset}>{Math.round(view.s * 100)}%</button>
        <button type="button" className="sc-arrow" aria-label="Acercar" disabled={view.s >= MAX_SCALE} onClick={() => zoomBy(STEP)}>+</button>
      </div>
      <p className="sc-zoom-hint" aria-live="polite">
        {hiRes ? 'Pellizca, usa la rueda o haz doble toque (doble clic) para acercar' : 'Cargando alta resolución…'}
      </p>
    </div>
  )
}
