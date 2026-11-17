import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toUserMessage } from '../../lib/errors'
import type { Auction, AuctionBid } from '../../types'
import { adminApi } from './api'

const cop = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const money = (n: number) => `$ ${cop.format(n)}`
const when = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** ISO → valor de <input type="datetime-local"> en la hora del navegador. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Enlace de WhatsApp; los celulares colombianos sin indicativo reciben el 57. */
function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${!phone.startsWith('+') && digits.length === 10 ? `57${digits}` : digits}`
}

type Form = { starting_price: string; min_increment: string; ends_at: string; is_active: boolean }

export function AuctionEditor({ artworkId }: { artworkId: string }) {
  const [auction, setAuction] = useState<Auction | null>(null)
  const [bids, setBids] = useState<AuctionBid[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(0)

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([adminApi.getAuction(artworkId), adminApi.listBids(artworkId)])
      setAuction(a)
      setBids(b)
      setNow(Date.now())
      setForm(a ? { starting_price: String(a.starting_price), min_increment: String(a.min_increment), ends_at: toLocalInput(a.ends_at), is_active: a.is_active } : null)
    } catch (e) {
      setMessage(toUserMessage(e))
    } finally {
      setLoaded(true)
    }
  }, [artworkId])
  useEffect(() => { void load() }, [load])

  async function run(fn: () => Promise<unknown>, done?: string) {
    setMessage(null)
    try {
      await fn()
      await load()
      if (done) setMessage(done)
    } catch (e) {
      setMessage(toUserMessage(e))
    }
  }

  function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const start = Number(form.starting_price), inc = Number(form.min_increment), end = new Date(form.ends_at)
    const errs: Record<string, string> = {}
    if (!Number.isInteger(start) || start <= 0) errs.starting_price = 'Indica un precio base mayor que cero.'
    if (!Number.isInteger(inc) || inc <= 0) errs.min_increment = 'Indica un incremento mayor que cero.'
    if (Number.isNaN(end.getTime())) errs.ends_at = 'Indica la fecha y hora de cierre.'
    else if (!auction && end.getTime() <= Date.now()) errs.ends_at = 'El cierre debe ser en el futuro.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    void run(() => adminApi.saveAuction(artworkId, { starting_price: start, min_increment: inc, ends_at: end.toISOString(), is_active: form.is_active }), 'Subasta guardada')
  }

  if (!loaded) return null
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => f && { ...f, [k]: e.target.value })
  const err = (k: string) => errors[k] && <span className="ad-error" role="alert">{errors[k]}</span>
  const open = auction && auction.is_active && Date.parse(auction.ends_at) > now

  return (
    <section className="ad-card" aria-labelledby="ad-auction-title">
      <div className="ad-card-head">
        <h2 id="ad-auction-title">Subasta</h2>
        {auction && (
          <span className={`ad-badge ${open ? 'is-live' : 'is-muted'}`}>{open ? 'En curso' : auction.is_active ? 'Cerrada' : 'Pausada'}</span>
        )}
      </div>

      {!form ? (
        <>
          <p className="ad-hint">Activa una subasta para que el público pueda ofertar. Cada oferta te llega por WhatsApp.</p>
          <button type="button" className="ad-btn" onClick={() => setForm({ starting_price: '', min_increment: '', ends_at: '', is_active: true })}>Poner en subasta</button>
        </>
      ) : (
        <form className="ad-form" onSubmit={save} noValidate>
          {auction && (
            <p className="ad-summary ad-wide">
              {auction.current_amount != null ? <>Oferta actual <strong>{money(auction.current_amount)}</strong> · </> : 'Aún sin ofertas · '}
              {auction.bid_count} {auction.bid_count === 1 ? 'oferta' : 'ofertas'} · cierra {when.format(new Date(auction.ends_at))}
            </p>
          )}
          <p><label>Precio base (COP)<input type="number" min={1} step={1} value={form.starting_price} onChange={set('starting_price')} /></label>{err('starting_price')}</p>
          <p><label>Incremento mínimo (COP)<input type="number" min={1} step={1} value={form.min_increment} onChange={set('min_increment')} /></label>{err('min_increment')}</p>
          <p><label>Cierre (tu hora local)<input type="datetime-local" value={form.ends_at} onChange={set('ends_at')} /></label>{err('ends_at')}</p>
          <p className="ad-check"><label><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Visible y recibiendo ofertas</label></p>
          <p className="ad-hint ad-wide">Si alguien oferta en los últimos 5 minutos, el cierre se extiende 5 minutos.</p>
          <div className="ad-actions ad-wide">
            <button type="submit" className="ad-btn">Guardar subasta</button>
            {auction && (confirming === 'auction' ? (
              <span className="ad-confirm">¿Quitar la subasta y borrar sus {bids.length} ofertas?{' '}
                <button type="button" className="ad-btn is-danger" onClick={() => run(() => adminApi.deleteAuction(artworkId), 'Subasta eliminada').then(() => setConfirming(null))}>Sí, quitar</button>{' '}
                <button type="button" className="ad-btn is-ghost" onClick={() => setConfirming(null)}>Cancelar</button>
              </span>
            ) : (
              <button type="button" className="ad-btn is-ghost" onClick={() => setConfirming('auction')}>Quitar subasta</button>
            ))}
            {!auction && <button type="button" className="ad-btn is-ghost" onClick={() => setForm(null)}>Cancelar</button>}
          </div>
        </form>
      )}

      {message && <p className="ad-status" role="status">{message}</p>}

      {auction && (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <caption>Ofertas</caption>
            <thead><tr><th>Monto</th><th>Nombre</th><th>Contacto</th><th>Fecha</th><th><span className="ad-sr">Acciones</span></th></tr></thead>
            <tbody>
              {bids.map((b) => (
                <tr key={b.id}>
                  <td className="ad-num">{money(b.amount)}</td>
                  <td>{b.bidder_name}</td>
                  <td className="ad-contact">
                    <a href={waLink(b.bidder_phone)} target="_blank" rel="noopener noreferrer">{b.bidder_phone}</a>
                    <a href={`mailto:${b.bidder_email}`}>{b.bidder_email}</a>
                  </td>
                  <td>{when.format(new Date(b.created_at))}</td>
                  <td className="ad-row-actions">
                    {confirming === b.id ? (
                      <>
                        <button type="button" className="ad-btn is-danger is-small" onClick={() => run(() => adminApi.deleteBid(b.id), 'Oferta eliminada').then(() => setConfirming(null))}>Sí, eliminar</button>{' '}
                        <button type="button" className="ad-btn is-ghost is-small" onClick={() => setConfirming(null)}>Cancelar</button>
                      </>
                    ) : (
                      <button type="button" className="ad-btn is-ghost is-small" onClick={() => setConfirming(b.id)}>Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bids.length === 0 && <p className="ad-hint">Todavía no hay ofertas.</p>}
        </div>
      )}
    </section>
  )
}
