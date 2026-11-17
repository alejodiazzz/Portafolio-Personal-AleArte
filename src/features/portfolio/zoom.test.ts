import { describe, expect, test } from 'vitest'
import { clampView, MAX_SCALE, zoomAt } from './zoom'

const base = { w: 400, h: 500 }, box = { w: 400, h: 600 }

describe('zoomAt', () => {
  test('el punto bajo el dedo o el cursor queda fijo', () => {
    const v = zoomAt({ s: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 }, base, box)
    expect(v).toEqual({ s: 2, x: -100, y: -50 })
    // el punto (100, 50) de la pantalla sigue mostrando el mismo punto de la imagen: (100 - x) / s = 100
    expect((100 - v.x) / v.s).toBe(100)
  })
  test('no baja de 1× ni pasa del máximo', () => {
    expect(zoomAt({ s: 1, x: 0, y: 0 }, 0.5, { x: 0, y: 0 }, base, box).s).toBe(1)
    expect(zoomAt({ s: 5, x: 0, y: 0 }, 10, { x: 0, y: 0 }, base, box).s).toBe(MAX_SCALE)
  })
})

describe('clampView', () => {
  test('a 1× la imagen queda centrada', () => {
    expect(clampView({ s: 1, x: 80, y: -40 }, base, box)).toEqual({ s: 1, x: 0, y: 0 })
  })
  test('ampliada, no se puede arrastrar más allá de sus bordes', () => {
    // a 2×: 800×1000 dentro de 400×600 → margen ±200 en x, ±200 en y
    expect(clampView({ s: 2, x: 999, y: -999 }, base, box)).toEqual({ s: 2, x: 200, y: -200 })
  })
})
