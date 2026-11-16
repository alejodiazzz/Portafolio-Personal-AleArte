import { expect, test } from 'vitest'
import { slugify, uniqueSlug } from './slug'

test('quita tildes, ñ, HTML y espacios', () => {
  expect(slugify('Retrato de Ñandú <script>')).toBe('retrato-de-nandu-script')
})
test('solo símbolos → fallback "obra"', () => {
  expect(slugify('🎨!!')).toBe('obra')
})
test('colapsa guiones y recorta extremos', () => {
  expect(slugify('  --Luna   &  Sol-- ')).toBe('luna-sol')
})
test('respeta el largo máximo sin terminar en guion', () => {
  const s = slugify('a '.repeat(200))
  expect(s.length).toBeLessThanOrEqual(170)
  expect(s.endsWith('-')).toBe(false)
})
test('uniqueSlug añade sufijo libre', () => {
  expect(uniqueSlug('luna', ['luna', 'luna-2'])).toBe('luna-3')
  expect(uniqueSlug('sol', ['luna'])).toBe('sol')
})
