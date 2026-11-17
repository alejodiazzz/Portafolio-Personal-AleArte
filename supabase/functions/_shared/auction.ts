// Lógica pura de la oferta (sin Deno): validación de entrada y texto del aviso por WhatsApp.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export type BidInput = { artworkId: string; amount: number; name: string; email: string; phone: string; captchaToken: string }

/** Teléfono: se quitan espacios, guiones, puntos y paréntesis; queda +? y 7–15 dígitos. */
export function normalizePhone(raw: string): string | null {
  const p = raw.replace(/[\s\-().]/g, '')
  return /^\+?[0-9]{7,15}$/.test(p) ? p : null
}

/** Devuelve la oferta limpia o null si algo no cumple (el detalle no se revela). */
export function parseBid(body: Record<string, unknown> | null): BidInput | null {
  if (!body || body.consent !== true) return null
  const { artworkId, amount, name, email, phone, captchaToken } = body
  if (typeof artworkId !== 'string' || !UUID.test(artworkId)) return null
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0 || amount > 999_999_999_999) return null
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return null
  if (typeof email !== 'string' || email.length > 254 || !EMAIL.test(email.trim())) return null
  if (typeof phone !== 'string' || phone.length > 30) return null
  const cleanPhone = normalizePhone(phone)
  if (!cleanPhone) return null
  if (typeof captchaToken !== 'string' || !captchaToken || captchaToken.length > 2048) return null
  return { artworkId, amount, name: name.trim(), email: email.trim().toLowerCase(), phone: cleanPhone, captchaToken }
}

const cop = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export function bidMessage(b: { title: string; amount: number; bidCount: number; name: string; email: string; phone: string; endsAt: string }): string {
  const ends = new Date(b.endsAt).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
  return [
    `Nueva oferta en "${b.title}"`,
    `$ ${cop.format(b.amount)} COP (oferta n.º ${b.bidCount})`,
    `${b.name} · ${b.phone} · ${b.email}`,
    `Cierra: ${ends}`,
  ].join('\n')
}

export function callMeBotUrl(phone: string, apiKey: string, text: string): string {
  const q = new URLSearchParams({ phone, text, apikey: apiKey })
  return `https://api.callmebot.com/whatsapp.php?${q}`
}
