import { expect, test } from 'vitest'
import { priceLabel } from './price'

test('disponible con precio → formato COP colombiano', () => {
  expect(priceLabel({ price: 1200000, availability_status: 'available' })).toBe('$ 1.200.000 COP')
})
test('disponible sin precio → Precio a consultar', () => {
  expect(priceLabel({ price: null, availability_status: 'available' })).toBe('Precio a consultar')
})
test('vendida → Vendida (aunque llegue precio)', () => {
  expect(priceLabel({ price: 900000, availability_status: 'sold' })).toBe('Vendida')
})
test('por encargo → Cotiza la tuya', () => {
  expect(priceLabel({ price: null, availability_status: 'commission' })).toBe('Cotiza la tuya')
})
