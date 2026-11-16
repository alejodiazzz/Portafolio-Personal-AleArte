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
