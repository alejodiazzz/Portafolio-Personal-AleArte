import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import type { ArtworkDetail } from './api'

// Implementación intercambiable (sin vi.fn: Vitest 5 reporta como error los rechazos devueltos por mocks).
let impl: (slug: string) => Promise<ArtworkDetail | null> = async () => null
const getArtworkBySlug = {
  mockResolvedValue: (v: ArtworkDetail | null) => { impl = async () => v },
  mockRejectedValue: (e: unknown) => { impl = () => Promise.reject(e) },
}
vi.mock('./api', () => ({ portfolioApi: { getArtworkBySlug: (s: string) => impl(s), listCategories: async () => [] } }))
import { ArtworkPage } from './ArtworkPage'

const detail: ArtworkDetail = {
  id: 'a1', slug: 'luna', title: '<b>x</b>', description: 'Óleo <img src=x onerror=alert(1)>', price: null, currency: 'COP',
  height: 50, width: 40, measurement_unit: 'cm', technique: 'Acrílico', category_id: 'c1', creation_date: null,
  availability_status: 'sold', display_order: 0, created_at: '', images: [],
}

function renderAt(slug: string) {
  render(
    <MemoryRouter initialEntries={[`/obra/${slug}`]}>
      <Routes>
        <Route path="/obra/:slug" element={<ArtworkPage />} />
      </Routes>
    </MemoryRouter>,
  )
}


test('muestra el título como texto literal (sin HTML)', async () => {
  getArtworkBySlug.mockResolvedValue(detail)
  renderAt('luna')
  expect(await screen.findByRole('heading', { name: '<b>x</b>' })).toBeInTheDocument()
  expect(document.querySelector('h1 b')).toBeNull()
  expect(document.querySelector('img[src="x"]')).toBeNull()
})
test('muestra estado Vendida, medidas y técnica', async () => {
  getArtworkBySlug.mockResolvedValue(detail)
  renderAt('luna')
  expect(await screen.findByText('Vendida')).toBeInTheDocument()
  expect(screen.getByText('50 × 40 cm')).toBeInTheDocument()
  expect(screen.getByText('Acrílico')).toBeInTheDocument()
})
test('enlace de WhatsApp incluye el título de la obra', async () => {
  getArtworkBySlug.mockResolvedValue(detail)
  renderAt('luna')
  const link = await screen.findByRole('link', { name: /whatsapp/i })
  expect(link.getAttribute('href')).toContain(encodeURIComponent('"<b>x</b>"'))
  expect(link.getAttribute('rel')).toContain('noopener')
})
test('obra sin imágenes muestra "Sin imagen"', async () => {
  getArtworkBySlug.mockResolvedValue(detail)
  renderAt('luna')
  expect(await screen.findByText('Sin imagen')).toBeInTheDocument()
})
test('slug inexistente → Obra no encontrada', async () => {
  getArtworkBySlug.mockResolvedValue(null)
  renderAt('nada')
  expect(await screen.findByText('Obra no encontrada')).toBeInTheDocument()
})
test('error de red → mensaje genérico', async () => {
  getArtworkBySlug.mockRejectedValue(new Error('relation private.x'))
  renderAt('luna')
  expect(await screen.findByText('Ocurrió un error, intenta de nuevo')).toBeInTheDocument()
})
