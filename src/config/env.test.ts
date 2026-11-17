import { describe, expect, test } from 'vitest'
import { parseEnv } from './env'

const valid = {
  VITE_SUPABASE_URL: 'https://abc.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key',
  VITE_CLOUDINARY_CLOUD_NAME: 'demo',
  VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  VITE_WHATSAPP_NUMBER: '573001234567',
  VITE_INSTAGRAM_URL: 'https://instagram.com/alearte',
  VITE_SITE_URL: 'https://alearte.pages.dev',
}

describe('parseEnv', () => {
  test('acepta configuración válida', () => {
    expect(parseEnv(valid).whatsappNumber).toBe('573001234567')
  })
  test('rechaza URL inválida', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_URL: 'x' })).toThrow(/VITE_SUPABASE_URL/)
  })
  test('exige número WhatsApp solo dígitos con código país', () => {
    expect(() => parseEnv({ ...valid, VITE_WHATSAPP_NUMBER: '+57 300' })).toThrow(/VITE_WHATSAPP_NUMBER/)
  })
  test('TikTok es opcional pero, si viene, debe ser URL', () => {
    expect(parseEnv(valid).tiktokUrl).toBeNull()
    expect(parseEnv({ ...valid, VITE_TIKTOK_URL: 'https://www.tiktok.com/@alearte' }).tiktokUrl).toBe('https://www.tiktok.com/@alearte')
    expect(() => parseEnv({ ...valid, VITE_TIKTOK_URL: 'tiktok' })).toThrow(/VITE_TIKTOK_URL/)
  })
  test('rechaza variable faltante', () => {
    const { VITE_SUPABASE_PUBLISHABLE_KEY: _, ...rest } = valid
    expect(() => parseEnv(rest)).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/)
  })
})
