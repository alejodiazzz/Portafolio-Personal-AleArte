import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link } from 'react-router-dom'
import { ShowcasePage } from '../features/portfolio/ShowcasePage'

// El panel se carga aparte: los visitantes no descargan su código.
const AdminApp = lazy(() => import('../features/admin/AdminApp'))

function NotFound() {
  return (
    <main>
      <h1>Página no encontrada</h1>
      <Link to="/">Ir al portafolio</Link>
    </main>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <ShowcasePage /> },
  { path: '/obra/:slug', element: <ShowcasePage /> },
  {
    path: '/admin/*',
    element: (
      <Suspense fallback={<p>Cargando…</p>}>
        <AdminApp />
      </Suspense>
    ),
  },
  { path: '*', element: <NotFound /> },
])
