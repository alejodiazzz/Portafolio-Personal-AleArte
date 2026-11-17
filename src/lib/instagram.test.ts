import { expect, test } from 'vitest'
import { normalizeInstagramPost } from './instagram'

test.each([
  ['https://www.instagram.com/p/DAbc123_x-Y/', 'https://www.instagram.com/p/DAbc123_x-Y/'],
  ['https://instagram.com/p/DAbc123?igsh=abc', 'https://www.instagram.com/p/DAbc123/'],
  ['instagram.com/reel/CxYz987/', 'https://www.instagram.com/reel/CxYz987/'],
  ['https://www.instagram.com/alearte/p/DAbc123/?img_index=1', 'https://www.instagram.com/p/DAbc123/'],
  ['  https://www.instagram.com/tv/Qwert12  ', 'https://www.instagram.com/tv/Qwert12/'],
])('%s → canónica', (input, out) => expect(normalizeInstagramPost(input)).toBe(out))

test('vacío → null (el campo es opcional)', () => expect(normalizeInstagramPost('  ')).toBeNull())

test.each(['https://evil.com/p/DAbc123/', 'https://www.instagram.com/alearte/', 'javascript:alert(1)', 'https://www.instagram.com.evil.co/p/DAbc123/', 'https://www.instagram.com/p/ab/'])(
  '%s → inválida', (input) => expect(normalizeInstagramPost(input)).toBe('invalid'),
)
