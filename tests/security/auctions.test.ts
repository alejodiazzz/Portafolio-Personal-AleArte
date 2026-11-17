import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  anonClient, cleanupTestArtworks, createTestAdmin, createTestUser, deleteTestUsers, elevateToAal2,
  makeArtwork, serviceClient, signIn, sql,
} from './helpers'

const FN = () => process.env.TEST_FUNCTIONS_URL!
const ORIGIN = () => process.env.TEST_ALLOWED_ORIGIN!
/** Token de prueba de Cloudflare: la clave secreta de prueba lo acepta siempre. */
const DUMMY_CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX'
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()

let admin: SupabaseClient, stranger: SupabaseClient

async function auctionFor(over: Record<string, unknown> = {}, artwork: Record<string, unknown> = { publication_status: 'published' }) {
  const w = await makeArtwork(artwork)
  await sql(
    `insert into public.auctions (artwork_id, starting_price, min_increment, ends_at, is_active) values ($1, $2, $3, $4, $5)`,
    [w.id, over.starting_price ?? 100000, over.min_increment ?? 10000, over.ends_at ?? inHours(48), over.is_active ?? true],
  )
  return w
}
const bid = (artworkId: string, amount: number, email = `p${Math.random()}@ej.com`, phone = '+573001112233') =>
  serviceClient().rpc('place_bid', { p_artwork_id: artworkId, p_amount: amount, p_name: 'María Gómez', p_email: email, p_phone: phone })

beforeAll(async () => {
  const a = await createTestAdmin()
  admin = await a.aal2Client()
  const u = await createTestUser()
  stranger = await signIn(u.email)
  await elevateToAal2(stranger)
})
afterAll(async () => {
  await cleanupTestArtworks()
  await deleteTestUsers()
})

describe('subastas: lectura pública', () => {
  test('anon ve la subasta de una obra publicada y activa; no la de un borrador ni una inactiva', async () => {
    const pub = await auctionFor()
    const draft = await auctionFor({}, { publication_status: 'draft' })
    const off = await auctionFor({ is_active: false })
    const { data } = await anonClient().from('auctions').select('artwork_id').in('artwork_id', [pub.id, draft.id, off.id])
    expect(data?.map((r) => r.artwork_id)).toEqual([pub.id])
  })

  test('nadie salvo el admin lee las ofertas (datos personales)', async () => {
    const w = await auctionFor()
    expect((await bid(w.id, 100000)).data.status).toBe('ok')
    for (const c of [anonClient(), stranger]) {
      const r = await c.from('auction_bids').select('*').eq('artwork_id', w.id)
      expect(r.data ?? []).toEqual([])
    }
    const r = await admin.from('auction_bids').select('bidder_name, bidder_email, bidder_phone, amount').eq('artwork_id', w.id)
    expect(r.data).toHaveLength(1)
    expect(r.data![0].bidder_phone).toBe('+573001112233')
  })
})

describe('subastas: escritura', () => {
  test('anon y usuarios no admin no pueden ofertar directo ni tocar la subasta', async () => {
    const w = await auctionFor()
    for (const c of [anonClient(), stranger]) {
      const rpc = await c.rpc('place_bid', { p_artwork_id: w.id, p_amount: 999999, p_name: 'X Y', p_email: 'a@b.co', p_phone: '3001112233' })
      expect(rpc.error).not.toBeNull()
      await c.from('auctions').update({ ends_at: inHours(999) }).eq('artwork_id', w.id)
      await c.from('auction_bids').insert({ artwork_id: w.id, amount: 1, bidder_name: 'Xx', bidder_email: 'a@b.co', bidder_phone: '3001112233', consent_at: new Date().toISOString() })
    }
    const [row] = await sql<{ bid_count: number; ends_at: Date }>('select bid_count, ends_at from public.auctions where artwork_id = $1', [w.id])
    expect(row.bid_count).toBe(0)
    expect(row.ends_at.getTime()).toBeLessThan(Date.now() + 49 * 3600_000)
  })

  test('el admin configura la subasta pero no puede fijar el monto actual a mano', async () => {
    const w = await makeArtwork({ publication_status: 'published' })
    const ins = await admin.from('auctions').insert({ artwork_id: w.id, starting_price: 50000, min_increment: 5000, ends_at: inHours(24) })
    expect(ins.error).toBeNull()
    const forged = await admin.from('auctions').update({ current_amount: 1 }).eq('artwork_id', w.id)
    expect(forged.error?.code).toBe('42501')
  })
})

