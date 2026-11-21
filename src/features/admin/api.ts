import type { SupabaseClient } from '@supabase/supabase-js'
import { reorder, type Direction } from '../../lib/order'
import { isHexColor } from '../../lib/color'
import { supabase } from '../../lib/supabase'
import { uploadArtworkImage } from '../../lib/upload'
import type { Artwork, ArtworkImage, Auction, AuctionBid, AvailabilityStatus, Category, PublicationStatus } from '../../types'
import { artworkInputSchema, categoryInputSchema, type ArtworkInput, type CategoryInput } from './schema'

export function createAdminApi(db: SupabaseClient) {
  const check = <T>(r: { data: T | null; error: unknown }): T => {
    if (r.error) throw r.error
    return r.data as T
  }

  // ── Obras ──
  const adminListArtworks = async () =>
    check(await db.from('artworks').select('*').order('display_order').order('created_at', { ascending: false })) as Artwork[]

  const adminGetArtwork = async (id: string) => {
    const artwork = check(await db.from('artworks').select('*').eq('id', id).maybeSingle()) as Artwork | null
    if (!artwork) return null
    const images = check(await db.from('artwork_images').select('*').eq('artwork_id', id).order('display_order')) as ArtworkImage[]
    return { artwork, images }
  }

  const createArtwork = async (input: ArtworkInput) =>
    check(await db.from('artworks').insert(artworkInputSchema.parse(input)).select('*').single()) as Artwork

  const updateArtwork = async (id: string, input: ArtworkInput) =>
    check(await db.from('artworks').update(artworkInputSchema.parse(input)).eq('id', id).select('*').single()) as Artwork

  /** Borra BD + Cloudinary en el servidor (evita huérfanos). */
  const deleteArtwork = async (id: string) => {
    const { error } = await db.functions.invoke('media-delete', { body: { artworkId: id } })
    if (error) throw error
  }

  const setPublication = async (id: string, publication_status: PublicationStatus) => {
    check(await db.from('artworks').update({ publication_status }).eq('id', id).select('id'))
  }
  const setAvailability = async (id: string, availability_status: AvailabilityStatus) => {
    check(await db.from('artworks').update({ availability_status }).eq('id', id).select('id'))
  }

  const applyOrder = async (table: string, rows: { id: string; display_order: number }[]) => {
    for (const r of rows) check(await db.from(table).update({ display_order: r.display_order }).eq('id', r.id).select('id'))
  }

  const moveArtwork = async (id: string, dir: Direction) => {
    const list = await adminListArtworks()
    await applyOrder('artworks', reorder(list.map((a) => a.id), id, dir))
  }

  /** Portada (o primera imagen) de cada obra, para las miniaturas de la lista. */
  const listCovers = async () => {
    const rows = check(await db.from('artwork_images').select('artwork_id, storage_path, is_cover, display_order')) as Pick<ArtworkImage, 'artwork_id' | 'storage_path' | 'is_cover' | 'display_order'>[]
    rows.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.display_order - b.display_order)
    const map = new Map<string, string>()
    for (const r of rows) if (!map.has(r.artwork_id)) map.set(r.artwork_id, r.storage_path)
    return map
  }
  const takenSlugs = async () => (check(await db.from('artworks').select('slug')) as { slug: string }[]).map((r) => r.slug)

  // ── Imágenes ──
  const uploadImage = (artworkId: string, file: File, alt: string, opts?: { isCover?: boolean; displayOrder?: number }) =>
    uploadArtworkImage(artworkId, file, alt, opts)

  const setCover = async (imageId: string) => {
    const img = check(await db.from('artwork_images').select('id, artwork_id').eq('id', imageId).single()) as { artwork_id: string }
    // Primero desmarcar (índice único parcial: una portada por obra)
    check(await db.from('artwork_images').update({ is_cover: false }).eq('artwork_id', img.artwork_id).eq('is_cover', true).select('id'))
    check(await db.from('artwork_images').update({ is_cover: true }).eq('id', imageId).select('id'))
  }

  const updateImageAlt = async (imageId: string, image_alt: string) => {
    check(await db.from('artwork_images').update({ image_alt: image_alt.trim().slice(0, 250) || null }).eq('id', imageId).select('id'))
  }

  /** Fondo del escaparate elegido a mano (#rrggbb); null vuelve al color automático. */
  const setImageColor = async (imageId: string, color: string | null) => {
    const custom_color = color === null ? null : color.toLowerCase()
    if (custom_color !== null && !isHexColor(custom_color)) throw new Error('Color no válido')
    check(await db.from('artwork_images').update({ custom_color }).eq('id', imageId).select('id'))
  }

  /** Marco con la forma de la obra (imagen con fondo transparente). */
  const setImageCutout = async (imageId: string, is_cutout: boolean) => {
    check(await db.from('artwork_images').update({ is_cutout }).eq('id', imageId).select('id'))
  }

  const deleteImage = async (imageId: string) => {
    const { error } = await db.functions.invoke('media-delete', { body: { imageId } })
    if (error) throw error
  }

  const moveImage = async (imageId: string, dir: Direction) => {
    const img = check(await db.from('artwork_images').select('artwork_id').eq('id', imageId).single()) as { artwork_id: string }
    const list = check(await db.from('artwork_images').select('id').eq('artwork_id', img.artwork_id).order('display_order')) as { id: string }[]
    await applyOrder('artwork_images', reorder(list.map((i) => i.id), imageId, dir))
  }

  /** Sube la nueva, conserva alt/orden/portada y luego borra la anterior. */
  const replaceImage = async (imageId: string, file: File) => {
    const old = check(await db.from('artwork_images').select('*').eq('id', imageId).single()) as ArtworkImage
    if (old.is_cover) check(await db.from('artwork_images').update({ is_cover: false }).eq('id', imageId).select('id'))
    const created = await uploadArtworkImage(old.artwork_id, file, old.image_alt ?? '', {
      isCover: old.is_cover,
      displayOrder: old.display_order,
    })
    // El fondo elegido a mano se conserva al cambiar la foto.
    if (old.custom_color) await setImageColor(created.id, old.custom_color)
    await deleteImage(imageId)
    return created
  }

  // ── Categorías ──
  const listCategories = async () => check(await db.from('categories').select('*').order('display_order').order('name')) as Category[]
  const createCategory = async (input: CategoryInput) =>
    check(await db.from('categories').insert(categoryInputSchema.parse(input)).select('*').single()) as Category
  const updateCategory = async (id: string, input: CategoryInput) =>
    check(await db.from('categories').update(categoryInputSchema.parse(input)).eq('id', id).select('*').single()) as Category
  const deleteCategory = async (id: string) => {
    const rows = check(await db.from('categories').delete().eq('id', id).select('id')) as unknown[]
    if (!rows.length) throw { status: 403 }
  }
  const moveCategory = async (id: string, dir: Direction) => {
    const list = await listCategories()
    await applyOrder('categories', reorder(list.map((c) => c.id), id, dir))
  }

  // ── Subastas ──
  type AuctionConfig = Pick<Auction, 'starting_price' | 'min_increment' | 'ends_at' | 'is_active'>
  const getAuction = async (artworkId: string) =>
    check(await db.from('auctions').select('*').eq('artwork_id', artworkId).maybeSingle()) as Auction | null
  /** Solo columnas configurables: el monto actual y el conteo los maneja la base. */
  const saveAuction = async (artworkId: string, c: AuctionConfig) => {
    const cfg = { starting_price: c.starting_price, min_increment: c.min_increment, ends_at: c.ends_at, is_active: c.is_active }
    const exists = check(await db.from('auctions').select('artwork_id').eq('artwork_id', artworkId).maybeSingle())
    if (exists) check(await db.from('auctions').update(cfg).eq('artwork_id', artworkId).select('artwork_id'))
    else check(await db.from('auctions').insert({ artwork_id: artworkId, ...cfg }).select('artwork_id'))
  }
  const deleteAuction = async (artworkId: string) => {
    check(await db.from('auctions').delete().eq('artwork_id', artworkId).select('artwork_id'))
  }
  const listBids = async (artworkId: string) =>
    check(await db.from('auction_bids').select('*').eq('artwork_id', artworkId).order('amount', { ascending: false })) as AuctionBid[]
  const deleteBid = async (id: string) => {
    const rows = check(await db.from('auction_bids').delete().eq('id', id).select('id')) as unknown[]
    if (!rows.length) throw { status: 403 }
  }

  return {
    listCovers, getAuction, saveAuction, deleteAuction, listBids, deleteBid,
    adminListArtworks, adminGetArtwork, createArtwork, updateArtwork, deleteArtwork, setPublication, setAvailability,
    moveArtwork, takenSlugs, uploadImage, setCover, updateImageAlt, setImageColor, setImageCutout, deleteImage, moveImage, replaceImage,
    listCategories, createCategory, updateCategory, deleteCategory, moveCategory,
  }
}

export const adminApi = createAdminApi(supabase)
