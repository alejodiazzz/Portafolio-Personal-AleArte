import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/manrope/index.css'
import './admin.css'
import { Link, NavLink } from 'react-router-dom'
import { AdminGuard } from './auth/AdminGuard'
import { useAdminSession } from './auth/useAdminSession'
import { useIdleLogout } from './auth/useIdleLogout'
import { AdminRoutes } from './AdminRoutes'

export default function AdminApp() {
  const { status, refresh, signOut } = useAdminSession()
  useIdleLogout(() => void signOut('local'), 30, status === 'admin')

  return (
    <div className="ad">
      <AdminGuard status={status} onChange={() => void refresh()} onSignOut={() => void signOut('local')}>
        <header className="ad-top">
          <Link to="/admin" className="ad-brand">Ale Arte <small>Panel</small></Link>
          <nav className="ad-nav" aria-label="Secciones del panel">
            <NavLink to="/admin" end>Obras</NavLink>
            <NavLink to="/admin/categorias">Categorías</NavLink>
          </nav>
          <div className="ad-top-end">
            <a href="/" target="_blank" rel="noopener noreferrer">Ver sitio ↗</a>
            <button type="button" className="is-small" onClick={() => void signOut('global')}>Cerrar sesión</button>
          </div>
        </header>
        <AdminRoutes />
      </AdminGuard>
    </div>
  )
}
