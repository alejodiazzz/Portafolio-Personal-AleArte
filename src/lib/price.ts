import type { PublicArtwork } from '../types'

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export function priceLabel(a: Pick<PublicArtwork, 'price' | 'availability_status'>): string {
  if (a.availability_status === 'sold') return 'Vendida'
  if (a.availability_status === 'commission') return 'Cotiza la tuya'
  if (a.price == null) return 'Precio a consultar'
  return `$ ${number.format(a.price)} COP`
}
