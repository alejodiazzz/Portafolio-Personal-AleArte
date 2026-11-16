import { expect, test, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_u: string, _k: string, options: { auth?: Record<string, unknown> }) => ({ options }),
}))
import { publicSupabase, supabase } from './supabase'

test('el cliente público no guarda ni usa sesión', () => {
  const opts = (publicSupabase as unknown as { options: { auth: Record<string, unknown> } }).options.auth
  expect(opts.persistSession).toBe(false)
  expect(opts.autoRefreshToken).toBe(false)
  expect(opts.storageKey).not.toBe((supabase as unknown as { options: { auth: Record<string, unknown> } }).options.auth.storageKey)
})
