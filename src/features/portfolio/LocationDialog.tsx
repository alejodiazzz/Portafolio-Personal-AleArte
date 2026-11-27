import { useEffect, useRef } from 'react'

type LocationDialogProps = {
  title: string
  locationName: string | null
  latitude: number
  longitude: number
  onClose: () => void
}

export function LocationDialog({ title, locationName, latitude, longitude, onClose }: LocationDialogProps) {
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

  // Delimitación pequeña alrededor de las coordenadas para el iframe de OpenStreetMap
  const delta = 0.005
  const minLon = longitude - delta
  const minLat = latitude - delta
  const maxLon = longitude + delta
  const maxLat = latitude + delta
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${latitude}%2C${longitude}`
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`

  return (
    <div className="sc-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sc-sheet sc-map-modal" role="dialog" aria-modal="true" aria-label={`Ubicación de ${title}`}>
        <div className="sc-sheet-grip" aria-hidden="true" />
        <div className="sc-sheet-head">
          <div>
            <h2>Ubicación del mural</h2>
            <p className="sc-map-sub">{title}{locationName ? ` · ${locationName}` : ''}</p>
          </div>
          <button ref={closeRef} type="button" className="sc-ghost" onClick={onClose}>
            Cerrar <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="sc-map-frame-wrap">
          <iframe
            title={`Mapa de ${title}`}
            src={osmEmbedUrl}
            className="sc-map-iframe"
            loading="lazy"
          />
        </div>

        <div className="sc-map-actions">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sc-cta"
          >
            Abrir en Google Maps / Waze <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
  )
}
