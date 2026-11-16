import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { signParams } from '../../supabase/functions/_shared/cloudinary'
import {
  accessToken, cleanupTestArtworks, createTestAdmin, createTestUser, deleteTestUsers, elevateToAal2,
  makeArtwork, signIn, sql,
} from './helpers'

const FN = () => process.env.TEST_FUNCTIONS_URL!
const ORIGIN = () => process.env.TEST_ALLOWED_ORIGIN!
const hasCloudinary = !!process.env.TEST_CLOUDINARY_API_SECRET

async function call(name: string, body: unknown, token?: string, extra: Record<string, string> = {}) {
  const res = await fetch(`${FN()}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers }
}

let admin: SupabaseClient, adminAal1: SupabaseClient, stranger: SupabaseClient
let artwork: { id: string }

beforeAll(async () => {
  const a = await createTestAdmin(process.env.TEST_ADMIN_EMAIL)
  admin = await a.aal2Client()
  adminAal1 = await a.aal1Client()
  const u = await createTestUser()
  stranger = await signIn(u.email)
  await elevateToAal2(stranger)
  artwork = await makeArtwork()
})
afterAll(async () => {
  await cleanupTestArtworks()
  await deleteTestUsers()
})

describe.each(['media-sign', 'media-delete'])('%s: autorización', (fn) => {
  test('sin token → 401', async () => {
    expect((await call(fn, { artworkId: artwork.id })).status).toBe(401)
  })
  test('token basura → 401', async () => {
    expect((await call(fn, { artworkId: artwork.id }, 'abc.def.ghi')).status).toBe(401)
  })
  test('usuario no admin (aun con MFA) → 403', async () => {
    expect((await call(fn, { artworkId: artwork.id }, await accessToken(stranger))).status).toBe(403)
  })
  test('admin sin MFA (aal1) → 403', async () => {
    expect((await call(fn, { artworkId: artwork.id }, await accessToken(adminAal1))).status).toBe(403)
  })
  test('el error no revela detalles internos', async () => {
    const r = await call(fn, { artworkId: artwork.id }, await accessToken(stranger))
    expect(r.body).toEqual({ error: 'No autorizado' })
  })
})

describe('media-sign', () => {
  test('admin aal2 recibe firma válida', async () => {
    const r = await call('media-sign', { artworkId: artwork.id }, await accessToken(admin))
    expect(r.status).toBe(200)
    expect(r.body.publicId).toMatch(new RegExp(`^ale-arte/artworks/${artwork.id}/[0-9a-f-]{36}$`))
    expect(r.body.allowedFormats).toBe('webp,jpg,png')
    expect(r.body).not.toHaveProperty('apiSecret')
    expect(r.body.signature).toMatch(/^[0-9a-f]{40}$/)
  })
  test('artworkId inválido → 400', async () => {
    expect((await call('media-sign', { artworkId: '../x' }, await accessToken(admin))).status).toBe(400)
  })
  test('obra inexistente → 400', async () => {
    expect((await call('media-sign', { artworkId: crypto.randomUUID() }, await accessToken(admin))).status).toBe(400)
  })
})

describe('media-delete', () => {
  test('cuerpo inválido → 400', async () => {
    expect((await call('media-delete', { foo: 1 }, await accessToken(admin))).status).toBe(400)
  })
  test('admin borra una imagen: la fila desaparece', async () => {
    const w = await makeArtwork()
    const path = `ale-arte/artworks/${w.id}/${crypto.randomUUID()}`
    const [img] = await sql<{ id: string }>('insert into public.artwork_images (artwork_id, storage_path) values ($1,$2) returning id', [w.id, path])
    const r = await call('media-delete', { imageId: img.id }, await accessToken(admin))
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(await sql('select 1 from public.artwork_images where id = $1', [img.id])).toHaveLength(0)
  })
  test('admin borra una obra: obra e imágenes desaparecen', async () => {
    const w = await makeArtwork()
    await sql('insert into public.artwork_images (artwork_id, storage_path) values ($1,$2)', [w.id, `ale-arte/artworks/${w.id}/${crypto.randomUUID()}`])
    const r = await call('media-delete', { artworkId: w.id }, await accessToken(admin))
    expect(r.status).toBe(200)
    expect(await sql('select 1 from public.artworks where id = $1', [w.id])).toHaveLength(0)
    expect(await sql('select 1 from public.artwork_images where artwork_id = $1', [w.id])).toHaveLength(0)
  })
  test('no admin no puede borrar (la fila sigue)', async () => {
    const w = await makeArtwork()
    await call('media-delete', { artworkId: w.id }, await accessToken(stranger))
    expect(await sql('select 1 from public.artworks where id = $1', [w.id])).toHaveLength(1)
  })
})

describe('media-cleanup', () => {
  test('sin secreto → 401', async () => {
    expect((await call('media-cleanup', {})).status).toBe(401)
  })
  test('secreto incorrecto → 401', async () => {
    expect((await call('media-cleanup', {}, undefined, { 'x-cron-secret': 'nope' })).status).toBe(401)
  })
  test.runIf(hasCloudinary)('secreto correcto → 200 con conteo', async () => {
    const r = await call('media-cleanup', {}, undefined, { 'x-cron-secret': process.env.TEST_CRON_SECRET! })
    expect(r.status).toBe(200)
    expect(typeof r.body.checked).toBe('number')
  })
})

describe.runIf(hasCloudinary)('flujo real con Cloudinary', () => {
  test('firmar → subir → registrar → borrar obra → recurso eliminado', async () => {
    const w = await makeArtwork()
    const s = (await call('media-sign', { artworkId: w.id }, await accessToken(admin))).body
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
    const form = new FormData()
    form.append('file', new Blob([png], { type: 'image/png' }), 'x.png')
    for (const [k, v] of Object.entries({ api_key: s.apiKey, timestamp: s.timestamp, public_id: s.publicId, allowed_formats: s.allowedFormats, signature: s.signature }))
      form.append(k, String(v))
    const up = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: 'POST', body: form })
    expect(up.status).toBe(200)
    await sql('insert into public.artwork_images (artwork_id, storage_path) values ($1,$2)', [w.id, s.publicId])
    const d = await call('media-delete', { artworkId: w.id }, await accessToken(admin))
    expect(d.body).toEqual({ ok: true, orphaned: false })
    const cloud = process.env.TEST_CLOUDINARY_CLOUD_NAME!
    const auth = btoa(`${process.env.TEST_CLOUDINARY_API_KEY}:${process.env.TEST_CLOUDINARY_API_SECRET}`)
    const check = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload/${s.publicId}`, { headers: { Authorization: `Basic ${auth}` } })
    expect(check.status).toBe(404)
  })
  test('firma manipulada es rechazada por Cloudinary', async () => {
    const s = (await call('media-sign', { artworkId: artwork.id }, await accessToken(admin))).body
    const bad = await signParams({ public_id: 'otra/ruta', timestamp: s.timestamp }, 'secreto-falso')
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array([0])]), 'x.png')
    for (const [k, v] of Object.entries({ api_key: s.apiKey, timestamp: s.timestamp, public_id: 'otra/ruta', signature: bad }))
      form.append(k, String(v))
    const up = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/image/upload`, { method: 'POST', body: form })
    expect(up.status).toBe(401)
  })
})
