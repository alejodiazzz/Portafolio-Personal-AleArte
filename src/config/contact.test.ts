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
test('instagram desde configuración', () => {
  expect(instagramUrl).toBe('https://instagram.com/alearte')
})
