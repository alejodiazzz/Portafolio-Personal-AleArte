import { describe, expect, test } from 'vitest'
import { detectImageType, hasTransparency, MAX_INPUT_BYTES, validateImageFile } from './images'

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)])
const ascii = (s: string) => new Uint8Array([...new TextEncoder().encode(s), ...new Array(16).fill(0)])
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const WEBP = new Uint8Array([...new TextEncoder().encode('RIFF'), 0, 0, 0, 0, ...new TextEncoder().encode('WEBPVP8 ')])

describe('detectImageType', () => {
  test.each([
    ['jpeg', JPEG],
    ['png', PNG],
    ['webp', WEBP],
  ])('reconoce %s por sus bytes', (type, b) => {
    expect(detectImageType(b)).toBe(type)
  })
  test.each([
    ['PDF', ascii('%PDF-1.7')],
    ['EXE', ascii('MZ\x90\x00')],
    ['SVG', ascii('<svg xmlns="http://www.w3.org/2000/svg">')],
    ['RIFF no WebP (WAV)', ascii('RIFF\x00\x00\x00\x00WAVEfmt ')],
    ['vacío', new Uint8Array()],
  ])('rechaza %s', (_n, b) => {
    expect(detectImageType(b)).toBeNull()
  })
})

describe('validateImageFile', () => {
  test('acepta JPEG real', async () => {
    expect(await validateImageFile(new File([JPEG], 'a.jpg'))).toEqual({ ok: true })
  })
  test('rechaza PDF renombrado a .jpg', async () => {
    expect(await validateImageFile(new File([ascii('%PDF-1.7')], 'foto.jpg', { type: 'image/jpeg' }))).toEqual({ ok: false, reason: 'type' })
  })
  test('rechaza archivo de más de 15 MB', async () => {
    const big = new File([JPEG, new Uint8Array(MAX_INPUT_BYTES)], 'big.jpg')
    expect(await validateImageFile(big)).toEqual({ ok: false, reason: 'size' })
  })
  test('MAX_INPUT_BYTES es 15 MB', () => {
    expect(MAX_INPUT_BYTES).toBe(15 * 1024 * 1024)
  })
})

describe('hasTransparency (obra recortada: el marco sigue su forma)', () => {
  const px = (alphas: number[]) => new Uint8ClampedArray(alphas.flatMap((a) => [120, 90, 60, a]))
  test('foto opaca → no', () => {
    expect(hasTransparency(px(new Array(400).fill(255)))).toBe(false)
  })
  test('óvalo con esquinas transparentes → sí', () => {
    expect(hasTransparency(px([...new Array(300).fill(255), ...new Array(100).fill(0)]))).toBe(true)
  })
  test('unos pocos píxeles semitransparentes sueltos (ruido) → no', () => {
    expect(hasTransparency(px([...new Array(398).fill(255), 0, 0]))).toBe(false)
  })
})
