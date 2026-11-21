import { describe, expect, test, vi } from 'vitest'
vi.mock('../config/env', () => ({ env: { cloudinaryCloudName: 'demo' } }))
import { cutoutSize, imageSrcSet, imageUrl } from './cloudinary'

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

describe('obra recortada (fondo transparente): marco que sigue su forma', () => {
  const c = (inner: number, m: number, o: number) =>
    `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_${inner}/bo_${m}px_solid_rgb:00000000/e_outline:outer:${o}:0,co_rgb:f6f2ea/${id}`
  test('margen transparente y contorno del color del marco, proporcionales al ancho', () => {
    // 800 px: margen 32 (4 %) a cada lado → la obra a 736 px; contorno 20 (2,5 %), menor que el margen.
    expect(imageUrl(id, 800, { cutout: true })).toBe(c(736, 32, 20))
  })
  test('srcset honesto también con margen', () => {
    expect(imageSrcSet(id, 2000, { cutout: true })).toBe(
      [[368, 16, 10, 400], [736, 32, 20, 800], [1104, 48, 30, 1200], [1472, 64, 40, 1600]].map(([i, m, o, w]) => `${c(i, m, o)} ${w}w`).join(', '),
    )
    // Original de 500 px: w_736 entrega 500 + 2×32 = 564 px.
    expect(imageSrcSet(id, 500, { cutout: true })).toBe(`${c(368, 16, 10)} 400w, ${c(736, 32, 20)} 564w`)
  })
  test('proporción final (para width/height del <img>): suma el margen a ambos lados', () => {
    expect(cutoutSize(1000, 1250)).toEqual({ width: 1000, height: 1230 })
  })
})
