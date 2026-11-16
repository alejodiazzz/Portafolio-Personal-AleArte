import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

const created: unknown[] = []
vi.mock('./api', () => ({
  adminApi: {
    listCategories: async () => [{ id: '11111111-2222-4333-8444-555555555555', name: 'Murales', slug: 'murales' }],
    takenSlugs: async () => ['luna'],
    createArtwork: async (input: unknown) => {
      created.push(input)
      return { id: 'new-id' }
    },
    adminGetArtwork: async () => null,
  },
}))
import { ArtworkFormPage } from './ArtworkFormPage'

beforeEach(() => {
  created.length = 0
})

async function renderNew() {
  render(
    <MemoryRouter initialEntries={['/admin/obras/nueva']}>
      <Routes>
        <Route path="/admin/obras/nueva" element={<ArtworkFormPage />} />
        <Route path="/admin/obras/:id" element={<p>editando</p>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('option', { name: 'Murales' })
}
const set = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

test('precio negativo muestra error y no crea', async () => {
  await renderNew()
  set(/^Título/, 'Luna')
  set(/^Precio/, '-5')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('El precio no puede ser negativo')).toBeInTheDocument()
  expect(created).toHaveLength(0)
})
test('medidas sin unidad muestra error', async () => {
  await renderNew()
  set(/^Título/, 'Luna')
  set(/^Alto/, '50')
  set(/^Ancho/, '40')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('Indica la unidad de medida')).toBeInTheDocument()
  expect(created).toHaveLength(0)
})
test('genera slug único desde el título y crea la obra', async () => {
  await renderNew()
  set(/^Título/, 'Luna')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('editando')).toBeInTheDocument()
  expect(created[0]).toMatchObject({ title: 'Luna', slug: 'luna-2', price: null, category_id: '11111111-2222-4333-8444-555555555555' })
})
