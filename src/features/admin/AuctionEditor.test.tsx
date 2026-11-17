import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getAuction: vi.fn(),
  listBids: vi.fn(),
  saveAuction: vi.fn(async () => {}),
  deleteAuction: vi.fn(async () => {}),
  deleteBid: vi.fn(async () => {}),
}))
vi.mock('./api', () => ({ adminApi: api }))
import { AuctionEditor } from './AuctionEditor'

beforeEach(() => {
  vi.clearAllMocks()
  api.getAuction.mockResolvedValue(null)
  api.listBids.mockResolvedValue([])
})

test('sin subasta: se crea con base, incremento y cierre (hora local → ISO)', async () => {
  render(<AuctionEditor artworkId="a1" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Poner en subasta' }))
  fireEvent.change(screen.getByLabelText(/^Precio base/), { target: { value: '300000' } })
  fireEvent.change(screen.getByLabelText(/^Incremento mínimo/), { target: { value: '20000' } })
  fireEvent.change(screen.getByLabelText(/^Cierre/), { target: { value: '2099-12-01T18:30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar subasta' }))
  await vi.waitFor(() => expect(api.saveAuction).toHaveBeenCalled())
  expect(api.saveAuction).toHaveBeenCalledWith('a1', {
    starting_price: 300000, min_increment: 20000, ends_at: new Date('2099-12-01T18:30').toISOString(), is_active: true,
  })
})

test('valida montos y que el cierre sea futuro', async () => {
  render(<AuctionEditor artworkId="a1" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Poner en subasta' }))
  fireEvent.change(screen.getByLabelText(/^Cierre/), { target: { value: '2001-01-01T10:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar subasta' }))
  expect(await screen.findByText('Indica un precio base mayor que cero.')).toBeInTheDocument()
  expect(screen.getByText('El cierre debe ser en el futuro.')).toBeInTheDocument()
  expect(api.saveAuction).not.toHaveBeenCalled()
})

test('lista las ofertas con contacto directo y permite borrar una', async () => {
  api.getAuction.mockResolvedValue({ artwork_id: 'a1', starting_price: 100000, min_increment: 10000, ends_at: '2099-01-01T00:00:00Z', current_amount: 150000, bid_count: 2, is_active: true })
  api.listBids.mockResolvedValue([
    { id: 'b2', artwork_id: 'a1', amount: 150000, bidder_name: 'Luis P.', bidder_email: 'luis@ej.com', bidder_phone: '+573001112233', created_at: '2026-11-17T15:00:00Z' },
    { id: 'b1', artwork_id: 'a1', amount: 100000, bidder_name: 'Ana', bidder_email: 'ana@ej.com', bidder_phone: '3009998877', created_at: '2026-11-17T14:00:00Z' },
  ])
  render(<AuctionEditor artworkId="a1" />)
  const table = await screen.findByRole('table', { name: 'Ofertas' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByRole('link', { name: 'luis@ej.com' })).toHaveAttribute('href', 'mailto:luis@ej.com')
  expect(within(rows[0]).getByRole('link', { name: /\+573001112233/ })).toHaveAttribute('href', 'https://wa.me/573001112233')
  expect(screen.getByText(/2 ofertas/)).toBeInTheDocument()
  fireEvent.click(within(rows[0]).getByRole('button', { name: 'Eliminar' }))
  fireEvent.click(within(rows[0]).getByRole('button', { name: 'Sí, eliminar' }))
  await vi.waitFor(() => expect(api.deleteBid).toHaveBeenCalledWith('b2'))
})
