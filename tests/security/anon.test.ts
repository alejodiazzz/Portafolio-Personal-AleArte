import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { anonClient, anyCategoryId, cleanupTestArtworks, makeArtwork, makeImage, serviceClient, sql } from './helpers'

const anon = anonClient()
let draft: { id: string }, published: { id: string }, soldPub: { id: string }
let draftImg: { id: string }, pubImg: { id: string }
let categoryId: string

beforeAll(async () => {
  categoryId = await anyCategoryId()
  draft = await makeArtwork({ price: 100000 })
  published = await makeArtwork({ publication_status: 'published', price: 250000 })
  soldPub = await makeArtwork({ publication_status: 'published', availability_status: 'sold', price: 500000 })
  draftImg = await makeImage(draft.id)
  pubImg = await makeImage(published.id)
})
afterAll(cleanupTestArtworks)

describe('anónimo no puede escribir', () => {
  test('insert en categories falla', async () => {
    const { error } = await anon.from('categories').insert({ name: 'Hack', slug: 'hack' })
    expect(error).not.toBeNull()
  })
  test('insert en artworks falla', async () => {
    const { error } = await anon.from('artworks').insert({ title: 'x', slug: 'test-x', category_id: categoryId })
    expect(error).not.toBeNull()
  })
  test('insert en artwork_images falla', async () => {
    const { error } = await anon
      .from('artwork_images')
      .insert({ artwork_id: published.id, storage_path: `ale-arte/artworks/${published.id}/${crypto.randomUUID()}` })
    expect(error).not.toBeNull()
  })
  test('update/delete en categories no cambia nada', async () => {
    await anon.from('categories').update({ name: 'Hackeada' }).eq('id', categoryId)
    await anon.from('categories').delete().eq('id', categoryId)
    const rows = await sql<{ name: string }>('select name from public.categories where id = $1', [categoryId])
    expect(rows).toHaveLength(1)
    expect(rows[0].name).not.toBe('Hackeada')
  })
  test('update/delete en artworks no cambia nada', async () => {
    await anon.from('artworks').update({ title: 'Hackeada' }).eq('id', published.id)
    await anon.from('artworks').delete().eq('id', published.id)
    const rows = await sql<{ title: string }>('select title from public.artworks where id = $1', [published.id])
    expect(rows[0]?.title).toBe('Obra de prueba')
  })
  test('update/delete en artwork_images no cambia nada', async () => {
    await anon.from('artwork_images').update({ image_alt: 'hack' }).eq('id', pubImg.id)
    await anon.from('artwork_images').delete().eq('id', pubImg.id)
    const rows = await sql<{ image_alt: string | null }>('select image_alt from public.artwork_images where id = $1', [pubImg.id])
    expect(rows).toHaveLength(1)
    expect(rows[0].image_alt).toBeNull()
  })
})

describe('anónimo: lectura', () => {
  test('no puede leer la columna price de artworks', async () => {
    const { error } = await anon.from('artworks').select('price')
    expect(error).not.toBeNull()
  })
  test('lectura directa de artworks no incluye borradores', async () => {
    const { data } = await anon.from('artworks').select('id').in('id', [draft.id, published.id])
    expect((data ?? []).map((r) => r.id)).toEqual([published.id])
  })
  test('public_artworks solo muestra publicadas', async () => {
    const { data, error } = await anon.from('public_artworks').select('id')
    expect(error).toBeNull()
    const ids = data!.map((r) => r.id)
    expect(ids).toContain(published.id)
    expect(ids).not.toContain(draft.id)
  })
  test('public_artworks anula precio de obra vendida y conserva el de disponible', async () => {
    const { data } = await anon.from('public_artworks').select('id, price').in('id', [soldPub.id, published.id])
    const byId = Object.fromEntries(data!.map((r) => [r.id, r.price]))
    expect(byId[soldPub.id]).toBeNull()
    expect(Number(byId[published.id])).toBe(250000)
  })
  test('public_artworks no expone publication_status', async () => {
    const { error } = await anon.from('public_artworks').select('publication_status')
    expect(error).not.toBeNull()
  })
  test('imágenes de borradores invisibles; de publicadas visibles', async () => {
    const { data } = await anon.from('artwork_images').select('id').in('id', [draftImg.id, pubImg.id])
    const ids = data!.map((r) => r.id)
    expect(ids).toEqual([pubImg.id])
  })
  test('categories son públicas', async () => {
    const { data } = await anon.from('categories').select('slug')
    expect(data!.map((c) => c.slug)).toContain('murales')
  })
  test('is_admin() es false para anónimo', async () => {
    const { data } = await anon.rpc('is_admin')
    expect(data).toBe(false)
  })
})

describe('integridad', () => {
  test('borrar categoría con obras falla por FK', async () => {
    const { error } = await serviceClient().from('categories').delete().eq('id', categoryId)
    expect(error?.code).toBe('23503')
  })
  test('solo puede existir un administrador', async () => {
    await sql(`delete from private.app_admin`)
    const users = await sql<{ id: string }>(
      `insert into auth.users (id, email, aud, role) values (gen_random_uuid(), 'a1-'||gen_random_uuid()||'@test.local','authenticated','authenticated'),
        (gen_random_uuid(), 'a2-'||gen_random_uuid()||'@test.local','authenticated','authenticated') returning id`,
    )
    await sql(`insert into private.app_admin (user_id) values ($1)`, [users[0].id])
    await expect(sql(`insert into private.app_admin (user_id) values ($1)`, [users[1].id])).rejects.toThrow(/app_admin_singleton/)
    await sql(`delete from auth.users where id = any($1)`, [users.map((u) => u.id)])
  })
  test('el esquema private no está expuesto por la API', async () => {
    const { error } = await serviceClient().schema('private').from('app_admin').select('*')
    expect(error).not.toBeNull()
  })
})
