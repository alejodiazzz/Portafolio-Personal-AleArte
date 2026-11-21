import type { SupabaseClient } from '@supabase/supabase-js'
import { publicSupabase } from '../../lib/supabase'
import type { ArtworkImage, Auction, Category, PublicArtwork } from '../../types'

/** El escaparate carga todas las obras publicadas de una vez (un portafolio personal). */
export const SHOWCASE_LIMIT = 300
const COLUMNS =
  'id, slug, title, description, price, currency, height, width, measurement_unit, technique, category_id, creation_date, availability_status, display_order, created_at, instagram_url'
export const AUCTION_COLUMNS = 'artwork_id, starting_price, min_increment, ends_at, current_amount, bid_count, is_active'
const IMAGE_COLUMNS = 'id, artwork_id, storage_path, image_alt, width, height, is_cover, display_order, dominant_color, custom_color'

export type ShowcaseArtwork = PublicArtwork & { cover: ArtworkImage | null; auction: Auction | null }

const byCoverThenOrder = (a: ArtworkImage, b: ArtworkImage) =>
  Number(b.is_cover) - Number(a.is_cover) || a.display_order - b.display_order

export function createPortfolioApi(db: SupabaseClient) {
  async function listCategories(): Promise<Category[]> {
    const { data, error } = await db.from('categories').select('*').order('display_order').order('name')
    if (error) throw error
    return data as Category[]
  }

  async function listShowcase(): Promise<ShowcaseArtwork[]> {
    const { data, error } = await db
      .from('public_artworks')
      .select(COLUMNS)
      .order('display_order')
      .order('created_at', { ascending: false })
      .limit(SHOWCASE_LIMIT)
    if (error) throw error
    const rows = (data ?? []) as PublicArtwork[]
    if (!rows.length) return []

    const ids = rows.map((r) => r.id)
    const [{ data: imgs, error: imgError }, { data: auctions, error: auctionError }] = await Promise.all([
      db.from('artwork_images').select(IMAGE_COLUMNS).in('artwork_id', ids),
      db.from('auctions').select(AUCTION_COLUMNS).in('artwork_id', ids),
    ])
    if (imgError) throw imgError
    if (auctionError) throw auctionError
    const byArtwork = new Map(((auctions ?? []) as Auction[]).map((a) => [a.artwork_id, a]))
    const covers = new Map<string, ArtworkImage>()
    for (const img of [...((imgs ?? []) as ArtworkImage[])].sort(byCoverThenOrder))
      if (!covers.has(img.artwork_id)) covers.set(img.artwork_id, img)
    return rows.map((r) => ({ ...r, cover: covers.get(r.id) ?? null, auction: byArtwork.get(r.id) ?? null }))
  }

  return { listCategories, listShowcase }
}

export const portfolioApi = createPortfolioApi(publicSupabase)
