// Validación sin dependencias (zod no entra al bundle público).
type Rule = (v: string) => string | null
const isUrl: Rule = (v) => {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? null : 'URL inválida'
  } catch {
    return 'URL inválida'
  }
}
const nonEmpty: Rule = (v) => (v.trim() ? null : 'requerido')
const pattern = (re: RegExp, msg: string): Rule => (v) => (re.test(v) ? null : msg)

const RULES: Record<string, Rule> = {
  VITE_SUPABASE_URL: isUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: nonEmpty,
  VITE_CLOUDINARY_CLOUD_NAME: pattern(/^[a-z0-9_-]+$/i, 'nombre inválido'),
  VITE_TURNSTILE_SITE_KEY: nonEmpty,
  VITE_WHATSAPP_NUMBER: pattern(/^\d{8,15}$/, 'solo dígitos con código de país, sin +'),
  VITE_INSTAGRAM_URL: isUrl,
  VITE_SITE_URL: isUrl,
}

export type Env = {
  supabaseUrl: string
  supabasePublishableKey: string
  cloudinaryCloudName: string
  turnstileSiteKey: string
  whatsappNumber: string
  instagramUrl: string
  siteUrl: string
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const problems = Object.entries(RULES).flatMap(([k, rule]) => {
    const v = raw[k]
    if (v === undefined || v === '') return [`${k}: requerido`]
    const msg = rule(v)
    return msg ? [`${k}: ${msg}`] : []
  })
  if (problems.length) throw new Error(`Configuración de entorno inválida → ${problems.join('; ')}`)
  const e = raw as Record<string, string>
  return {
    supabaseUrl: e.VITE_SUPABASE_URL,
    supabasePublishableKey: e.VITE_SUPABASE_PUBLISHABLE_KEY,
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
