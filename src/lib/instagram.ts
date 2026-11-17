/**
 * Lleva un enlace de publicación de Instagram a la forma canónica que acepta la base:
 * https://www.instagram.com/p|reel|tv/<código>/  (sin parámetros de rastreo).
 * Vacío → null (campo opcional). Cualquier otra cosa → 'invalid'.
 */
export function normalizeInstagramPost(raw: string): string | null | 'invalid' {
  const v = raw.trim()
  if (!v) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
  } catch {
    return 'invalid'
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'invalid'
  if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) return 'invalid'
  const m = url.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reel|tv)\/([A-Za-z0-9_-]{5,64})\/?$/)
  return m ? `https://www.instagram.com/${m[1]}/${m[2]}/` : 'invalid'
}
