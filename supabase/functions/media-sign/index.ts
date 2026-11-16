// Firma una subida a Cloudinary para una obra existente. Solo admin con MFA.
import { requireAdmin } from '../_shared/auth.ts'
import { buildPublicId, signParams, UUID_RE } from '../_shared/cloudinary.ts'
import { cloudinaryConfig } from '../_shared/cloudinary-api.ts'
import { fail, json, preflight, readJson } from '../_shared/http.ts'

const ALLOWED_FORMATS = 'webp,jpg,png'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const origin = req.headers.get('origin')
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof Response) return auth

    const body = await readJson(req)
    const artworkId = body?.artworkId
    if (typeof artworkId !== 'string' || !UUID_RE.test(artworkId)) return fail(400, origin)

    const { data: artwork } = await auth.userClient.from('artworks').select('id').eq('id', artworkId).maybeSingle()
    if (!artwork) return fail(400, origin)

    const c = cloudinaryConfig()
    const timestamp = Math.floor(Date.now() / 1000)
    const publicId = buildPublicId(artworkId, crypto.randomUUID())
    const signature = await signParams({ public_id: publicId, timestamp, allowed_formats: ALLOWED_FORMATS }, c.apiSecret)

    return json({ cloudName: c.cloudName, apiKey: c.apiKey, timestamp, publicId, signature, allowedFormats: ALLOWED_FORMATS }, 200, origin)
  } catch (e) {
    console.error('media-sign', e)
    return fail(500, origin)
  }
})
