import { describe, expect, test } from 'vitest'
import { fakeSupabase } from '../../test/fakeSupabase'
import { createPortfolioApi, PAGE_SIZE } from './api'

const art = (i: number) => ({ id: `a${i}`, slug: `s${i}`, title: `T${i}` })

describe('listArtworks', () => {
  test('página de 12, pide 13 para saber si hay más', async () => {
    const f = fakeSupabase({ public_artworks: Array.from({ length: 13 }, (_, i) => art(i)), artwork_images: [] })
    const api = createPortfolioApi(f.client as never)
    const r = await api.listArtworks({ page: 0 })
    expect(PAGE_SIZE).toBe(12)
    expect(r.items).toHaveLength(12)
    expect(r.hasMore).toBe(true)
    expect(f.calls).toContainEqual({ table: 'public_artworks', method: 'range', args: [0, 12] })
  })
  test('segunda página usa el desplazamiento correcto', async () => {
    const f = fakeSupabase({ public_artworks: [art(1)], artwork_images: [] })
    const r = await createPortfolioApi(f.client as never).listArtworks({ page: 1 })
    expect(r.hasMore).toBe(false)
    expect(f.calls).toContainEqual({ table: 'public_artworks', method: 'range', args: [12, 24] })
  })
  test('obra sin imágenes → cover null sin error', async () => {
    const f = fakeSupabase({ public_artworks: [art(1)], artwork_images: [] })
    const r = await createPortfolioApi(f.client as never).listArtworks({ page: 0 })
    expect(r.items[0].cover).toBeNull()
  })
  test('usa la portada si existe; si no, la primera imagen', async () => {
    const f = fakeSupabase({
      public_artworks: [art(1), art(2)],
      artwork_images: [
        { id: 'i1', artwork_id: 'a1', is_cover: false, display_order: 0 },
        { id: 'i2', artwork_id: 'a1', is_cover: true, display_order: 1 },
        { id: 'i3', artwork_id: 'a2', is_cover: false, display_order: 5 },
        { id: 'i4', artwork_id: 'a2', is_cover: false, display_order: 2 },
      ],
    })
    const r = await createPortfolioApi(f.client as never).listArtworks({ page: 0 })
    expect(r.items.map((i) => i.cover?.id)).toEqual(['i2', 'i4'])
  })
  test('filtra por categoría resolviendo el slug', async () => {
    const f = fakeSupabase({ categories: [{ id: 'c1' }], public_artworks: [], artwork_images: [] })
    await createPortfolioApi(f.client as never).listArtworks({ page: 0, categorySlug: 'murales' })
    expect(f.calls).toContainEqual({ table: 'public_artworks', method: 'eq', args: ['category_id', 'c1'] })
  })
  test('categoría inexistente → lista vacía', async () => {
    const f = fakeSupabase({ categories: [], public_artworks: [art(1)], artwork_images: [] })
    const r = await createPortfolioApi(f.client as never).listArtworks({ page: 0, categorySlug: 'nada' })
    expect(r).toEqual({ items: [], hasMore: false })
  })
})

describe('getArtworkBySlug', () => {
  test('slug inexistente → null', async () => {
    const f = fakeSupabase({ public_artworks: [] })
    expect(await createPortfolioApi(f.client as never).getArtworkBySlug('x')).toBeNull()
  })
  test('devuelve la obra con sus imágenes ordenadas (portada primero)', async () => {
    const f = fakeSupabase({
      public_artworks: [art(1)],
      artwork_images: [
        { id: 'i1', artwork_id: 'a1', is_cover: false, display_order: 0 },
        { id: 'i2', artwork_id: 'a1', is_cover: true, display_order: 3 },
      ],
    })
    const r = await createPortfolioApi(f.client as never).getArtworkBySlug('s1')
    expect(r?.images.map((i) => i.id)).toEqual(['i2', 'i1'])
  })
})
