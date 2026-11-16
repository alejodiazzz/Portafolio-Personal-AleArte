import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

const work = (i: number, over: Record<string, unknown> = {}) => ({
  id: `a${i}`, slug: `obra-${i}`, title: `Obra ${i}`, description: null, price: 100000, currency: 'COP',
  height: 30, width: 20, measurement_unit: 'cm', technique: `Técnica ${i}`, category_id: 'c1', creation_date: null,
  availability_status: 'available', display_order: i, created_at: '',
  cover: { id: `i${i}`, artwork_id: `a${i}`, storage_path: `ale-arte/artworks/a${i}/x`, image_alt: null, width: 800, height: 1000,
    is_cover: true, display_order: 0, dominant_color: '#183961' },
  ...over,
})
const CATS = [
  { id: 'c1', name: 'Pinturas acrílicas', slug: 'acrilicos' },
  { id: 'c2', name: 'Murales', slug: 'murales' },
  { id: 'c3', name: 'Vacía', slug: 'vacia' },
]
let listImpl: () => Promise<unknown[]>
vi.mock('./api', () => ({
  portfolioApi: { listCategories: async () => CATS, listShowcase: () => listImpl() },
}))
import { ShowcasePage } from './ShowcasePage'

beforeEach(() => {
  listImpl = async () => [
    work(1),
    work(2, { availability_status: 'commission', price: null, description: 'Por encargo.' }),
    work(3, { category_id: 'c2', title: 'Mural 3', cover: { ...work(3).cover, dominant_color: '#f0e8d8' } }),
  ]
})

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname + l.search}</output>
}
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<ShowcasePage />} />
        <Route path="/obra/:slug" element={<ShowcasePage />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

test('muestra la primera obra con sus datos, contador, color y WhatsApp', async () => {
  renderAt('/')
  expect(await screen.findByRole('heading', { level: 1, name: 'Obra 1' })).toBeInTheDocument()
  expect(screen.getByText('Técnica 1')).toBeInTheDocument()
  expect(document.querySelector('.sc-price')?.textContent).toBe('$ 100.000 COP')
  expect(screen.getByText('Disponible')).toBeInTheDocument()
  expect(screen.getByText('30 × 20 cm')).toBeInTheDocument()
  expect(screen.getByText('01 / 03')).toBeInTheDocument()
  expect(screen.getByTestId('showcase').style.getPropertyValue('--bg')).toBe('#183961')
  const cta = screen.getByRole('link', { name: /Lo quiero/ })
  expect(decodeURIComponent(cta.getAttribute('href')!)).toContain('"Obra 1": http://localhost:5173/obra/obra-1')
  expect(document.title).toBe('Obra 1 · Ale Arte')
})

test('siguiente / anterior (botones y teclado) cambian la obra y la URL', async () => {
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Obra siguiente' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Obra 2' })).toBeInTheDocument()
  expect(screen.getByTestId('where').textContent).toBe('/obra/obra-2')
  expect(screen.getByText('Cotiza la tuya', { selector: '.sc-price' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Cotiza la tuya/ })).toBeInTheDocument()
  expect(screen.getByText('Por encargo.')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(screen.getByRole('heading', { level: 1, name: 'Mural 3' })).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'ArrowRight' })
  expect(screen.getByRole('heading', { level: 1, name: 'Obra 1' })).toBeInTheDocument() // vuelve al inicio
  fireEvent.click(screen.getByRole('button', { name: 'Obra anterior' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Mural 3' })).toBeInTheDocument()
})

test('fondo claro → texto oscuro', async () => {
  renderAt('/obra/obra-3')
  await screen.findByRole('heading', { name: 'Mural 3' })
  expect(screen.getByTestId('showcase').classList.contains('is-light')).toBe(true)
})

test('abre directamente la obra del enlace', async () => {
  renderAt('/obra/obra-2')
  expect(await screen.findByRole('heading', { level: 1, name: 'Obra 2' })).toBeInTheDocument()
  expect(screen.getByText('02 / 03')).toBeInTheDocument()
})

test('enlace a una obra que no existe o no está publicada', async () => {
  renderAt('/obra/no-existe')
  expect(await screen.findByText('Esta obra no está disponible.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Ver todas las obras' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Obra 1' })).toBeInTheDocument()
})

test('las categorías filtran el recorrido y solo aparecen las que tienen obras', async () => {
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  const nav = screen.getByRole('navigation', { name: 'Categorías' })
  expect(within(nav).queryByRole('button', { name: 'Vacía' })).toBeNull()
  fireEvent.click(within(nav).getByRole('button', { name: 'Murales' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Mural 3' })).toBeInTheDocument()
  expect(screen.getByText('01 / 01')).toBeInTheDocument()
  expect(screen.getByTestId('where').textContent).toBe('/obra/obra-3?categoria=murales')
  expect(within(nav).getByRole('button', { name: 'Murales' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(within(nav).getByRole('button', { name: 'Todas' }))
  expect(screen.getByText('01 / 03')).toBeInTheDocument()
})

test('el índice lista las obras y permite saltar a una', async () => {
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  fireEvent.click(screen.getByRole('button', { name: /Índice/ }))
  const dialog = screen.getByRole('dialog', { name: 'Índice de obras' })
  fireEvent.click(within(dialog).getByRole('button', { name: /Mural 3/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'Mural 3' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Índice/ }))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('sin obras publicadas', async () => {
  listImpl = async () => []
  renderAt('/')
  expect(await screen.findByText('Pronto habrá obras aquí.')).toBeInTheDocument()
})

test('error de red → mensaje genérico, sin detalles internos', async () => {
  listImpl = async () => { throw new Error('relation private.app_admin') }
  renderAt('/')
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.queryByText(/private/)).toBeNull()
})
