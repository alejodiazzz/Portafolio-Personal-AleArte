import { expect, test } from 'vitest'
import { reorder } from './order'

test('subir intercambia con el anterior y renumera', () => {
  expect(reorder(['a', 'b', 'c'], 'b', 'up')).toEqual([
    { id: 'b', display_order: 0 },
    { id: 'a', display_order: 1 },
    { id: 'c', display_order: 2 },
  ])
})
test('bajar el último no cambia nada', () => {
  expect(reorder(['a', 'b'], 'b', 'down')).toEqual([
    { id: 'a', display_order: 0 },
    { id: 'b', display_order: 1 },
  ])
})
test('id inexistente lanza error', () => {
  expect(() => reorder(['a'], 'z', 'up')).toThrow()
})
