import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'

function CodeForm({ onSubmit, busy }: { onSubmit: (code: string) => void; busy: boolean }) {
  const [code, setCode] = useState('')
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        onSubmit(code)
        setCode('')
      }}
    >
      <label>
        Código de 6 dígitos{' '}
        <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
      </label>{' '}
      <button type="submit" disabled={busy}>Verificar</button>
    </form>
  )
}

export function MfaEnrollPage({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      // Elimina factores sin verificar de intentos anteriores.
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Ale Arte ${Date.now()}` })
      if (!alive) return
      if (error || !data) return setError('No se pudo iniciar la configuración')
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    })()
    return () => {
      alive = false
    }
  }, [])

  async function verify(code: string) {
    if (!factor) return
    setBusy(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    setBusy(false)
    if (error) return setError('Código incorrecto')
    onDone()
  }

  return (
    <main>
      <h1>Configura la verificación en dos pasos</h1>
      <p>Escanea el código con tu app de autenticación (Google Authenticator, Microsoft Authenticator, Aegis…).</p>
      {factor && (
        <>
          <img src={factor.qr} alt="Código QR para la app de autenticación" width={200} height={200} />
          <p>
            ¿No puedes escanear? Clave manual: <code>{factor.secret}</code>
          </p>
          <CodeForm onSubmit={verify} busy={busy} />
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={onCancel}>Cerrar sesión</button>
    </main>
  )
}

export function MfaVerifyPage({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function verify(code: string) {
    setBusy(true)
    const { data } = await supabase.auth.mfa.listFactors()
    const factor = data?.totp?.find((f) => f.status === 'verified')
    const { error } = factor
      ? await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
      : { error: new Error('sin factor') }
    setBusy(false)
    if (error) return setError('Código incorrecto')
    onDone()
  }

  return (
    <main>
      <h1>Verificación en dos pasos</h1>
      <p>Ingresa el código de tu app de autenticación.</p>
      <CodeForm onSubmit={verify} busy={busy} />
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={onCancel}>Cerrar sesión</button>
    </main>
  )
}
