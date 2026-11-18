import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const work = (i: number, over: Record<string, unknown> = {}) => ({
  id: `a${i}`, slug: `obra-${i}`, title: `Obra ${i}`, description: null, price: 100000, currency: 'COP',
  height: 30, width: 20, measurement_unit: 'cm', technique: `Técnica ${i}`, category_id: 'c1', creation_date: null,
  availability_status: 'available', display_order: i, created_at: '', instagram_url: null, auction: null,
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
vi.mock('./auction', async (orig) => ({ ...(await orig<typeof import('./auction')>()), useLiveAuction: (a: unknown) => [a, () => {}] }))
vi.mock('../../lib/turnstile', () => ({ loadTurnstile: () => new Promise(() => {}) }))
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
  await waitFor(() => expect(document.title).toBe('Obra 1 · Ale Arte')) // se fija en un efecto
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

test('deslizar en ambos sentidos anima la entrada y la salida', async () => {
  renderAt('/obra/obra-2')
  await screen.findByRole('heading', { name: 'Obra 2' })
  const art = document.querySelector('.sc-art')!
  const swipe = (from: number, to: number) => {
    fireEvent.touchStart(art, { touches: [{ clientX: from }] })
    fireEvent.touchEnd(art, { changedTouches: [{ clientX: to }] })
  }
  swipe(300, 100) // hacia la izquierda → siguiente
  expect(screen.getByRole('heading', { level: 1, name: 'Mural 3' })).toBeInTheDocument()
  expect(document.querySelector('.sc-piece.is-out:not(.is-back)')).not.toBeNull()
  expect(document.querySelector('.sc-piece.is-in:not(.is-back)')).not.toBeNull()
  swipe(100, 300) // hacia la derecha → anterior
  expect(screen.getByRole('heading', { level: 1, name: 'Obra 2' })).toBeInTheDocument()
  expect(document.querySelector('.sc-piece.is-out.is-back')).not.toBeNull()
  expect(document.querySelector('.sc-piece.is-in.is-back')).not.toBeNull()
})

test('la obra entrante espera a que cargue su imagen antes de animarse', async () => {
  renderAt('/obra/obra-1')
  await screen.findByRole('heading', { name: 'Obra 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Obra anterior' }))
  const incoming = document.querySelector('.sc-piece.is-in')!
  expect(incoming.classList.contains('is-loading')).toBe(true)
  fireEvent.load(incoming.querySelector('img')!)
  expect(incoming.classList.contains('is-loading')).toBe(false)
})

test('la entrada espera a que la imagen esté decodificada (no anima un marco vacío)', async () => {
  let finish!: () => void
  // jsdom no implementa decode(): se define solo para esta prueba.
  const proto = HTMLImageElement.prototype as { decode?: () => Promise<void> }
  proto.decode = () => new Promise<void>((r) => { finish = r })
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  fireEvent.click(screen.getByRole('button', { name: 'Obra siguiente' }))
  const incoming = document.querySelector('.sc-piece.is-in')!
  fireEvent.load(incoming.querySelector('img')!)
  expect(incoming.classList.contains('is-loading')).toBe(true)
  finish()
  await waitFor(() => expect(incoming.classList.contains('is-loading')).toBe(false))
  delete proto.decode
})

test('el srcset de la obra usa el ancho real del original', async () => {
  listImpl = async () => [work(1, { cover: { ...work(1).cover, width: 700, height: 900 } })]
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  expect(document.querySelector('.sc-piece img')!.getAttribute('srcset')).toMatch(/ 700w$/)
})

test('la obra que sale es el mismo elemento que estaba en pantalla (no se recrea ni se vuelve a decodificar)', async () => {
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  for (const dir of ['Obra siguiente', 'Obra anterior']) {
    const shown = document.querySelector('.sc-piece.is-in')!
    const shownImg = shown.querySelector('img')
    fireEvent.click(screen.getByRole('button', { name: dir }))
    const out = document.querySelector('.sc-piece.is-out')!
    expect(out).toBe(shown)
    expect(out.querySelector('img')).toBe(shownImg)
    expect(out.classList.contains('is-loading')).toBe(false)
  }
})

test('precarga la obra anterior y la siguiente con el mismo srcset que usa la página', async () => {
  const seen: string[] = []
  vi.stubGlobal('Image', class { sizes = ''; set srcset(v: string) { seen.push(v) } set src(_v: string) {} })
  renderAt('/obra/obra-2')
  await screen.findByRole('heading', { name: 'Obra 2' })
  expect(seen.some((s) => s.includes('/a1/'))).toBe(true)
  expect(seen.some((s) => s.includes('/a3/'))).toBe(true)
  vi.unstubAllGlobals()
})

test('redes sociales como íconos con nombre accesible', async () => {
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  const social = document.querySelector('.sc-social')!
  for (const name of ['Instagram', 'WhatsApp']) {
    const link = within(social as HTMLElement).getByRole('link', { name })
    expect(link.querySelector('svg')).not.toBeNull()
    expect(link.textContent).toBe('')
  }
})

test('botón a la publicación de Instagram solo si la obra la tiene', async () => {
  listImpl = async () => [work(1, { instagram_url: 'https://www.instagram.com/p/DAbc123/' }), work(2)]
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  expect(screen.getByRole('link', { name: /Ver en Instagram/ })).toHaveAttribute('href', 'https://www.instagram.com/p/DAbc123/')
  fireEvent.click(screen.getByRole('button', { name: 'Obra siguiente' }))
  expect(screen.queryByRole('link', { name: /Ver en Instagram/ })).toBeNull()
})

const auction = (over: Record<string, unknown> = {}) => ({
  artwork_id: 'a1', starting_price: 200000, min_increment: 20000, ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  current_amount: null, bid_count: 0, is_active: true, ...over,
})

test('obra en subasta: base, cierre y botón Ofertar que abre el formulario', async () => {
  listImpl = async () => [work(1, { auction: auction() })]
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  expect(screen.getByText('En subasta')).toBeInTheDocument()
  expect(document.querySelector('.sc-price')?.textContent).toBe('$ 200.000 COP')
  expect(screen.getByText('Precio base · aún sin ofertas')).toBeInTheDocument()
  expect(screen.getByText(/Cierra en 2 d 23 h|Cierra en 3 d 0 h/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Ofertar/ }))
  const dialog = screen.getByRole('dialog', { name: 'Hacer una oferta' })
  expect(within(dialog).getByLabelText(/Tu oferta/)).toHaveValue(200000)
  expect(within(dialog).getByText(/Oferta mínima: \$ 200\.000/)).toBeInTheDocument()
  expect(within(dialog).getByRole('checkbox')).not.toBeChecked()
  expect(within(dialog).getByRole('button', { name: 'Enviar oferta' })).toBeDisabled()
})

