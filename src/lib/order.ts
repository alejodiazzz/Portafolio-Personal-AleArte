export type Direction = 'up' | 'down'

/** Mueve `id` una posición y devuelve el orden completo renumerado desde 0. */
export function reorder(ids: string[], id: string, dir: Direction): { id: string; display_order: number }[] {
  const i = ids.indexOf(id)
  if (i < 0) throw new Error('Elemento no encontrado')
  const j = dir === 'up' ? i - 1 : i + 1
  const next = [...ids]
  if (j >= 0 && j < ids.length) [next[i], next[j]] = [next[j], next[i]]
  return next.map((x, n) => ({ id: x, display_order: n }))
}

/** Lleva `id` a la posición `to` (arrastrar y soltar); `to` fuera de rango se ajusta a los extremos. */
export function moveTo(ids: string[], id: string, to: number): string[] {
  const i = ids.indexOf(id)
  if (i < 0) throw new Error('Elemento no encontrado')
  const next = ids.filter((x) => x !== id)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id)
  return next
}
