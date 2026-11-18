import { expect, test, vi } from 'vitest'
vi.mock('../config/env', () => ({ env: { cloudinaryCloudName: 'demo' } }))
import { imageSrcSet, imageUrl } from './cloudinary'

const id = 'ale-arte/artworks/a/b'
test('URL exacta para w_800', () => {
  expect(imageUrl(id, 800)).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/ale-arte/artworks/a/b')
})
const u = (w: number) => `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_${w}/${id}`
test('srcset con los 4 anchos (1200 para celulares de alta densidad)', () => {
  expect(imageSrcSet(id)).toBe([400, 800, 1200, 1600].map((w) => `${u(w)} ${w}w`).join(', '))
})
test('original pequeño: el descriptor dice el ancho real (c_limit no agranda)', () => {
  // Original de 700 px: w_800 entrega 700 px. Si se anunciara "800w", el navegador la mostraría encogida.
  expect(imageSrcSet(id, 700)).toBe(`${u(400)} 400w, ${u(800)} 700w`)
  expect(imageSrcSet(id, 1600)).toBe([400, 800, 1200, 1600].map((w) => `${u(w)} ${w}w`).join(', '))
  expect(imageSrcSet(id, 300)).toBe(`${u(400)} 300w`)
})
