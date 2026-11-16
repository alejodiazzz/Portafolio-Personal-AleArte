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
