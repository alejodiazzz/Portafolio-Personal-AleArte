// Color de fondo del escaparate a partir de la imagen de la obra.
// Se calcula una vez, al subir la foto (panel), sobre una miniatura RGBA.

export const DEFAULT_BG = '#2b2724'
const HEX_RE = /^#[0-9a-f]{6}$/
const L_MIN = 0.18
const L_MAX = 0.52
const S_MAX = 0.6

type Rgb = [number, number, number]

function toHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r, g, b].map((v) => Math.round((v + m) * 255)) as Rgb
}

const toHex = (rgb: Rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')

/**
 * Color dominante "usable como fondo": agrupa píxeles en cubetas de 4 bits por canal,
 * puntúa cada cubeta por cantidad × (0.35 + saturación), descarta blanco/negro casi puros
 * (papel, sombras) y acota saturación y luminosidad para que el texto siempre se lea.
 */
export function dominantColor(rgba: Uint8ClampedArray): string {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number; s: number }>()
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue
    const rgb: Rgb = [rgba[i], rgba[i + 1], rgba[i + 2]]
    const [, s, l] = toHsl(rgb)
    if (l > 0.93 || l < 0.05) continue
    const key = ((rgb[0] >> 4) << 8) | ((rgb[1] >> 4) << 4) | (rgb[2] >> 4)
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, s: 0 }
    bk.n++; bk.r += rgb[0]; bk.g += rgb[1]; bk.b += rgb[2]; bk.s += s
    buckets.set(key, bk)
  }
  let best: { n: number; r: number; g: number; b: number } | null = null
  let bestScore = -1
  for (const bk of buckets.values()) {
    const score = bk.n * (0.35 + bk.s / bk.n)
    if (score > bestScore) { bestScore = score; best = bk }
  }
  if (!best) return DEFAULT_BG
  const [h, s0, l0] = toHsl([best.r / best.n, best.g / best.n, best.b / best.n])
  const s = Math.min(s0, S_MAX)
  let l = Math.min(L_MAX, Math.max(L_MIN, l0))
  let hex = toHex(fromHsl(h, s, l))
  // Zona media: ni claro (texto oscuro) ni con contraste 4.5:1 con blanco → oscurecer.
  while (luminance(hex) <= AUTO_LIGHT_MIN_LUM && luminance(hex) > WHITE_TEXT_MAX_LUM && l > 0.06) {
    l -= 0.02
    hex = toHex(fromHsl(h, s, l))
  }
  return hex
}

/** Contraste 4.5:1 con blanco ⇔ luminancia ≤ 0.183. */
const WHITE_TEXT_MAX_LUM = 1.05 / 4.5 - 0.05

/** El automático evita tonos medios: o claro de verdad (> 0.45) o oscuro con 4.5:1 con blanco. */
const AUTO_LIGHT_MIN_LUM = 0.45

/**
 * ¿Texto oscuro? Cuando el blanco ya no llega a 4.5:1 (luminancia > 0.183), el oscuro sí.
 * Así cualquier color, también el elegido a mano en el panel, se lee.
 */
export function isLightColor(hex: string): boolean {
  return luminance(hex) > WHITE_TEXT_MAX_LUM
}

/** Fondo del escaparate para una imagen: el elegido en el panel o, si no hay, el automático. */
export function backgroundOf(img: { dominant_color: string | null; custom_color: string | null } | null | undefined): string | null {
  return img ? img.custom_color ?? img.dominant_color : null
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const lin = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** Solo acepta #rrggbb (el valor viene de la BD y va a CSS). */
export const isHexColor = (value: string) => HEX_RE.test(value)

export function safeColor(value: string | null | undefined): string {
  return value && HEX_RE.test(value) ? value : DEFAULT_BG
}
