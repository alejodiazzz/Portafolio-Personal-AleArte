import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toUserMessage } from '../../lib/errors'
import { normalizeInstagramPost } from '../../lib/instagram'
import { slugify, uniqueSlug } from '../../lib/slug'
import type { Artwork, Category } from '../../types'
import { adminApi } from './api'
import { ArtworkImagesEditor } from './ArtworkImagesEditor'
import { AuctionEditor } from './AuctionEditor'
import { artworkInputSchema } from './schema'

type Form = Record<
  'title' | 'slug' | 'description' | 'price' | 'height' | 'width' | 'measurement_unit' | 'technique' | 'category_id' |
  'creation_date' | 'availability_status' | 'publication_status' | 'display_order' | 'instagram_url' |
  'location_name' | 'latitude' | 'longitude',
  string
>

const EMPTY: Form = {
  title: '', slug: '', description: '', price: '', height: '', width: '', measurement_unit: '', technique: '',
  category_id: '', creation_date: '', availability_status: 'available', publication_status: 'draft', display_order: '0', instagram_url: '',
  location_name: '', latitude: '', longitude: '',
}

const num = (s: string) => (s.trim() === '' ? null : Number(s))
const toForm = (a: Artwork): Form => ({
  title: a.title, slug: a.slug, description: a.description ?? '', price: a.price?.toString() ?? '',
  height: a.height?.toString() ?? '', width: a.width?.toString() ?? '', measurement_unit: a.measurement_unit ?? '',
  technique: a.technique ?? '', category_id: a.category_id, creation_date: a.creation_date ?? '',
  availability_status: a.availability_status, publication_status: a.publication_status, display_order: String(a.display_order),
  instagram_url: a.instagram_url ?? '',
  location_name: a.location_name ?? '',
  latitude: a.latitude != null ? String(a.latitude) : '',
  longitude: a.longitude != null ? String(a.longitude) : '',
})

