// Detección segura de huérfanos (pura, sin imports: usable desde Deno y Vitest).
// En vez de cargar "todas" las filas (PostgREST trunca en max_rows y causaría borrados
// de imágenes vivas), se pregunta a la BD por cada lote de candidatos cuáles existen.

export const GRACE_MS = 24 * 60 * 60 * 1000
const BATCH = 100

/** `existing(ids)` debe devolver los ids que SÍ tienen fila en artwork_images (y lanzar si falla). */
export async function findOrphans(
  resources: { public_id: string; created_at: string }[],
  existing: (ids: string[]) => Promise<string[]>,
  now = Date.now(),
): Promise<string[]> {
  const candidates = resources.filter((r) => Date.parse(r.created_at) < now - GRACE_MS).map((r) => r.public_id)
  const orphans: string[] = []
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH)
    const found = new Set(await existing(batch))
    orphans.push(...batch.filter((id) => !found.has(id)))
  }
  return orphans
}
