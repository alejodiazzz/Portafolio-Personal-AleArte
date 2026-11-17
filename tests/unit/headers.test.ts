// @vitest-environment node
import { expect, test } from 'vitest'
import { securityHeaders } from '../../vite.config'

const h = securityHeaders('https://abcd.supabase.co/')
const csp = h.match(/Content-Security-Policy: (.*)/)![1]

test('connect-src permite solo el proyecto de Supabase (HTTP y Realtime) y Cloudinary', () => {
  expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co https://api.cloudinary.com")
})
test('no permite scripts inline ni eval', () => {
  const script = csp.split('; ').find((d) => d.startsWith('script-src'))!
  expect(script).not.toMatch(/unsafe-inline|unsafe-eval/)
})
test('bloquea iframes externos del sitio y objetos', () => {
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
})
test('assets con caché inmutable e index sin caché', () => {
  expect(h).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/)
  expect(h).toMatch(/\/index.html\n\s+Cache-Control: no-cache/)
})
