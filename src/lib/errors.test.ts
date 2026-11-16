import { expect, test } from 'vitest'
import { GENERIC_ERROR, toUserMessage } from './errors'

test('violación de FK → la categoría tiene obras', () => {
  expect(toUserMessage({ code: '23503', message: 'update or delete on table "categories" violates foreign key' })).toBe(
    'La categoría tiene obras',
  )
})
test('violación de unicidad → ya existe', () => {
  expect(toUserMessage({ code: '23505', message: 'duplicate key value violates unique constraint "artworks_slug_key"' })).toBe(
    'Ya existe un registro con ese nombre o URL',
  )
})
test('error de función 403 → No autorizado', () => {
  expect(toUserMessage({ name: 'FunctionsHttpError', context: { status: 403 } })).toBe('No autorizado')
})
test('error de función 400 → Solicitud inválida', () => {
  expect(toUserMessage({ name: 'FunctionsHttpError', context: { status: 400 } })).toBe('Solicitud inválida')
})
test('RLS (42501) → No autorizado', () => {
  expect(toUserMessage({ code: '42501', message: 'new row violates row-level security policy for table "artworks"' })).toBe('No autorizado')
})
test('nunca devuelve el mensaje interno', () => {
  const secret = 'relation "private.app_admin" does not exist'
  expect(toUserMessage(new Error(secret))).toBe(GENERIC_ERROR)
  expect(toUserMessage({ message: secret })).toBe(GENERIC_ERROR)
  expect(toUserMessage(null)).toBe(GENERIC_ERROR)
})
