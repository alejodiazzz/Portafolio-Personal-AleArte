import { describe, expect, test } from 'vitest'
import { fakeSupabase } from '../../test/fakeSupabase'
import { createPortfolioApi, SHOWCASE_LIMIT } from './api'

const art = (i: number) => ({ id: `a${i}`, slug: `s${i}`, title: `T${i}` })

describe('listShowcase', () => {
  test('pide obras publicadas ordenadas, con tope, y adjunta la portada', async () => {
    const f = fakeSupabase({
      public_artworks: [art(1), art(2)],
      artwork_images: [
        { id: 'i1', artwork_id: 'a1', is_cover: false, display_order: 0 },
        { id: 'i2', artwork_id: 'a1', is_cover: true, display_order: 1, dominant_color: '#183961' },
        { id: 'i3', artwork_id: 'a2', is_cover: false, display_order: 5 },
        { id: 'i4', artwork_id: 'a2', is_cover: false, display_order: 2 },
      ],
    })
    const r = await createPortfolioApi(f.client as never).listShowcase()
    expect(r.map((a) => a.cover?.id)).toEqual(['i2', 'i4'])
    expect(r[0].cover?.dominant_color).toBe('#183961')
    expect(f.calls).toContainEqual({ table: 'public_artworks', method: 'limit', args: [SHOWCASE_LIMIT] })
    expect(f.calls).toContainEqual({ table: 'public_artworks', method: 'order', args: ['display_order'] })
    expect(f.calls).toContainEqual({ table: 'artwork_images', method: 'in', args: ['artwork_id', ['a1', 'a2']] })
  })
  test('adjunta la subasta de cada obra (o null)', async () => {
    const f = fakeSupabase({
      public_artworks: [art(1), art(2)],
      artwork_images: [],
      auctions: [{ artwork_id: 'a2', starting_price: 100000, min_increment: 10000, ends_at: '2026-12-01T00:00:00Z', current_amount: null, bid_count: 0, is_active: true }],
    })
    const r = await createPortfolioApi(f.client as never).listShowcase()
    expect(r.map((a) => a.auction?.starting_price ?? null)).toEqual([null, 100000])
    expect(f.calls).toContainEqual({ table: 'auctions', method: 'in', args: ['artwork_id', ['a1', 'a2']] })
  })
  test('sin obras no consulta imágenes', async () => {
    const f = fakeSupabase({ public_artworks: [] })
    expect(await createPortfolioApi(f.client as never).listShowcase()).toEqual([])
    expect(f.calls.some((c) => c.table === 'artwork_images' || c.table === 'auctions')).toBe(false)
  })
  test('obra sin imágenes → cover null', async () => {
    const f = fakeSupabase({ public_artworks: [art(1)], artwork_images: [] })
    const r = await createPortfolioApi(f.client as never).listShowcase()
    expect(r[0].cover).toBeNull()
  })
})

describe('listCategories', () => {
  test('ordena por display_order', async () => {
    const f = fakeSupabase({ categories: [{ id: 'c1', name: 'Murales', slug: 'murales' }] })
    expect(await createPortfolioApi(f.client as never).listCategories()).toHaveLength(1)
    expect(f.calls).toContainEqual({ table: 'categories', method: 'order', args: ['display_order'] })
  })
})
