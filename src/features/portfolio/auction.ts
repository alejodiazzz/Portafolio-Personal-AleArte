import { useEffect, useState } from 'react'
import { env } from '../../config/env'
import { publicSupabase } from '../../lib/supabase'
import type { Auction } from '../../types'
import { AUCTION_COLUMNS } from './api'

const cop = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
export const money = (n: number) => `$ ${cop.format(n)}`

export type AuctionView = { open: boolean; amount: number; hasBids: boolean; minNext: number; msLeft: number }

export function auctionView(a: Auction, now: number): AuctionView {
  const msLeft = Math.max(0, Date.parse(a.ends_at) - now)
  const hasBids = a.current_amount != null
  return {
    open: a.is_active && msLeft > 0,
    amount: a.current_amount ?? a.starting_price,
    hasBids,
    minNext: hasBids ? a.current_amount! + a.min_increment : a.starting_price,
    msLeft,
  }
}

const two = (n: number) => String(n).padStart(2, '0')
export function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d} d ${h} h`
  if (h > 0) return `${h} h ${m} min`
  if (m > 0) return `${m} min ${two(s % 60)} s`
  return `${s % 60} s`
}

export type BidRequest = { artworkId: string; amount: number; name: string; email: string; phone: string; consent: boolean; captchaToken: string }
export type BidResult =
  | { ok: true; currentAmount: number; bidCount: number; endsAt: string }
  | { ok: false; message: string; minNext?: number }

const NETWORK = 'No se pudo enviar la oferta. Revisa tu conexión e intenta de nuevo.'
const GENERIC = 'No se pudo enviar la oferta. Intenta de nuevo en un momento.'

function reason(b: { status?: string; minNext?: number; max?: number }): string {
  switch (b.status) {
    case 'too_low': return `Alguien ofertó antes que tú. La oferta mínima ahora es ${money(b.minNext!)}.`
    case 'too_high': return `La oferta supera el máximo permitido (${money(b.max!)}). Si quieres ofrecer más, escríbenos por WhatsApp.`
    case 'already_top': return 'Ya tienes la oferta más alta.'
    case 'closed': return 'La subasta ya cerró.'
    case 'captcha': return 'No pudimos verificar que no eres un robot. Intenta de nuevo.'
    default: return GENERIC
  }
}

export async function placeBid(input: BidRequest): Promise<BidResult> {
  let res: Response
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/auction-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.supabasePublishableKey },
      body: JSON.stringify(input),
    })
  } catch {
    return { ok: false, message: NETWORK }
  }
  const body = await res.json().catch(() => ({}))
  if (res.ok && body.status === 'ok') return { ok: true, currentAmount: body.currentAmount, bidCount: body.bidCount, endsAt: body.endsAt }
  return { ok: false, message: reason(body), ...(body.minNext ? { minNext: body.minNext } : {}) }
}

/** Estado de la subasta en vivo: escucha cambios por Realtime y vuelve a consultar al regresar a la pestaña. */
export function useLiveAuction(initial: Auction | null): [Auction | null, (a: Auction) => void] {
  const [live, setLive] = useState<{ base: Auction | null; value: Auction | null }>({ base: initial, value: initial })
  // Si cambia la obra, se parte del estado recibido con la lista.
  const value = live.base === initial ? live.value : initial
  const id = initial?.artwork_id
  useEffect(() => {
    if (!id) return
    const apply = (a: Auction) => setLive({ base: initial, value: a })
    const channel = publicSupabase
      .channel(`auction:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `artwork_id=eq.${id}` },
        (p) => apply(p.new as Auction))
      .subscribe()
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      const { data } = await publicSupabase.from('auctions').select(AUCTION_COLUMNS).eq('artwork_id', id).maybeSingle()
      if (data) apply(data as Auction)
    }
    document.addEventListener('visibilitychange', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      void publicSupabase.removeChannel(channel)
    }
  }, [id, initial])
  return [value, (a: Auction) => setLive({ base: initial, value: a })]
}

/** Reloj para la cuenta regresiva. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
