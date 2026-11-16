// Utilidades puras de Cloudinary (sin imports: usables desde Deno y desde Vitest).

const EXCLUDED = new Set(['file', 'api_key', 'resource_type', 'cloud_name'])
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PUBLIC_ID_RE = new RegExp(`^ale-arte/artworks/${UUID}/${UUID}$`)
export const UUID_RE = new RegExp(`^${UUID}$`)
export const ARTWORKS_PREFIX = 'ale-arte/artworks/'

/** Firma de Cloudinary: SHA-1 hex de "k=v&k2=v2" (orden alfabético) + api_secret. */
export async function signParams(params: Record<string, string | number>, apiSecret: string): Promise<string> {
  const toSign = Object.keys(params)
    .filter((k) => !EXCLUDED.has(k) && params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign + apiSecret))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function buildPublicId(artworkId: string, uuid: string): string {
  return `${ARTWORKS_PREFIX}${artworkId}/${uuid}`
}

export function isValidPublicId(id: string): boolean {
  return PUBLIC_ID_RE.test(id)
}
