import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_CLOUDINARY_CLOUD_NAME: z.string().regex(/^[a-z0-9_-]+$/i),
  VITE_TURNSTILE_SITE_KEY: z.string().min(1),
  VITE_WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/, 'solo dígitos con código de país, sin +'),
  VITE_INSTAGRAM_URL: z.url(),
  VITE_SITE_URL: z.url(),
})

export type Env = {
  supabaseUrl: string
  supabaseAnonKey: string
  cloudinaryCloudName: string
  turnstileSiteKey: string
  whatsappNumber: string
  instagramUrl: string
  siteUrl: string
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const vars = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Configuración de entorno inválida → ${vars}`)
  }
  const e = result.data
  return {
    supabaseUrl: e.VITE_SUPABASE_URL,
    supabaseAnonKey: e.VITE_SUPABASE_ANON_KEY,
    cloudinaryCloudName: e.VITE_CLOUDINARY_CLOUD_NAME,
    turnstileSiteKey: e.VITE_TURNSTILE_SITE_KEY,
    whatsappNumber: e.VITE_WHATSAPP_NUMBER,
    instagramUrl: e.VITE_INSTAGRAM_URL,
    siteUrl: e.VITE_SITE_URL.replace(/\/$/, ''),
  }
}

let cached: Env | undefined
/** Configuración validada; se evalúa al primer uso. */
export const env: Env = new Proxy({} as Env, {
  get(_t, prop: keyof Env) {
    cached ??= parseEnv(import.meta.env as Record<string, string | undefined>)
    return cached[prop]
  },
})
