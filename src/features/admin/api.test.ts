import { expect, test } from 'vitest'
import { fakeSupabase } from '../../test/fakeSupabase'
import { createAdminApi } from './api'

test('deleteArtwork pasa por media-delete (nunca borra directo)', async () => {
  const f = fakeSupabase({})
  await createAdminApi(f.client as never).deleteArtwork('a1')
  expect(f.invoked).toEqual([{ name: 'media-delete', body: { artworkId: 'a1' } }])
  expect(f.calls.find((c) => c.method === 'delete')).toBeUndefined()
})
test('deleteImage pasa por media-delete', async () => {
  const f = fakeSupabase({})
  await createAdminApi(f.client as never).deleteImage('i1')
  expect(f.invoked).toEqual([{ name: 'media-delete', body: { imageId: 'i1' } }])
})
test('setCover desmarca la portada anterior antes de marcar la nueva', async () => {
  const f = fakeSupabase({ artwork_images: [{ id: 'i2', artwork_id: 'a1' }] })
  await createAdminApi(f.client as never).setCover('i2')
  const updates = f.calls.filter((c) => c.method === 'update').map((c) => c.args[0])
  expect(updates).toEqual([{ is_cover: false }, { is_cover: true }])
})
test('setImageColor guarda #rrggbb en custom_color; null vuelve al automático', async () => {
  const f = fakeSupabase({ artwork_images: [{ id: 'i1' }] })
  const api = createAdminApi(f.client as never)
  await api.setImageColor('i1', '#AA3300')
  await api.setImageColor('i1', null)
  const updates = f.calls.filter((c) => c.method === 'update').map((c) => c.args[0])
  expect(updates).toEqual([{ custom_color: '#aa3300' }, { custom_color: null }])
  await expect(api.setImageColor('i1', 'red')).rejects.toThrow()
})

test('setImageCutout guarda el marco con forma', async () => {
  const f = fakeSupabase({ artwork_images: [{ id: 'i1' }] })
  await createAdminApi(f.client as never).setImageCutout('i1', true)
  expect(f.calls.filter((c) => c.method === 'update').map((c) => c.args[0])).toEqual([{ is_cutout: true }])
})

test('saveAuction crea la subasta si no existe y solo envía columnas configurables', async () => {
  const f = fakeSupabase({ auctions: [] })
  await createAdminApi(f.client as never).saveAuction('a1', { starting_price: 100000, min_increment: 10000, ends_at: '2026-12-01T20:00:00.000Z', is_active: true })
  const insert = f.calls.find((c) => c.table === 'auctions' && c.method === 'insert')
  expect(insert?.args[0]).toEqual({ artwork_id: 'a1', starting_price: 100000, min_increment: 10000, ends_at: '2026-12-01T20:00:00.000Z', is_active: true })
})
test('saveAuction actualiza la existente', async () => {
  const f = fakeSupabase({ auctions: [{ artwork_id: 'a1' }] })
  await createAdminApi(f.client as never).saveAuction('a1', { starting_price: 1, min_increment: 1, ends_at: 'x', is_active: false })
  expect(f.calls.some((c) => c.table === 'auctions' && c.method === 'update')).toBe(true)
  expect(f.calls.some((c) => c.table === 'auctions' && c.method === 'insert')).toBe(false)
})
test('listBids ordena de mayor a menor', async () => {
  const f = fakeSupabase({ auction_bids: [] })
  await createAdminApi(f.client as never).listBids('a1')
  expect(f.calls).toContainEqual({ table: 'auction_bids', method: 'order', args: ['amount', { ascending: false }] })
})
