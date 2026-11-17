// Matemática del visor: transform = translate(x, y) scale(s), con origen en el centro de la imagen,
// que está centrada en la caja. Los puntos se miden desde el centro de la caja.
export type View = { s: number; x: number; y: number }
export type Size = { w: number; h: number }
export const MAX_SCALE = 6

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Limita la escala y evita que la imagen se arrastre fuera de la vista. */
export function clampView(v: View, base: Size, box: Size): View {
  const s = clamp(v.s, 1, MAX_SCALE)
  const mx = Math.max(0, (base.w * s - box.w) / 2)
  const my = Math.max(0, (base.h * s - box.h) / 2)
  return { s, x: clamp(v.x, -mx, mx) || 0, y: clamp(v.y, -my, my) || 0 }
}

/** Amplía por `factor` manteniendo fijo el punto `p` (dedo, cursor o centro del pellizco). */
export function zoomAt(v: View, factor: number, p: { x: number; y: number }, base: Size, box: Size): View {
  const s = clamp(v.s * factor, 1, MAX_SCALE)
  const k = s / v.s
  return clampView({ s, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k }, base, box)
}
