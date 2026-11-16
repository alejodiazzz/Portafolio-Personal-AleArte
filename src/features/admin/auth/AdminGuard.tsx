import type { ReactNode } from 'react'
import { LoginPage } from './LoginPage'
import { MfaEnrollPage, MfaVerifyPage } from './MfaPage'
import type { AdminStatus } from './useAdminSession'

/**
 * Solo UX: decide qué pantalla mostrar. La protección real está en RLS y en las Edge Functions.
 */
export function AdminGuard({
  status,
  onChange,
  onSignOut = () => {},
  children,
}: {
  status: AdminStatus
  onChange: () => void
  onSignOut?: () => void
  children: ReactNode
}) {
  switch (status) {
    case 'loading':
      return <p>Cargando…</p>
    case 'anon':
      return <LoginPage onSignedIn={onChange} />
    case 'needs-mfa-enroll':
      return <MfaEnrollPage onDone={onChange} onCancel={onSignOut} />
    case 'needs-mfa-verify':
      return <MfaVerifyPage onDone={onChange} onCancel={onSignOut} />
    case 'forbidden':
      return (
        <main>
          <h1>No autorizado</h1>
          <p>Esta cuenta no tiene acceso al panel.</p>
        </main>
      )
    case 'admin':
      return <>{children}</>
  }
}