describe('place_bid: reglas', () => {
  test('base, incremento, tope, "ya vas ganando" y conteo', async () => {
    const w = await auctionFor({ starting_price: 100000, min_increment: 10000 })
    expect((await bid(w.id, 90000)).data).toMatchObject({ status: 'too_low', min_next: 100000 })
    expect((await bid(w.id, 100000, 'ana@ej.com')).data).toMatchObject({ status: 'ok', current_amount: 100000, bid_count: 1, min_next: 110000 })
    expect((await bid(w.id, 105000)).data).toMatchObject({ status: 'too_low', min_next: 110000 })
    expect((await bid(w.id, 120000, 'ANA@ej.com')).data.status).toBe('already_top')
    expect((await bid(w.id, 1100001)).data.status).toBe('too_high')
    expect((await bid(w.id, 100000.5)).data.status).toBe('too_low')
    expect((await bid(w.id, 130000, 'luis@ej.com')).data).toMatchObject({ status: 'ok', current_amount: 130000, bid_count: 2 })
  })

  test('subasta vencida, inactiva o de borrador → cerrada', async () => {
    for (const w of [
      await auctionFor({ ends_at: inHours(-1) }),
      await auctionFor({ is_active: false }),
      await auctionFor({}, { publication_status: 'draft' }),
    ]) expect((await bid(w.id, 100000)).data.status).toBe('closed')
  })

  test('una oferta en los últimos 5 minutos extiende el cierre', async () => {
    const w = await auctionFor({ ends_at: new Date(Date.now() + 60_000).toISOString() })
    const r = (await bid(w.id, 100000)).data
    expect(new Date(r.ends_at).getTime()).toBeGreaterThan(Date.now() + 4.5 * 60_000)
  })

  test('datos de contacto inválidos se rechazan', async () => {
    const w = await auctionFor()
    expect((await bid(w.id, 100000, 'no-es-correo')).error).not.toBeNull()
    expect((await bid(w.id, 100000, 'a@b.co', '12ab')).error).not.toBeNull()
  })

  test('el admin borra una oferta falsa y el estado público se recalcula', async () => {
    const w = await auctionFor()
    await bid(w.id, 100000, 'uno@ej.com')
    await bid(w.id, 900000, 'troll@ej.com')
    const del = await admin.from('auction_bids').delete().eq('artwork_id', w.id).eq('bidder_email', 'troll@ej.com').select('id')
    expect(del.data).toHaveLength(1)
    const { data } = await anonClient().from('auctions').select('current_amount, bid_count').eq('artwork_id', w.id).single()
    expect(data).toEqual({ current_amount: 100000, bid_count: 1 })
  })
})

describe('enlace de Instagram', () => {
  test('acepta solo publicaciones de instagram.com en formato canónico; el público lo lee', async () => {
    const w = await makeArtwork({ publication_status: 'published' })
    const ok = await admin.from('artworks').update({ instagram_url: 'https://www.instagram.com/p/DAbc123_x-Y/' }).eq('id', w.id)
    expect(ok.error).toBeNull()
    for (const bad of ['https://evil.com/p/abc12/', 'javascript:alert(1)', 'https://www.instagram.com/p/abc12/?x=1', 'http://www.instagram.com/p/abc12/'])
      expect((await admin.from('artworks').update({ instagram_url: bad }).eq('id', w.id)).error?.code).toBe('23514')
    const pub = await anonClient().from('public_artworks').select('instagram_url').eq('id', w.id).single()
    expect(pub.data?.instagram_url).toBe('https://www.instagram.com/p/DAbc123_x-Y/')
  })
})

async function callBid(body: Record<string, unknown>) {
  const res = await fetch(`${FN()}/auction-bid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN() },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers }
}

describe('Edge Function auction-bid', () => {
  const valid = (artworkId: string, over: Record<string, unknown> = {}) => ({
    artworkId, amount: 100000, name: 'María Gómez', email: `m${Math.random()}@ej.com`, phone: '300 111 2233',
    consent: true, captchaToken: DUMMY_CAPTCHA, ...over,
  })

  test('sin CAPTCHA, sin consentimiento o con datos inválidos → 400 y no registra nada', async () => {
    const w = await auctionFor()
    for (const over of [{ captchaToken: '' }, { consent: false }, { email: 'x' }, { phone: 'abc' }, { amount: 'mucho' }, { name: 'A' }, { artworkId: 'no-uuid' }]) {
      const r = await callBid(valid(w.id, over))
      expect(r.status).toBe(400)
    }
    const [row] = await sql<{ bid_count: number }>('select bid_count from public.auctions where artwork_id = $1', [w.id])
    expect(row.bid_count).toBe(0)
  })

  test('oferta válida → 200 con el nuevo estado y teléfono normalizado', async () => {
    const w = await auctionFor()
    const r = await callBid(valid(w.id))
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ status: 'ok', currentAmount: 100000, bidCount: 1, minNext: 110000 })
    expect(r.body.title).toBeUndefined()
    const [b] = await sql<{ bidder_phone: string }>('select bidder_phone from public.auction_bids where artwork_id = $1', [w.id])
    expect(b.bidder_phone).toBe('3001112233')
  })

  test('oferta baja → 409 con el mínimo siguiente', async () => {
    const w = await auctionFor()
    const r = await callBid(valid(w.id, { amount: 5000 }))
    expect(r.status).toBe(409)
    expect(r.body).toMatchObject({ status: 'too_low', minNext: 100000 })
  })
})
