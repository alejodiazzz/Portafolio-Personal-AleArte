// Llamadas a Cloudinary desde Edge Functions (los secretos nunca salen del servidor).
import { signParams } from './cloudinary.ts'

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string }

export function cloudinaryConfig(): CloudinaryConfig {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary no configurado')
  return { cloudName, apiKey, apiSecret }
}

const base = (c: CloudinaryConfig) => `https://api.cloudinary.com/v1_1/${c.cloudName}`
const basicAuth = (c: CloudinaryConfig) => `Basic ${btoa(`${c.apiKey}:${c.apiSecret}`)}`

/** Borra un recurso (Upload API firmada). true si quedó borrado o no existía. */
export async function destroy(c: CloudinaryConfig, publicId: string): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await signParams({ public_id: publicId, timestamp, invalidate: 'true' }, c.apiSecret)
  const form = new FormData()
  for (const [k, v] of Object.entries({ public_id: publicId, timestamp, invalidate: 'true', api_key: c.apiKey, signature }))
    form.append(k, String(v))
  const res = await fetch(`${base(c)}/image/destroy`, { method: 'POST', body: form })
  if (!res.ok) return false
  const body = await res.json()
  return body.result === 'ok' || body.result === 'not found'
}

/** Borra todos los recursos bajo un prefijo (Admin API). */
export async function deleteByPrefix(c: CloudinaryConfig, prefix: string): Promise<boolean> {
  const url = `${base(c)}/resources/image/upload?prefix=${encodeURIComponent(prefix)}&invalidate=true`
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: basicAuth(c) } })
  return res.ok
}

export type CloudResource = { public_id: string; created_at: string }

/** Lista recursos bajo un prefijo (Admin API, paginado, tope `limit`). */
export async function listByPrefix(c: CloudinaryConfig, prefix: string, limit = 500): Promise<CloudResource[]> {
  const out: CloudResource[] = []
  let cursor: string | undefined
  do {
    const qs = new URLSearchParams({ prefix, max_results: '500', ...(cursor ? { next_cursor: cursor } : {}) })
    const res = await fetch(`${base(c)}/resources/image/upload?${qs}`, { headers: { Authorization: basicAuth(c) } })
    if (!res.ok) throw new Error(`Cloudinary list ${res.status}`)
    const body = await res.json()
    out.push(...(body.resources as CloudResource[]))
    cursor = body.next_cursor
  } while (cursor && out.length < limit)
  return out.slice(0, limit)
}

/** Borra una lista de public_ids (Admin API, máx. 100 por llamada). */
export async function deleteMany(c: CloudinaryConfig, publicIds: string[]): Promise<number> {
  let deleted = 0
  for (let i = 0; i < publicIds.length; i += 100) {
    const qs = new URLSearchParams()
    publicIds.slice(i, i + 100).forEach((id) => qs.append('public_ids[]', id))
    const res = await fetch(`${base(c)}/resources/image/upload?${qs}`, { method: 'DELETE', headers: { Authorization: basicAuth(c) } })
    if (res.ok) {
      const body = await res.json()
      deleted += Object.values(body.deleted ?? {}).filter((v) => v === 'deleted').length
    }
  }
  return deleted
}
