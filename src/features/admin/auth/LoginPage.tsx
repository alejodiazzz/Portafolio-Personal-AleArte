import { useEffect, useRef, useState, type FormEvent } from 'react'
import { env } from '../../../config/env'
import { supabase } from '../../../lib/supabase'
import { loadTurnstile } from '../../../lib/turnstile'

export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || !box.current) return
        widget.current = t.render(box.current, {
          sitekey: env.turnstileSiteKey,
          callback: setToken,
          'expired-callback': () => setToken(null),
          language: 'es',
        })
      })
      .catch(() => setError('No se pudo cargar la verificación. Recarga la página.'))
    return () => {
      cancelled = true
      window.turnstile?.remove(widget.current)
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token) return setError('Completa la verificación')
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken: token } })
    setBusy(false)
    window.turnstile?.reset(widget.current)
    setToken(null)
    if (error) {
      setPassword('')
      return setError(error.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'Credenciales inválidas')
    }
    onSignedIn()
  }

  return (
    <main>
      <h1>Iniciar sesión</h1>
      <form onSubmit={submit}>
        <p>
          <label>
            Correo <input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </p>
        <p>
          <label>
            Contraseña{' '}
            <input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </p>
        <div ref={box} />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}
