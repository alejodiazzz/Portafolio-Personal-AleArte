import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { env } from '../../config/env'
import { loadTurnstile } from '../../lib/turnstile'
import { money, placeBid, type BidResult } from './auction'

type Props = {
  artworkId: string
  title: string
  minNext: number
  onClose: () => void
  onPlaced: (r: Extract<BidResult, { ok: true }>) => void
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE = /^\+?[0-9]{7,15}$/

/** Formulario de oferta. Escape cierra; el foco vuelve al botón que lo abrió. */
export function BidDialog({ artworkId, title, minNext, onClose, onPlaced }: Props) {
  const headingId = useId()
  const firstRef = useRef<HTMLInputElement>(null)
  const captchaRef = useRef<HTMLDivElement>(null)
  const widget = useRef<string | undefined>(undefined)
  const [min, setMin] = useState(minNext)
  const [form, setForm] = useState({ name: '', email: '', phone: '', amount: String(minNext) })
  const [consent, setConsent] = useState(false)
  const [token, setToken] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [onClose])

  useEffect(() => {
    let alive = true
    loadTurnstile().then((t) => {
      if (!alive || !captchaRef.current) return
      widget.current = t.render(captchaRef.current, {
        sitekey: env.turnstileSiteKey, language: 'es', theme: 'light', callback: setToken, 'expired-callback': () => setToken(''),
      })
    }, () => alive && setMessage('No se pudo cargar la verificación. Recarga la página e intenta de nuevo.'))
    return () => {
      alive = false
      window.turnstile?.remove(widget.current)
    }
  }, [])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    const phone = form.phone.replace(/[\s\-().]/g, '')
    const errs: Record<string, string> = {}
    if (form.name.trim().length < 2) errs.name = 'Escribe tu nombre.'
    if (!EMAIL.test(form.email.trim())) errs.email = 'Revisa el correo.'
    if (!PHONE.test(phone)) errs.phone = 'Escribe un número de 7 a 15 dígitos.'
    if (!Number.isInteger(amount) || amount < min) errs.amount = `La oferta mínima es ${money(min)}.`
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setMessage(null)
    const r = await placeBid({ artworkId, amount, name: form.name.trim(), email: form.email.trim(), phone, consent, captchaToken: token })
    setBusy(false)
    if (r.ok) {
      setDone(true)
      onPlaced(r)
      return
    }
    setMessage(r.message)
    if (r.minNext) {
      setMin(r.minNext)
      setForm((f) => ({ ...f, amount: String(r.minNext) }))
    }
    setToken('') // cada token de Turnstile sirve una sola vez
    window.turnstile?.reset(widget.current)
  }

  const err = (k: string) => errors[k] && <span className="sc-field-error" id={`${headingId}-${k}`}>{errors[k]}</span>
  const described = (k: string) => (errors[k] ? `${headingId}-${k}` : undefined)

  return (
    <div className="sc-modal" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <div className="sc-modal-card">
        <div className="sc-modal-head">
          <h2 id={headingId}>{done ? 'Oferta registrada' : 'Hacer una oferta'}</h2>
          <button type="button" className="sc-ghost" onClick={onClose}>Cerrar <span aria-hidden="true">✕</span></button>
        </div>
        {done ? (
          <div className="sc-bid-done" role="status">
            <p>Tu oferta por <strong>{title}</strong> quedó registrada. Si alguien la supera, la verás actualizada aquí; si ganas, te contactaremos.</p>
            <button type="button" className="sc-cta" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <form className="sc-bid-form" onSubmit={submit} noValidate>
            <p className="sc-bid-for">{title} · <strong>Oferta mínima: {money(min)}</strong></p>
            <label>Nombre<input ref={firstRef} autoComplete="name" maxLength={80} value={form.name} onChange={set('name')} aria-invalid={!!errors.name} aria-describedby={described('name')} /></label>
            {err('name')}
            <label>Correo<input type="email" autoComplete="email" maxLength={254} value={form.email} onChange={set('email')} aria-invalid={!!errors.email} aria-describedby={described('email')} /></label>
            {err('email')}
            <label>Teléfono (WhatsApp)<input type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} aria-describedby={described('phone')} /></label>
            {err('phone')}
            <label>Tu oferta (COP)<input type="number" inputMode="numeric" min={min} step={1} value={form.amount} onChange={set('amount')} aria-invalid={!!errors.amount} aria-describedby={described('amount')} /></label>
            {err('amount')}
            <label className="sc-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Autorizo a Ale Arte a usar mis datos solo para contactarme sobre esta subasta (Ley 1581 de 2012). Mi nombre y mis datos no se publican.</span>
            </label>
            <div ref={captchaRef} className="sc-captcha" />
            {message && <p className="sc-bid-message" role="alert">{message}</p>}
            <button type="submit" className="sc-cta" disabled={!consent || !token || busy}>
              {busy ? 'Enviando…' : 'Enviar oferta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
