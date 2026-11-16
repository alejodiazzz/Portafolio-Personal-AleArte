// @vitest-environment node
import { expect, test } from 'vitest'
import { findOrphans } from '../../supabase/functions/_shared/orphans'

const NOW = Date.parse('2026-11-16T12:00:00Z')
const old = '2026-11-14T00:00:00Z'
const res = (n: number, created = old) =>
  Array.from({ length: n }, (_, i) => ({ public_id: `ale-arte/artworks/a/${i}`, created_at: created }))

test('solo marca como huérfanos los que la BD confirma que no existen', async () => {
  const known = new Set(['ale-arte/artworks/a/0', 'ale-arte/artworks/a/2'])
  const lookup = async (ids: string[]) => ids.filter((id) => known.has(id))
  expect(await findOrphans(res(3), lookup, NOW)).toEqual(['ale-arte/artworks/a/1'])
})
test('ignora recursos de menos de 24 h', async () => {
  const fresh = res(2, '2026-11-16T00:00:00Z')
  expect(await findOrphans(fresh, async () => [], NOW)).toEqual([])
})
test('consulta en lotes de máximo 100 (no depende de un listado completo truncable)', async () => {
  const batches: number[] = []
  const lookup = async (ids: string[]) => {
    batches.push(ids.length)
    return ids // todos existen
  }
  expect(await findOrphans(res(1500), lookup, NOW)).toEqual([])
  expect(Math.max(...batches)).toBeLessThanOrEqual(100)
  expect(batches.reduce((a, b) => a + b, 0)).toBe(1500)
})
test('si la consulta a la BD falla, no borra nada', async () => {
  await expect(findOrphans(res(3), async () => { throw new Error('db') }, NOW)).rejects.toThrow()
})
