import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  accessToken, anonClient, anyCategoryId, cleanupTestArtworks, createTestAdmin, createTestUser,
  deleteTestUsers, elevateToAal2, makeArtwork, PASSWORD, signIn, sql, URL,
} from './helpers'

let categoryId: string
let target: { id: string }
beforeAll(async () => {
  categoryId = await anyCategoryId()
  target = await makeArtwork({ publication_status: 'published' })
})
afterAll(async () => {
  await cleanupTestArtworks()
  await sql(`delete from public.categories where slug like 'test-%'`)
  await deleteTestUsers()
})

async function expectNoWrites(c: SupabaseClient) {
  const ins = await c.from('artworks').insert({ title: 'x', slug: `test-${crypto.randomUUID()}`, category_id: categoryId })
  expect(ins.error).not.toBeNull()
  await c.from('artworks').update({ title: 'Hackeada' }).eq('id', target.id)
  await c.from('artworks').delete().eq('id', target.id)
  const cat = await c.from('categories').insert({ name: `test ${crypto.randomUUID()}`, slug: `test-${Date.now()}` })
  expect(cat.error).not.toBeNull()
  const rows = await sql<{ title: string }>('select title from public.artworks where id = $1', [target.id])
  expect(rows[0]?.title).toBe('Obra de prueba')
}

describe('registro', () => {
  test('el registro público está deshabilitado', async () => {
    const { data, error } = await anonClient().auth.signUp({ email: `x-${Date.now()}@test.local`, password: PASSWORD })
    expect(error).not.toBeNull()
    expect(data.user).toBeNull()
  })
})

describe('usuario autenticado que no es admin', () => {
  test('con aal1 no puede escribir y is_admin es false', async () => {
    const u = await createTestUser()
    const c = await signIn(u.email)
    expect((await c.rpc('is_admin')).data).toBe(false)
    await expectNoWrites(c)
  })
  test('incluso con MFA (aal2) no puede escribir', async () => {
    const u = await createTestUser()
    const c = await signIn(u.email)
    await elevateToAal2(c)
    expect((await c.rpc('is_admin')).data).toBe(false)
    await expectNoWrites(c)
  })
})

describe('administrador', () => {
  test('con aal1 (sin MFA) no es admin ni puede escribir', async () => {
    const admin = await createTestAdmin()
    const c = await admin.aal1Client()
    expect((await c.rpc('is_admin')).data).toBe(false)
    await expectNoWrites(c)
  })
  test('con aal2 tiene CRUD completo', async () => {
    const admin = await createTestAdmin()
    const c = await admin.aal2Client()
    expect((await c.rpc('is_admin')).data).toBe(true)
    const slug = `test-${crypto.randomUUID()}`
    const ins = await c.from('artworks').insert({ title: 'Nueva', slug, category_id: categoryId }).select('id').single()
    expect(ins.error).toBeNull()
    const upd = await c.from('artworks').update({ title: 'Editada' }).eq('id', ins.data!.id).select('title').single()
    expect(upd.data?.title).toBe('Editada')
    const del = await c.from('artworks').delete().eq('id', ins.data!.id).select('id')
    expect(del.data).toHaveLength(1)
    const cat = await c.from('categories').insert({ name: `test ${slug}`, slug }).select('id').single()
    expect(cat.error).toBeNull()
  })
})

describe('tokens', () => {
  test('JWT manipulado (aal1 → aal2 sin re-firmar) es rechazado', async () => {
    const admin = await createTestAdmin()
    const c = await admin.aal1Client()
    const [h, p, s] = (await accessToken(c)).split('.')
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    payload.aal = 'aal2'
    const forged = [h, Buffer.from(JSON.stringify(payload)).toString('base64url'), s].join('.')
    const res = await fetch(`${URL()}/rest/v1/artworks`, {
      method: 'POST',
      headers: {
        apikey: process.env.TEST_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${forged}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'x', slug: `test-${Date.now()}`, category_id: categoryId }),
    })
    expect(res.status).toBe(401)
  })
  test('tras cerrar sesión, el token anterior ya no da acceso de admin', async () => {
    const admin = await createTestAdmin()
    const c = await admin.aal2Client()
    const token = await accessToken(c)
    await c.auth.signOut({ scope: 'global' })
    const res = await fetch(`${URL()}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: { apikey: process.env.TEST_SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(await res.json()).toBe(false)
  })
})

describe('color dominante (escaparate)', () => {
  test('el admin guarda #rrggbb; valores que no son hex se rechazan; el público lo lee', async () => {
    const admin = await createTestAdmin()
    const c = await admin.aal2Client()
    const path = (n: string) => `ale-arte/artworks/${target.id}/${n}`
    const ok = await c.from('artwork_images')
      .insert({ artwork_id: target.id, storage_path: path(crypto.randomUUID()), dominant_color: '#1f3b7a' }).select('id').single()
    expect(ok.error).toBeNull()
    for (const bad of ['red', '#1F3B7A', '#123', 'url(x)', '#1f3b7a;x'])
      expect((await c.from('artwork_images')
        .insert({ artwork_id: target.id, storage_path: path(crypto.randomUUID()), dominant_color: bad })).error?.code).toBe('23514')
    const pub = await anonClient().from('artwork_images').select('dominant_color').eq('id', ok.data!.id).single()
    expect(pub.data?.dominant_color).toBe('#1f3b7a')
  })
})
