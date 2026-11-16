// Tarea programada: mantiene activo el proyecto (consulta la BD) y borra imágenes huérfanas
// de Cloudinary (sin fila en artwork_images y con más de 24 h). Autenticada con x-cron-secret.
import { serviceClient } from '../_shared/auth.ts'
import { ARTWORKS_PREFIX } from '../_shared/cloudinary.ts'
import { cloudinaryConfig, deleteMany, listByPrefix } from '../_shared/cloudinary-api.ts'
import { fail, json } from '../_shared/http.ts'
import { findOrphans } from '../_shared/orphans.ts'

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405)
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  const given = req.headers.get('x-cron-secret') ?? ''
  if (secret.length < 16 || !safeEqual(given, secret)) return fail(401)

  try {
    const db = serviceClient() // service role: ve también imágenes de borradores
    const resources = await listByPrefix(cloudinaryConfig(), ARTWORKS_PREFIX)
    const orphans = await findOrphans(resources, async (ids) => {
      const { data, error } = await db.from('artwork_images').select('storage_path').in('storage_path', ids)
      if (error) throw error // ante cualquier error de BD no se borra nada
      return data.map((r) => r.storage_path as string)
    })
    const deleted = orphans.length ? await deleteMany(cloudinaryConfig(), orphans) : 0
    return json({ checked: resources.length, deleted })
  } catch (e) {
    console.error('media-cleanup', e)
    return fail(500)
  }
})
