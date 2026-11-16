import { expect, test } from 'vitest'
import { artworkInputSchema } from './schema'

const base = {
  title: 'Luna', slug: 'luna', description: null, price: null, height: null, width: null, measurement_unit: null,
  technique: null, category_id: '11111111-2222-4333-8444-555555555555', creation_date: null,
  availability_status: 'available', publication_status: 'draft', display_order: 0,
}
test('acepta obra mínima', () => {
  expect(artworkInputSchema.safeParse(base).success).toBe(true)
})
test('rechaza título vacío', () => {
  expect(artworkInputSchema.safeParse({ ...base, title: '   ' }).success).toBe(false)
})
test('rechaza precio negativo', () => {
  expect(artworkInputSchema.safeParse({ ...base, price: -5 }).success).toBe(false)
})
test('rechaza medidas sin unidad', () => {
  expect(artworkInputSchema.safeParse({ ...base, height: 50, width: 40 }).success).toBe(false)
})
test('acepta medidas con unidad', () => {
  expect(artworkInputSchema.safeParse({ ...base, height: 50, width: 40, measurement_unit: 'cm' }).success).toBe(true)
})
test('rechaza slug con mayúsculas o espacios', () => {
  expect(artworkInputSchema.safeParse({ ...base, slug: 'Luna Llena' }).success).toBe(false)
})
test('rechaza categoría que no es uuid', () => {
  expect(artworkInputSchema.safeParse({ ...base, category_id: '1 or 1=1' }).success).toBe(false)
})
