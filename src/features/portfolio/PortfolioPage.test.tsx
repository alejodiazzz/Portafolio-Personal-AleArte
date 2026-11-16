import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'

const card = (i: number) => ({
  id: `a${i}`, slug: `obra-${i}`, title: `Obra ${i}`, price: 100000, currency: 'COP', availability_status: 'available',
  category_id: 'c1', technique: null, display_order: i, created_at: '', description: null, height: null, width: null,
  measurement_unit: null, creation_date: null, cover: null,
})
const calls: { page: number; categorySlug?: string }[] = []
vi.mock('./api', () => ({
  portfolioApi: {
    listCategories: async () => [{ id: 'c1', name: 'Murales', slug: 'murales' }],
    listArtworks: async (args: { page: number; categorySlug?: string }) => {
      calls.push(args)
      return args.page === 0 ? { items: [card(1), card(2)], hasMore: true } : { items: [card(3)], hasMore: false }
    },
  },
}))
import { PortfolioPage } from './PortfolioPage'

test('lista obras con enlace al detalle, filtra por categoría y carga más', async () => {
  render(<MemoryRouter initialEntries={['/?categoria=murales']}><PortfolioPage /></MemoryRouter>)
  const link = await screen.findByRole('link', { name: /Obra 1/ })
  expect(link.getAttribute('href')).toBe('/obra/obra-1')
  expect(calls[0]).toEqual({ page: 0, categorySlug: 'murales' })
  expect(screen.getAllByText('$ 100.000 COP', { exact: false })).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
  expect(await screen.findByRole('link', { name: /Obra 3/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull()
})
