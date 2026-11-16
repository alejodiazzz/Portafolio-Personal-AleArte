import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env'

/** Cliente con sesión (panel admin). */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'ale-arte-auth' },
})

/** Cliente sin sesión para el portafolio público: siempre consulta como visitante. */
export const publicSupabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'ale-arte-public' },
})
