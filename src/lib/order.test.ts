import { expect, test } from 'vitest'
import { moveTo, reorder } from './order'

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

test('moveTo lleva el elemento a cualquier posición (arrastrar y soltar)', () => {
  expect(moveTo(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
  expect(moveTo(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
  expect(moveTo(['a', 'b', 'c'], 'b', 99)).toEqual(['a', 'c', 'b'])
  expect(moveTo(['a', 'b', 'c'], 'b', -5)).toEqual(['b', 'a', 'c'])
  expect(() => moveTo(['a'], 'z', 0)).toThrow()
})
