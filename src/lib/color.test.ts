import { describe, expect, test } from 'vitest'
import { DEFAULT_BG, backgroundOf, dominantColor, isLightColor, safeColor } from './color'

/** Construye RGBA a partir de [color, cantidad de píxeles]. */
function pixels(...parts: [[number, number, number], number][]): Uint8ClampedArray {
  const out: number[] = []
  for (const [[r, g, b], n] of parts) for (let i = 0; i < n; i++) out.push(r, g, b, 255)
  return new Uint8ClampedArray(out)
}
const hsl = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  return { s, l }
}

describe('dominantColor', () => {
  test('devuelve un hex en minúsculas de 6 dígitos', () => {
    expect(dominantColor(pixels([[30, 60, 140], 100]))).toMatch(/^#[0-9a-f]{6}$/)
  })
  test('prefiere el color saturado aunque haya algo más de gris', () => {
    const c = dominantColor(pixels([[128, 128, 128], 120], [[30, 60, 160], 100]))
    const n = parseInt(c.slice(1), 16)
    expect(n & 255).toBeGreaterThan(n >> 16) // azul domina sobre rojo
  })
  test('ignora el papel blanco casi puro', () => {
    const c = dominantColor(pixels([[250, 250, 250], 300], [[120, 60, 30], 80]))
    const n = parseInt(c.slice(1), 16)
    expect(n >> 16).toBeGreaterThan(n & 255) // marrón, no blanco
  })
  test('acota luminosidad y saturación para servir de fondo', () => {
    for (const c of [dominantColor(pixels([[255, 230, 0], 50])), dominantColor(pixels([[5, 5, 40], 50]))]) {
      const { s, l } = hsl(c)
      expect(l).toBeGreaterThanOrEqual(0.17)
      expect(l).toBeLessThanOrEqual(0.53)
      expect(s).toBeLessThanOrEqual(0.62)
    }
  })
  test('obra en grises (lápiz) → fondo gris oscuro', () => {
    const { s, l } = hsl(dominantColor(pixels([[90, 90, 90], 50], [[200, 200, 200], 50])))
    expect(s).toBeLessThan(0.05)
    expect(l).toBeLessThanOrEqual(0.53)
  })
  test('el texto siempre se lee: fondo claro (texto oscuro) o contraste ≥ 4.5 con blanco', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16)
      const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    for (const rgb of [[176, 135, 89], [110, 160, 140], [200, 120, 60], [90, 90, 200]] as [number, number, number][]) {
      const c = dominantColor(pixels([rgb, 60]))
      expect(isLightColor(c) || 1.05 / (lum(c) + 0.05) >= 4.5).toBe(true)
    }
  })
  test('sin píxeles útiles → color por defecto', () => {
    expect(dominantColor(new Uint8ClampedArray())).toBe(DEFAULT_BG)
  })
})

describe('isLightColor', () => {
  test('claro y oscuro', () => {
    expect(isLightColor('#f0e8d8')).toBe(true)
    expect(isLightColor('#1f3b7a')).toBe(false)
  })
  test('tonos medios (color elegido a mano) usan texto oscuro: con blanco no llegarían a 4.5:1', () => {
    expect(isLightColor('#808080')).toBe(true)
    expect(isLightColor('#3a6ea5')).toBe(false)
  })
})

describe('backgroundOf', () => {
  test('el color personalizado gana; si no hay, el automático', () => {
    expect(backgroundOf({ dominant_color: '#183961', custom_color: '#aa3300' })).toBe('#aa3300')
    expect(backgroundOf({ dominant_color: '#183961', custom_color: null })).toBe('#183961')
    expect(backgroundOf(null)).toBeNull()
  })
})

describe('safeColor', () => {
  test('acepta solo #rrggbb; si no, el color por defecto', () => {
    expect(safeColor('#1f3b7a')).toBe('#1f3b7a')
    expect(safeColor(null)).toBe(DEFAULT_BG)
    expect(safeColor('red;background:url(x)')).toBe(DEFAULT_BG)
  })
})
