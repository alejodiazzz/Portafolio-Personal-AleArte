import { expect, test, vi } from 'vitest'

vi.mock('./env', () => ({
  env: { whatsappNumber: '573001234567', instagramUrl: 'https://instagram.com/alearte' },
}))
import { buildWhatsAppLink, instagramUrl } from './contact'

test('link genérico', () => {
  expect(buildWhatsAppLink()).toBe(
    'https://wa.me/573001234567?text=' + encodeURIComponent('Hola, quiero información sobre las obras de Ale Arte.'),
  )
})
test('link con obra', () => {
  const url = buildWhatsAppLink({ artworkTitle: 'Luna & Sol', artworkUrl: 'https://x.pages.dev/obra/luna-sol' })
  expect(decodeURIComponent(url.split('text=')[1])).toBe(
    'Hola, me interesa la obra "Luna & Sol": https://x.pages.dev/obra/luna-sol',
  )
})
test('obra hecha por encargo → pide cotizar una similar', () => {
  const url = buildWhatsAppLink({ artworkTitle: 'Retrato de Ana', artworkUrl: 'https://x.dev/obra/ana', status: 'commission' })
  expect(decodeURIComponent(url.split('text=')[1])).toBe(
    'Hola, vi la obra "Retrato de Ana", que fue un encargo, y me gustaría saber cuánto costaría una similar: https://x.dev/obra/ana',
  )
})
test('obra vendida → pide encargar una similar', () => {
  const url = buildWhatsAppLink({ artworkTitle: 'Luna', status: 'sold' })
  expect(decodeURIComponent(url.split('text=')[1])).toBe(
    'Hola, vi la obra "Luna", que ya fue vendida, y me gustaría encargar una similar. ¿Cuánto costaría?',
  )
})
test('instagram desde configuración', () => {
  expect(instagramUrl).toBe('https://instagram.com/alearte')
})
