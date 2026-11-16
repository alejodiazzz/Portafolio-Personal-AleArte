import { buildWhatsAppLink, instagramUrl } from '../../config/contact'

export function ContactLinks({ artworkTitle, artworkUrl }: { artworkTitle?: string; artworkUrl?: string }) {
  return (
    <p>
      <a href={buildWhatsAppLink({ artworkTitle, artworkUrl })} target="_blank" rel="noopener noreferrer">
        Escribir por WhatsApp
      </a>{' '}
      ·{' '}
      <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
        Ver Instagram
      </a>
    </p>
  )
}
