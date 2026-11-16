import { expect, test, vi } from 'vitest'
vi.mock('../config/env', () => ({ env: { cloudinaryCloudName: 'demo' } }))
import { imageSrcSet, imageUrl } from './cloudinary'

const id = 'ale-arte/artworks/a/b'
test('URL exacta para w_800', () => {
  expect(imageUrl(id, 800)).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_800/ale-arte/artworks/a/b')
})
test('srcset con los 3 anchos', () => {
  expect(imageSrcSet(id)).toBe(
    [400, 800, 1600].map((w) => `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_${w}/${id} ${w}w`).join(', '),
  )
})
