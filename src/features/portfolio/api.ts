import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { ArtworkImage, Category, PublicArtwork } from '../../types'

export const PAGE_SIZE = 12
const LIST_COLUMNS = 'id, slug, title, price, currency, availability_status, category_id, technique, display_order, created_at'

export type ArtworkCard = PublicArtwork & { cover: ArtworkImage | null }
export type ArtworkDetail = PublicArtwork & { images: ArtworkImage[] }

const byCoverThenOrder = (a: ArtworkImage, b: ArtworkImage) =>
  Number(b.is_cover) - Number(a.is_cover) || a.display_order - b.display_order

export function createPortfolioApi(db: SupabaseClient) {
  async function listCategories(): Promise<Category[]> {
    const { data, error } = await db.from('categories').select('*').order('display_order').order('name')
    if (error) throw error
    return data as Category[]
  }

  async function listArtworks({ categorySlug, page }: { categorySlug?: string; page: number }) {
    let query = db
      .from('public_artworks')
      .select(LIST_COLUMNS)
      .order('display_order')
      .order('created_at', { ascending: false })
    if (categorySlug) {
      const { data: cat } = await db.from('categories').select('id').eq('slug', categorySlug).maybeSingle()
      if (!cat) return { items: [] as ArtworkCard[], hasMore: false }
      query = query.eq('category_id', (cat as { id: string }).id)
    }
    const from = page * PAGE_SIZE
    const { data, error } = await query.range(from, from + PAGE_SIZE) // pide 13 → sabe si hay más
    if (error) throw error
    const rows = (data ?? []) as PublicArtwork[]
    const pageRows = rows.slice(0, PAGE_SIZE)

    const covers = new Map<string, ArtworkImage>()
    if (pageRows.length) {
      const { data: imgs, error: imgError } = await db
        .from('artwork_images')
        .select('id, artwork_id, storage_path, image_alt, width, height, is_cover, display_order')
        .in('artwork_id', pageRows.map((r) => r.id))
      if (imgError) throw imgError
      for (const img of [...((imgs ?? []) as ArtworkImage[])].sort(byCoverThenOrder))
        if (!covers.has(img.artwork_id)) covers.set(img.artwork_id, img)
    }
    return {
      items: pageRows.map((r) => ({ ...r, cover: covers.get(r.id) ?? null })),
      hasMore: rows.length > PAGE_SIZE,
    }
  }

  async function getArtworkBySlug(slug: string): Promise<ArtworkDetail | null> {
    const { data, error } = await db.from('public_artworks').select('*').eq('slug', slug).maybeSingle()
    if (error) throw error
    if (!data) return null
    const artwork = data as PublicArtwork
    const { data: imgs, error: imgError } = await db.from('artwork_images').select('*').eq('artwork_id', artwork.id)
    if (imgError) throw imgError
    return { ...artwork, images: [...((imgs ?? []) as ArtworkImage[])].sort(byCoverThenOrder) }
  }

  return { listCategories, listArtworks, getArtworkBySlug }
}

export const portfolioApi = createPortfolioApi(supabase)
