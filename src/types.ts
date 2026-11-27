export type AvailabilityStatus = 'available' | 'sold' | 'commission'
export type PublicationStatus = 'draft' | 'published'
export type MeasurementUnit = 'cm' | 'm' | 'in'

export type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  display_order: number
  created_at: string
}

export type ArtworkImage = {
  id: string
  artwork_id: string
  storage_path: string
  image_alt: string | null
  width: number | null
  height: number | null
  format: string | null
  bytes: number | null
  is_cover: boolean
  display_order: number
  /** #rrggbb calculado al subir; null en imágenes antiguas. */
  dominant_color: string | null
  /** #rrggbb elegido en el panel; si existe, reemplaza al automático. */
  custom_color: string | null
  /** Fondo transparente (p. ej. óvalo): el marco del escaparate sigue su forma. */
  is_cutout: boolean
  created_at: string
}

/** Lo que ve el público (vista public_artworks): price ya viene nulo si vendida/por encargo. */
export type PublicArtwork = {
  id: string
  slug: string
  title: string
  description: string | null
  price: number | null
  currency: 'COP'
  height: number | null
  width: number | null
  measurement_unit: MeasurementUnit | null
  technique: string | null
  category_id: string
  creation_date: string | null
  availability_status: AvailabilityStatus
  display_order: number
  created_at: string
  /** Publicación de Instagram (formato canónico https://www.instagram.com/p/<código>/). */
  instagram_url: string | null
  /** Ubicación de la obra (murales / arte urbano). */
  location_name: string | null
  latitude: number | null
  longitude: number | null
}

/** Estado público de una subasta (sin datos personales). */
export type Auction = {
  artwork_id: string
  starting_price: number
  min_increment: number
  ends_at: string
  current_amount: number | null
  bid_count: number
  is_active: boolean
}

/** Oferta con datos de contacto (solo admin). */
export type AuctionBid = {
  id: string
  artwork_id: string
  amount: number
  bidder_name: string
  bidder_email: string
  bidder_phone: string
  created_at: string
}

/** Registro completo (solo admin). */
export type Artwork = Omit<PublicArtwork, 'price'> & {
  price: number | null
  publication_status: PublicationStatus
  updated_at: string
}
