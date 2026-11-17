import { afterEach, describe, expect, test, vi } from 'vitest'
import { auctionView, formatCountdown, placeBid } from './auction'

const A = { artwork_id: 'a1', starting_price: 100000, min_increment: 10000, ends_at: '2026-11-20T00:00:00Z', current_amount: null, bid_count: 0, is_active: true }
const T0 = Date.parse('2026-11-19T00:00:00Z')

describe('auctionView', () => {
  test('sin ofertas: muestra la base y la mínima es la base', () => {
    expect(auctionView(A, T0)).toEqual({ open: true, amount: 100000, hasBids: false, minNext: 100000, msLeft: 86_400_000 })
  })
  test('con ofertas: mínima = actual + incremento', () => {
    expect(auctionView({ ...A, current_amount: 150000, bid_count: 3 }, T0)).toMatchObject({ amount: 150000, hasBids: true, minNext: 160000 })
  })
  test('vencida o inactiva → cerrada', () => {
    expect(auctionView(A, Date.parse(A.ends_at)).open).toBe(false)
    expect(auctionView({ ...A, is_active: false }, T0).open).toBe(false)
  })
})

test('formatCountdown', () => {
  expect(formatCountdown(2 * 86_400_000 + 4 * 3_600_000 + 5000)).toBe('2 d 4 h')
  expect(formatCountdown(3 * 3_600_000 + 12 * 60_000)).toBe('3 h 12 min')
  expect(formatCountdown(4 * 60_000 + 5000)).toBe('4 min 05 s')
  expect(formatCountdown(0)).toBe('0 s')
})

describe('placeBid', () => {
  afterEach(() => vi.unstubAllGlobals())
  const input = { artworkId: 'a1', amount: 100000, name: 'Ana', email: 'a@b.co', phone: '300', consent: true, captchaToken: 't' }
  const respond = (status: number, body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))

  test('200 → ok con el nuevo estado; llama a la función con la clave pública', async () => {
    respond(200, { status: 'ok', currentAmount: 100000, bidCount: 1, endsAt: 'x', minNext: 110000 })
    expect(await placeBid(input)).toEqual({ ok: true, currentAmount: 100000, bidCount: 1, endsAt: 'x' })
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/functions\/v1\/auction-bid$/)
    expect((init.headers as Record<string, string>).apikey).toBeTruthy()
    expect(JSON.parse(init.body as string)).toEqual(input)
  })
  test('409 → motivo legible con el mínimo', async () => {
    respond(409, { status: 'too_low', minNext: 120000 })
    expect(await placeBid(input)).toEqual({ ok: false, message: 'Alguien ofertó antes que tú. La oferta mínima ahora es $ 120.000.', minNext: 120000 })
  })
  test('CAPTCHA, error de red o 500 → mensajes genéricos', async () => {
    respond(400, { status: 'captcha' })
    expect((await placeBid(input)).ok).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('net') }))
    expect(await placeBid(input)).toEqual({ ok: false, message: 'No se pudo enviar la oferta. Revisa tu conexión e intenta de nuevo.' })
  })
})
