import { useEffect, useRef, useState } from 'react'
import { imageUrl } from '../../lib/cloudinary'
import { priceLabel } from '../../lib/price'
import type { Category } from '../../types'
import type { ShowcaseArtwork } from './api'

/** Cuadrícula de miniaturas para saltar a cualquier obra. Escape cierra; el foco vuelve al botón. */
export function IndexDialog({ works, categories, initialCategory, onClose, onPick }: {
  works: ShowcaseArtwork[]
  categories: Category[]
  initialCategory: Category | null
  onClose: () => void
  onPick: (w: ShowcaseArtwork, category: Category | null) => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [cat, setCat] = useState<Category | null>(initialCategory)
  const shown = cat ? works.filter((w) => w.category_id === cat.id) : works
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [onClose])

  return (
    <div className="sc-index" role="dialog" aria-modal="true" aria-label="Índice de obras">
      <div className="sc-index-head">
        <h2>Obras</h2>
        <button ref={closeRef} type="button" className="sc-ghost" onClick={onClose}>Cerrar <span aria-hidden="true">✕</span></button>
      </div>
      {categories.length > 1 && (
        <div className="sc-index-cats" role="group" aria-label="Filtrar por categoría">
          <button type="button" aria-pressed={!cat} onClick={() => setCat(null)}>Todas</button>
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={cat?.id === c.id} onClick={() => setCat(c)}>{c.name}</button>
          ))}
        </div>
      )}
      <ul className="sc-grid">
        {shown.map((w) => (
          <li key={w.id}>
            <button type="button" onClick={() => onPick(w, cat)}>
              {w.cover ? <img src={imageUrl(w.cover.storage_path, 400)} alt="" loading="lazy" /> : <span className="sc-noimg">Sin imagen</span>}
              <span className="sc-grid-title">{w.title}</span>
              <small>{priceLabel(w)}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
