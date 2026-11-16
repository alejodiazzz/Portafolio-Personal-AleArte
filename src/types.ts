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
}

/** Registro completo (solo admin). */
export type Artwork = Omit<PublicArtwork, 'price'> & {
  price: number | null
  publication_status: PublicationStatus
  updated_at: string
}
