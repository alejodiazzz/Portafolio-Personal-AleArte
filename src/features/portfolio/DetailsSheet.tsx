import { useEffect, useRef, type ReactNode } from 'react'

/** Hoja inferior con la ficha completa de la obra (la vista móvil solo muestra lo esencial). */
export function DetailsSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
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
    <div className="sc-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sc-sheet" role="dialog" aria-modal="true" aria-label={`Detalles de ${title}`}>
        <div className="sc-sheet-grip" aria-hidden="true" />
        <div className="sc-sheet-head">
          <h2>{title}</h2>
          <button ref={closeRef} type="button" className="sc-ghost" onClick={onClose}>Cerrar <span aria-hidden="true">✕</span></button>
        </div>
        {children}
      </div>
    </div>
  )
}
