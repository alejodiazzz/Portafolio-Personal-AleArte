import { describe, expect, test } from 'vitest'
import { bidMessage, callMeBotUrl, normalizePhone, parseBid } from '../../supabase/functions/_shared/auction'

const ok = {
  artworkId: '1b4e28ba-2fa1-11d2-883f-0016d3cca427', amount: 150000, name: '  María Gómez ', email: ' Maria@Ej.com ',
  phone: '+57 (300) 111-2233', consent: true, captchaToken: 'tok',
}

describe('parseBid', () => {
  test('limpia nombre, correo y teléfono', () => {
    expect(parseBid(ok)).toEqual({ ...ok, name: 'María Gómez', email: 'maria@ej.com', phone: '+573001112233', consent: undefined } as never)
  })
  test.each([
    ['sin consentimiento', { consent: 'true' }],
    ['uuid inválido', { artworkId: 'x' }],
    ['monto decimal', { amount: 1.5 }],
    ['monto texto', { amount: '150000' }],
    ['monto negativo', { amount: -1 }],
    ['nombre corto', { name: 'A' }],
    ['correo inválido', { email: 'maria' }],
    ['teléfono con letras', { phone: '300abc' }],
    ['sin captcha', { captchaToken: '' }],
  ])('%s → null', (_n, over) => {
    expect(parseBid({ ...ok, ...over })).toBeNull()
  })
  test('cuerpo nulo → null', () => expect(parseBid(null)).toBeNull())
})

test('normalizePhone', () => {
  expect(normalizePhone('300 111 2233')).toBe('3001112233')
  expect(normalizePhone('123')).toBeNull()
})

test('mensaje de WhatsApp con monto en COP y hora de Bogotá', () => {
  const m = bidMessage({ title: 'Mural', amount: 1250000, bidCount: 3, name: 'Ana', email: 'a@b.co', phone: '300', endsAt: '2026-11-20T23:00:00Z' })
  expect(m).toContain('"Mural"')
  expect(m).toContain('$ 1.250.000 COP (oferta n.º 3)')
  expect(m).toMatch(/20 de noviembre.*6:00/)
})

test('URL de CallMeBot codifica el texto', () => {
  const u = new URL(callMeBotUrl('+573001112233', 'k1', 'Hola & "x"'))
  expect(u.origin + u.pathname).toBe('https://api.callmebot.com/whatsapp.php')
  expect(u.searchParams.get('text')).toBe('Hola & "x"')
  expect(u.searchParams.get('phone')).toBe('+573001112233')
})