test('subasta con ofertas muestra la actual y el conteo; cerrada vuelve a WhatsApp', async () => {
  listImpl = async () => [
    work(1, { auction: auction({ current_amount: 260000, bid_count: 3 }) }),
    work(2, { auction: auction({ artwork_id: 'a2', ends_at: new Date(Date.now() - 1000).toISOString(), current_amount: 300000, bid_count: 5 }) }),
  ]
  renderAt('/')
  await screen.findByRole('heading', { name: 'Obra 1' })
  expect(screen.getByText('Oferta actual · 3 ofertas')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Obra siguiente' }))
  expect(screen.getByText('Subasta cerrada')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Ofertar/ })).toBeNull()
  expect(screen.getByRole('link', { name: /Me interesa/ })).toHaveAttribute('href', expect.stringContaining('wa.me'))
})

describe('visor de detalle', () => {
  const scaleOf = (el: HTMLElement) => Number(el.style.transform.match(/scale\(([\d.]+)\)/)?.[1] ?? 1)

  test('el botón abre el visor en alta resolución; Escape lo cierra y devuelve el foco', async () => {
    renderAt('/')
    await screen.findByRole('heading', { name: 'Obra 1' })
    const open = screen.getByRole('button', { name: /Ver detalle/ })
    open.focus()
    fireEvent.click(open)
    const dialog = screen.getByRole('dialog', { name: 'Detalle de Obra 1' })
    const img = within(dialog).getByRole('img', { name: /Obra 1/ })
    expect(img.getAttribute('src')).toMatch(/w_(1600|2560)/)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /Detalle/ })).toBeNull()
    expect(document.activeElement).toBe(open)
  })

  test('acercar, alejar y restablecer con botones y teclado; las flechas no cambian de obra', async () => {
    renderAt('/')
    await screen.findByRole('heading', { name: 'Obra 1' })
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }))
    const dialog = screen.getByRole('dialog')
    const layer = dialog.querySelector<HTMLElement>('.sc-zoom-layer')!
    fireEvent.click(within(dialog).getByRole('button', { name: 'Acercar' }))
    expect(scaleOf(layer)).toBeGreaterThan(1)
    fireEvent.keyDown(window, { key: '+' })
    const zoomed = scaleOf(layer)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alejar' }))
    expect(scaleOf(layer)).toBeLessThan(zoomed)
    fireEvent.keyDown(window, { key: '0' })
    expect(scaleOf(layer)).toBe(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { level: 1, name: 'Obra 1' })).toBeInTheDocument()
  })

  test('obra sin imagen: no hay botón de detalle', async () => {
    listImpl = async () => [work(1, { cover: null })]
    renderAt('/')
    await screen.findByRole('heading', { name: 'Obra 1' })
    expect(screen.queryByRole('button', { name: /Ver detalle/ })).toBeNull()
  })
})