export function ArtworkFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(EMPTY)
  const [categories, setCategories] = useState<Category[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    adminApi.listCategories().then((cs) => {
      setCategories(cs)
      setForm((f) => (f.category_id ? f : { ...f, category_id: cs[0]?.id ?? '' }))
    }, (e) => setMessage(toUserMessage(e)))
    if (id) {
      adminApi.adminGetArtwork(id).then((r) => {
        if (r) {
          setForm(toForm(r.artwork))
          setSlugTouched(true)
        } else setMessage('Obra no encontrada')
      }, (e) => setMessage(toUserMessage(e)))
    }
  }, [id])

  const field = (k: keyof Form) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    let slug = form.slug
    if (!slugTouched || !slug) {
      const taken = await adminApi.takenSlugs()
      slug = uniqueSlug(slugify(form.title), id ? taken.filter((s) => s !== form.slug) : taken)
    }
    const instagram = normalizeInstagramPost(form.instagram_url)
    const parsed = artworkInputSchema.safeParse({
      title: form.title,
      slug,
      description: form.description,
      price: num(form.price),
      height: num(form.height),
      width: num(form.width),
      measurement_unit: form.measurement_unit || null,
      technique: form.technique,
      category_id: form.category_id,
      creation_date: form.creation_date || null,
      availability_status: form.availability_status,
      publication_status: form.publication_status,
      display_order: Number(form.display_order) || 0,
      // 'invalid' no pasa la regex del esquema y muestra su mensaje.
      instagram_url: instagram,
      location_name: form.location_name || null,
      latitude: num(form.latitude),
      longitude: num(form.longitude),
    })
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message
      return setErrors(errs)
    }
    setErrors({})
    setBusy(true)
    try {
      const saved = id ? await adminApi.updateArtwork(id, parsed.data) : await adminApi.createArtwork(parsed.data)
      if (id) setMessage('Cambios guardados')
      else navigate(`/admin/obras/${saved.id}`)
    } catch (err) {
      setMessage(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const err = (k: string) => errors[k] && <span role="alert">{errors[k]}</span>

  return (
    <main>
      <Link className="ad-back" to="/admin">← Obras</Link>
      <div className="ad-page-head">
        <h1>{id ? form.title || 'Editar obra' : 'Nueva obra'}</h1>
        {id && form.publication_status === 'published' && (
          <a className="ad-btn is-ghost" href={`/obra/${form.slug}`} target="_blank" rel="noopener noreferrer">Ver en el sitio ↗</a>
        )}
      </div>
      <form className="ad-form ad-card" onSubmit={submit} noValidate>
        <p><label>Título <input maxLength={150} {...field('title')} /></label>{err('title')}</p>
        <p>
          <label>URL (slug) <input maxLength={170} {...field('slug')} onInput={() => setSlugTouched(true)} placeholder="se genera del título" /></label>
          {err('slug')}
        </p>
        <p><label>Categoría <select {...field('category_id')}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{err('category_id')}</p>
        <p><label>Técnica <input maxLength={150} {...field('technique')} /></label>{err('technique')}</p>
        <p><label>Descripción <textarea maxLength={5000} rows={5} {...field('description')} /></label>{err('description')}</p>
        <p><label>Precio (COP) <input type="number" min={0} step={1} {...field('price')} /></label>{err('price')}</p>
        <p><label>Fecha de creación <input type="date" {...field('creation_date')} /></label>{err('creation_date')}</p>
        <div className="ad-wide">
          <div className="ad-row">
            <label>Alto <input type="number" min={0} step="0.01" {...field('height')} /></label>
            <label>Ancho <input type="number" min={0} step="0.01" {...field('width')} /></label>
            <label>Unidad <select {...field('measurement_unit')}><option value="">—</option><option value="cm">cm</option><option value="m">m</option><option value="in">in</option></select></label>
          </div>
          {err('height')}{err('width')}{err('measurement_unit')}
        </div>
        <p><label>Disponibilidad <select {...field('availability_status')}><option value="available">Disponible</option><option value="sold">Vendida</option><option value="commission">Por encargo</option></select></label></p>
        <p><label>Publicación <select {...field('publication_status')}><option value="draft">Borrador</option><option value="published">Publicada</option></select></label></p>
        <p className="ad-wide">
          <label>Publicación de Instagram (opcional) <input inputMode="url" maxLength={300} placeholder="https://www.instagram.com/p/…" {...field('instagram_url')} /></label>
          {err('instagram_url') || <span className="ad-hint">Pega el enlace del post o reel; en la obra aparecerá «Ver en Instagram».</span>}
        </p>
        <fieldset className="ad-wide" style={{ border: '1px solid var(--ad-border, #ddd)', borderRadius: 8, padding: '1rem', margin: '0.5rem 0' }}>
          <legend style={{ padding: '0 0.5rem', fontWeight: 600 }}>📍 Ubicación en el mapa (Murales / Arte urbano)</legend>
          <p>
            <label>Nombre del lugar o dirección
              <input maxLength={250} placeholder="Ej. Calle 10 # 42-28, El Poblado, Medellín" {...field('location_name')} />
            </label>
            {err('location_name')}
          </p>
          <div className="ad-row">
            <label>Latitud <input type="number" step="0.000001" placeholder="Ej. 6.2087" {...field('latitude')} /></label>
            <label>Longitud <input type="number" step="0.000001" placeholder="Ej. -75.5678" {...field('longitude')} /></label>
          </div>
          {err('latitude')}{err('longitude')}
          {form.latitude && form.longitude && (
            <p style={{ marginTop: '0.5rem' }}>
              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(form.latitude)},${encodeURIComponent(form.longitude)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ad-hint"
                style={{ textDecoration: 'underline' }}
              >
                Verificar ubicación en Google Maps ↗
              </a>
            </p>
          )}
        </fieldset>
        <p><label>Orden <input type="number" step={1} {...field('display_order')} /></label></p>
        <div className="ad-actions ad-wide">
          <button type="submit" disabled={busy}>Guardar</button>
          {message && <p role="status">{message}</p>}
        </div>
      </form>
      {id && <ArtworkImagesEditor artworkId={id} defaultAlt={form.title} />}
      {id && <AuctionEditor artworkId={id} />}
    </main>
  )
}
