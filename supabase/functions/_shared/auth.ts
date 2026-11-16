import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { fail } from './http.ts'

const env = (k: string) => {
  const v = Deno.env.get(k)
  if (!v) throw new Error(`Falta la variable ${k}`)
  return v
}

/** Cliente con privilegios de servicio (solo dentro de funciones, nunca se expone). */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Verifica que la petición venga del administrador con MFA completo.
 * Triple control: JWT válido (Auth), correo === ADMIN_EMAIL, y private.is_admin() (aal2 + tabla app_admin).
 * Devuelve el cliente del usuario (RLS aplica) o una Response de error.
 */
export async function requireAdmin(
  req: Request,
): Promise<{ userId: string; userClient: SupabaseClient } | Response> {
  const origin = req.headers.get('origin')
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return fail(401, origin)

  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data.user) return fail(401, origin)

  const adminEmail = env('ADMIN_EMAIL').trim().toLowerCase()
  if ((data.user.email ?? '').toLowerCase() !== adminEmail) return fail(403, origin)

  const { data: isAdmin, error: rpcError } = await userClient.rpc('is_admin')
  if (rpcError || isAdmin !== true) return fail(403, origin)

  return { userId: data.user.id, userClient }
}
