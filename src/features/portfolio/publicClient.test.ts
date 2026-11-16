import { expect, test, vi } from 'vitest'

const { session, anon } = await vi.hoisted(async () => {
  const { fakeSupabase } = await import('../../test/fakeSupabase')
  return { session: fakeSupabase({ categories: [] }), anon: fakeSupabase({ categories: [] }) }
})
vi.mock('../../lib/supabase', () => ({ supabase: session.client, publicSupabase: anon.client }))
import { portfolioApi } from './api'

test('el portafolio público consulta siempre con el cliente sin sesión', async () => {
  await portfolioApi.listCategories()
  expect(anon.calls.length).toBeGreaterThan(0)
  expect(session.calls).toHaveLength(0)
})
