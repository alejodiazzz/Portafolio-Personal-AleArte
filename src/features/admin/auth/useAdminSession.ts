import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export type AdminStatus = 'loading' | 'anon' | 'needs-mfa-enroll' | 'needs-mfa-verify' | 'admin' | 'forbidden'

/** Resuelve el estado de la sesión. La decisión final de "admin" la toma la BD (rpc is_admin). */
export async function resolveAdminStatus(): Promise<AdminStatus> {
  const { data: s } = await supabase.auth.getSession()
  if (!s.session) return 'anon'
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalError || !aal) return 'anon'
  if (aal.currentLevel !== 'aal2') {
    const { data: factors } = await supabase.auth.mfa.listFactors()
    return factors?.totp?.some((f) => f.status === 'verified') ? 'needs-mfa-verify' : 'needs-mfa-enroll'
  }
  const { data: isAdmin, error } = await supabase.rpc('is_admin')
  return !error && isAdmin === true ? 'admin' : 'forbidden'
}

export function useAdminSession() {
  const [status, setStatus] = useState<AdminStatus>('loading')

  const refresh = useCallback(async () => {
    const next = await resolveAdminStatus().catch(() => 'anon' as const)
    if (next === 'forbidden') await supabase.auth.signOut({ scope: 'local' })
    setStatus(next)
  }, [])

  useEffect(() => {
    void refresh()
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setStatus('anon')
      else if (event === 'SIGNED_IN' || event === 'MFA_CHALLENGE_VERIFIED') setTimeout(() => void refresh(), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  const signOut = useCallback(async (scope: 'local' | 'global' = 'global') => {
    await supabase.auth.signOut({ scope })
    setStatus('anon')
  }, [])

  return { status, refresh, signOut }
}
