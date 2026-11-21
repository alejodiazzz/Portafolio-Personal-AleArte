import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

const placed: [string, number][] = []
const art = (id: string, n: number) => ({ id, title: `Obra ${id}`, category_id: 'c1', publication_status: 'published', availability_status: 'available', display_order: n })
vi.mock('./api', () => ({
  adminApi: {
    adminListArtworks: async () => [art('a', 0), art('b', 1), art('c', 2), art('d', 3)],
    listCategories: async () => [{ id: 'c1', name: 'Murales' }],
    listCovers: async () => new Map(),
    placeArtwork: async (id: string, to: number) => { placed.push([id, to]) },
  },
}))
import { ArtworksListPage } from './ArtworksListPage'

beforeEach(() => { placed.length = 0 })

async function renderList() {
  render(<MemoryRouter><ArtworksListPage /></MemoryRouter>)
  await screen.findByText('Obra d')
  const rows = screen.getAllByRole('row').slice(1) // sin encabezado
  // jsdom no tiene layout: cada fila mide 50 px de alto, una debajo de otra.
  rows.forEach((r, i) => { r.getBoundingClientRect = () => ({ top: i * 50, bottom: i * 50 + 50, height: 50 }) as DOMRect })
  return rows
}
const titles = () => screen.getAllByRole('link', { name: /^Obra / }).map((l) => l.textContent)

test('ya no hay flechas: cada obra tiene una manija para arrastrar', async () => {
  await renderList()
  expect(screen.queryByRole('button', { name: 'Subir' })).toBeNull()
  expect(screen.getAllByRole('button', { name: /Reordenar Obra/ })).toHaveLength(4)
})

test('arrastrar y soltar lleva la obra a la posición donde se suelta', async () => {
  await renderList()
  const handle = screen.getByRole('button', { name: 'Reordenar Obra a' })
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 25, button: 0 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 140 }) // pasa la mitad de la tercera fila
  expect(titles()).toEqual(['Obra b', 'Obra c', 'Obra a', 'Obra d']) // se ve en vivo
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 140 })
  await waitFor(() => expect(placed).toEqual([['a', 2]]))
})

test('soltar en el mismo lugar no guarda nada', async () => {
  await renderList()
  const handle = screen.getByRole('button', { name: 'Reordenar Obra b' })
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: 75, button: 0 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 80 })
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 80 })
  await new Promise((r) => setTimeout(r, 20))
  expect(placed).toEqual([])
})

test('con teclado: flechas sobre la manija mueven una posición y se anuncia', async () => {
  await renderList()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Reordenar Obra c' }), { key: 'ArrowUp' })
  await waitFor(() => expect(placed).toEqual([['c', 1]]))
  expect(screen.getByText('Obra c: posición 2 de 4')).toBeInTheDocument()
})
