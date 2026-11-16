// Cliente falso mínimo: registra llamadas por tabla y devuelve datos configurados.
type Call = { table: string; method: string; args: unknown[] }

export function fakeSupabase(responses: Record<string, unknown[]>) {
  const calls: Call[] = []
  const invoked: { name: string; body: unknown }[] = []
  const from = (table: string) => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'range', 'limit', 'update', 'insert', 'delete'])
      builder[m] = (...args: unknown[]) => {
        calls.push({ table, method: m, args })
        return builder
      }
    builder.maybeSingle = () => Promise.resolve({ data: responses[table]?.[0] ?? null, error: null })
    builder.single = builder.maybeSingle
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: responses[table] ?? [], error: null }).then(ok)
    return builder
  }
  const client = {
    from,
    functions: {
      invoke: (name: string, opts: { body: unknown }) => {
        invoked.push({ name, body: opts.body })
        return Promise.resolve({ data: { ok: true }, error: null })
      },
    },
  }
  return { client, calls, invoked }
}
