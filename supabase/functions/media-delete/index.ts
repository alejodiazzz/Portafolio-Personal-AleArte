// Borra una imagen o una obra completa: primero en BD (con RLS del admin), luego en Cloudinary.
// Si Cloudinary falla, el recurso queda huérfano y lo recoge media-cleanup.
import { requireAdmin } from '../_shared/auth.ts'
import { ARTWORKS_PREFIX, isValidPublicId, UUID_RE } from '../_shared/cloudinary.ts'
import { cloudinaryConfig, deleteByPrefix, destroy } from '../_shared/cloudinary-api.ts'
import { fail, json, preflight, readJson } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const origin = req.headers.get('origin')
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof Response) return auth
    const db = auth.userClient

    const body = await readJson(req)
    const imageId = body?.imageId
    const artworkId = body?.artworkId
    const isImage = typeof imageId === 'string' && UUID_RE.test(imageId)
    const isArtwork = typeof artworkId === 'string' && UUID_RE.test(artworkId)
    if (isImage === isArtwork) return fail(400, origin) // exactamente uno de los dos

    let orphaned = false
    if (isImage) {
      const { data, error } = await db.from('artwork_images').delete().eq('id', imageId).select('storage_path')
      if (error || !data?.length) return fail(400, origin)
      const path = data[0].storage_path as string
      if (isValidPublicId(path)) {
        orphaned = !(await safe(() => destroy(cloudinaryConfig(), path)))
      }
    } else {
      const { data, error } = await db.from('artworks').delete().eq('id', artworkId).select('id')
      if (error || !data?.length) return fail(400, origin)
      orphaned = !(await safe(() => deleteByPrefix(cloudinaryConfig(), `${ARTWORKS_PREFIX}${artworkId}/`)))
    }
    if (orphaned) console.warn('media-delete: recurso huérfano pendiente de barrido')
    return json({ ok: true, orphaned }, 200, origin)
  } catch (e) {
    console.error('media-delete', e)
    return fail(500, origin)
  }
})

async function safe(fn: () => Promise<boolean>): Promise<boolean> {
  try {
    return await fn()
  } catch (e) {
    console.error('cloudinary', e)
    return false
  }
}
