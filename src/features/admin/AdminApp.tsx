import { AdminGuard } from './auth/AdminGuard'
import { useAdminSession } from './auth/useAdminSession'
import { useIdleLogout } from './auth/useIdleLogout'
import { AdminRoutes } from './AdminRoutes'

export default function AdminApp() {
  const { status, refresh, signOut } = useAdminSession()
  useIdleLogout(() => void signOut('local'), 30, status === 'admin')

  return (
    <AdminGuard status={status} onChange={() => void refresh()} onSignOut={() => void signOut('local')}>
      <header>
        <strong>Ale Arte · Panel</strong>{' '}
        <button type="button" onClick={() => void signOut('global')}>
          Cerrar sesión
        </button>
      </header>
      <AdminRoutes />
    </AdminGuard>
  )
}
