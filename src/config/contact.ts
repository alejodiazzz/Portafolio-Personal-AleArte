import type { AvailabilityStatus } from '../types'
import { env } from './env'

const GENERIC_MESSAGE = 'Hola, quiero información sobre las obras de Ale Arte.'

/** El mensaje va en línea con el botón: comprar la obra, o pedir una similar si no está a la venta. */
const ARTWORK_MESSAGE: Record<AvailabilityStatus, (title: string) => string> = {
  available: (t) => `Hola, me interesa la obra "${t}"`,
  sold: (t) => `Hola, vi la obra "${t}", que ya fue vendida, y me gustaría encargar una similar. ¿Cuánto costaría?`,
  commission: (t) => `Hola, vi la obra "${t}", que fue un encargo, y me gustaría saber cuánto costaría una similar`,
}

export function buildWhatsAppLink(opts?: { artworkTitle?: string; artworkUrl?: string; status?: AvailabilityStatus }): string {
  let message = GENERIC_MESSAGE
  if (opts?.artworkTitle) {
    message = ARTWORK_MESSAGE[opts.status ?? 'available'](opts.artworkTitle)
    if (opts.artworkUrl) message += `: ${opts.artworkUrl}`
  }
  return `https://wa.me/${env.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export const instagramUrl: string = env.instagramUrl
