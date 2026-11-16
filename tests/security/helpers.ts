import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pg from 'pg'

const need = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`Falta ${k} en .env.test.local`)
  return v
}
export const URL = () => need('TEST_SUPABASE_URL')
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

export function anonClient(): SupabaseClient {
  return createClient(URL(), need('TEST_SUPABASE_PUBLISHABLE_KEY'), opts)
}
export function serviceClient(): SupabaseClient {
  return createClient(URL(), need('TEST_SUPABASE_SECRET_KEY'), opts)
}
/** Conexión SQL directa (solo pruebas): para tablas del esquema privado. */
export async function sql<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: need('TEST_DB_URL') })
  await client.connect()
  try {
    return (await client.query(text, params)).rows as T[]
  } finally {
    await client.end()
  }
}

export async function anyCategoryId(): Promise<string> {
  const rows = await sql<{ id: string }>(`select id from public.categories order by display_order limit 1`)
  return rows[0].id
}

let n = 0
export async function makeArtwork(
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; slug: string }> {
  const svc = serviceClient()
  const slug = `test-${Date.now()}-${n++}`
  const { data, error } = await svc
    .from('artworks')
    .insert({ title: 'Obra de prueba', slug, category_id: await anyCategoryId(), ...overrides })
    .select('id, slug')
    .single()
  if (error) throw error
  return data
}

export async function makeImage(artworkId: string): Promise<{ id: string }> {
  const { data, error } = await serviceClient()
    .from('artwork_images')
    .insert({ artwork_id: artworkId, storage_path: `ale-arte/artworks/${artworkId}/${crypto.randomUUID()}` })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function cleanupTestArtworks() {
  await sql(`delete from public.artworks where slug like 'test-%'`)
}

// ── Usuarios de prueba ──────────────────────────────────────
import * as OTPAuth from 'otpauth'

export const PASSWORD = 'Prueba-Segura-2026x'

export async function createTestUser(email = `user-${crypto.randomUUID()}@test.local`): Promise<{ id: string; email: string }> {
  await sql('delete from auth.users where email = $1', [email])
  const { data, error } = await serviceClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  return { id: data.user.id, email }
}

/** Cliente con sesión aal1 (solo contraseña). */
export async function signIn(email: string): Promise<SupabaseClient> {
  const c = anonClient()
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return c
}

/** Enrola TOTP y eleva la sesión a aal2. Devuelve el cliente y el secreto. */
export async function elevateToAal2(c: SupabaseClient): Promise<string> {
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(data.totp.secret) })
  const v = await c.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp.generate() })
  if (v.error) throw v.error
  return data.totp.secret
}

/** Crea el admin de pruebas (reemplaza cualquier admin previo en el entorno de pruebas). */
export async function createTestAdmin(email?: string) {
  const user = await createTestUser(email)
  await sql('delete from private.app_admin')
  await sql('insert into private.app_admin (user_id) values ($1)', [user.id])
  return {
    ...user,
    aal1Client: () => signIn(user.email),
    aal2Client: async () => {
      const c = await signIn(user.email)
      await elevateToAal2(c)
      return c
    },
  }
}

export async function deleteTestUsers() {
  await sql(`delete from auth.users where email like '%@test.local'`)
}

export async function accessToken(c: SupabaseClient): Promise<string> {
  const { data } = await c.auth.getSession()
  return data.session!.access_token
}
