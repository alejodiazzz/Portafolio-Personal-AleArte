import { env } from './env'

const GENERIC_MESSAGE = 'Hola, quiero información sobre las obras de Ale Arte.'

export function buildWhatsAppLink(opts?: { artworkTitle?: string; artworkUrl?: string }): string {
  let message = GENERIC_MESSAGE
  if (opts?.artworkTitle) {
    message = `Hola, me interesa la obra "${opts.artworkTitle}"`
    if (opts.artworkUrl) message += `: ${opts.artworkUrl}`
  }
  return `https://wa.me/${env.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export const instagramUrl: string = env.instagramUrl