describe('vista compacta (móvil)', () => {
  test('línea breve bajo el título: técnica y precio, o estado', async () => {
    renderAt('/')
    await screen.findByRole('heading', { name: 'Obra 1' })
    expect(document.querySelector('.sc-sub')?.textContent).toBe('Técnica 1 · $ 100.000 COP')
    fireEvent.click(screen.getByRole('button', { name: 'Obra siguiente' }))
    expect(document.querySelector('.sc-sub')?.textContent).toBe('Técnica 2 · Por encargo')
  })

  test('en subasta, la línea muestra la oferta y el cierre', async () => {
    listImpl = async () => [work(1, { auction: {
      artwork_id: 'a1', starting_price: 200000, min_increment: 20000, ends_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
      current_amount: 260000, bid_count: 3, is_active: true } })]
    renderAt('/')
    await screen.findByRole('heading', { name: 'Obra 1' })
    expect(document.querySelector('.sc-sub')?.textContent).toMatch(/^Subasta · \$ 260\.000 · cierra en 2 h 59 min|^Subasta · \$ 260\.000 · cierra en 3 h 0 min/)
  })

  test('el botón Detalles abre una hoja con descripción, medidas y enlaces', async () => {
    listImpl = async () => [work(1, { description: 'Grafito sobre papel.', instagram_url: 'https://www.instagram.com/p/DAbc123/' })]
    renderAt('/')
    await screen.findByRole('heading', { name: 'Obra 1' })
    const btn = screen.getByRole('button', { name: 'Detalles de la obra' })
    btn.focus()
    fireEvent.click(btn)
    const sheet = screen.getByRole('dialog', { name: 'Detalles de Obra 1' })
    expect(within(sheet).getByText('Grafito sobre papel.')).toBeInTheDocument()
    expect(within(sheet).getByText('30 × 20 cm')).toBeInTheDocument()
    expect(within(sheet).getByText('Pinturas acrílicas')).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: /Ver en Instagram/ })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' }) // con la hoja abierta no cambia de obra
    expect(screen.getByRole('heading', { level: 1, name: 'Obra 1' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })

  test('el índice también filtra por categoría', async () => {
    renderAt('/')
    await screen.findByRole('heading', { name: 'Obra 1' })
    fireEvent.click(screen.getByRole('button', { name: /Índice/ }))
    const dialog = screen.getByRole('dialog', { name: 'Índice de obras' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Murales' }))
    expect(within(dialog).queryByRole('button', { name: /Obra 1/ })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: /Mural 3/ }))
    expect(screen.getByTestId('where').textContent).toBe('/obra/obra-3?categoria=murales')
  })
})
