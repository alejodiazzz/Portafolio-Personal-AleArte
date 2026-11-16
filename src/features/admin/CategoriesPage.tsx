import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toUserMessage } from '../../lib/errors'
import { slugify } from '../../lib/slug'
import type { Category } from '../../types'
import { adminApi } from './api'
import { categoryInputSchema } from './schema'

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => setItems(await adminApi.listCategories()), [])
  useEffect(() => {
    load().catch((e) => setMessage(toUserMessage(e)))
  }, [load])

  async function run(fn: () => Promise<unknown>) {
    setMessage(null)
    try {
      await fn()
      await load()
      return true
    } catch (e) {
      setMessage(toUserMessage(e))
      return false
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = categoryInputSchema.safeParse({ name, slug: editing?.slug ?? slugify(name), description })
    if (!parsed.success) return setMessage(parsed.error.issues[0].message)
    const ok = await run(() => (editing ? adminApi.updateCategory(editing.id, parsed.data) : adminApi.createCategory(parsed.data)))
    if (ok) {
      setEditing(null)
      setName('')
      setDescription('')
    }
  }

  return (
    <main>
      <p><Link to="/admin">← Obras</Link></p>
      <h1>Categorías</h1>
      {message && <p role="alert">{message}</p>}
      <ol>
        {items.map((c, i) => (
          <li key={c.id}>
            {c.name} <small>({c.slug})</small>{' '}
            <button type="button" disabled={i === 0} onClick={() => run(() => adminApi.moveCategory(c.id, 'up'))}>↑</button>
            <button type="button" disabled={i === items.length - 1} onClick={() => run(() => adminApi.moveCategory(c.id, 'down'))}>↓</button>{' '}
            <button type="button" onClick={() => { setEditing(c); setName(c.name); setDescription(c.description ?? '') }}>Editar</button>{' '}
            {confirming === c.id ? (
              <>
                ¿Eliminar? <button type="button" onClick={() => run(() => adminApi.deleteCategory(c.id)).then(() => setConfirming(null))}>Sí</button>{' '}
                <button type="button" onClick={() => setConfirming(null)}>No</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirming(c.id)}>Eliminar</button>
            )}
          </li>
        ))}
      </ol>
      <h2>{editing ? `Editar “${editing.name}”` : 'Nueva categoría'}</h2>
      <form onSubmit={submit}>
        <p><label>Nombre <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label></p>
        <p><label>Descripción <textarea maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></label></p>
        <button type="submit">Guardar</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setName(''); setDescription('') }}>Cancelar</button>}
      </form>
    </main>
  )
}
