// Registra una oferta pública de subasta.
// Público (sin sesión): exige CAPTCHA de Turnstile y consentimiento de datos.
// La regla de la subasta vive en la base (public.place_bid, solo service_role).
import { serviceClient } from '../_shared/auth.ts'
import { bidMessage, callMeBotUrl, parseBid } from '../_shared/auction.ts'
import { fail, json, preflight, readJson } from '../_shared/http.ts'

const REJECTIONS = new Set(['too_low', 'too_high', 'already_top', 'closed'])

async function captchaOk(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) throw new Error('Falta TURNSTILE_SECRET_KEY')
  const form = new URLSearchParams({ secret, response: token })
  if (ip) form.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form, signal: AbortSignal.timeout(8000),
  })
  const out = await res.json().catch(() => null)
  return out?.success === true
}

/** Aviso por WhatsApp (CallMeBot). Si falla, la oferta ya quedó guardada: solo se registra el error. */
async function notify(text: string) {
  const phone = Deno.env.get('CALLMEBOT_PHONE'), apiKey = Deno.env.get('CALLMEBOT_APIKEY')
  if (!phone || !apiKey) return
  try {
    const res = await fetch(callMeBotUrl(phone, apiKey, text), { signal: AbortSignal.timeout(6000) })
    if (!res.ok) console.error('auction-bid: CallMeBot', res.status)
  } catch (e) {
    console.error('auction-bid: CallMeBot', e instanceof Error ? e.name : 'error')
  }
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  const origin = req.headers.get('origin')
  try {
    const input = parseBid(await readJson(req))
    if (!input) return fail(400, origin)

    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    if (!(await captchaOk(input.captchaToken, ip))) return json({ error: 'Verificación fallida', status: 'captcha' }, 400, origin)

    const { data, error } = await serviceClient().rpc('place_bid', {
      p_artwork_id: input.artworkId, p_amount: input.amount, p_name: input.name, p_email: input.email, p_phone: input.phone,
    })
    if (error) {
      // 23514 = no pasó una restricción (datos inválidos que escaparon a la validación previa).
      if (error.code === '23514') return fail(400, origin)
      throw error
    }

    const r = data as { status: string; title?: string; current_amount?: number; bid_count?: number; ends_at?: string; min_next?: number; max?: number }
    const state = { status: r.status, currentAmount: r.current_amount ?? null, bidCount: r.bid_count ?? null, endsAt: r.ends_at ?? null, minNext: r.min_next ?? null, max: r.max ?? null }
    if (REJECTIONS.has(r.status)) return json(state, 409, origin)
    if (r.status !== 'ok') throw new Error('estado inesperado')

    await notify(bidMessage({
      title: r.title!, amount: r.current_amount!, bidCount: r.bid_count!, name: input.name, email: input.email, phone: input.phone, endsAt: r.ends_at!,
    }))
    return json(state, 200, origin)
  } catch (e) {
    console.error('auction-bid', e instanceof Error ? e.message : 'error')
    return fail(500, origin)
  }
})
