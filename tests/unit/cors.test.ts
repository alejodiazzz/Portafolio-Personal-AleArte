// @vitest-environment node
import { expect, test } from 'vitest'
import { corsHeaders } from '../../supabase/functions/_shared/http'

const allowed = ['http://localhost:5173', 'https://alearte.pages.dev']

test('origen permitido recibe Access-Control-Allow-Origin exacto', () => {
  const h = corsHeaders('https://alearte.pages.dev', allowed) as Record<string, string>
  expect(h['Access-Control-Allow-Origin']).toBe('https://alearte.pages.dev')
})
test('origen no permitido no recibe Access-Control-Allow-Origin', () => {
  const h = corsHeaders('https://evil.example', allowed) as Record<string, string>
  expect(h['Access-Control-Allow-Origin']).toBeUndefined()
})
test('nunca usa comodín *', () => {
  const h = corsHeaders(null, allowed) as Record<string, string>
  expect(Object.values(h)).not.toContain('*')
})
