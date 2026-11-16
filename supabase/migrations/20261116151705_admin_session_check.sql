-- Ale Arte · Migración 3: el acceso admin exige que la sesión siga viva.
-- Los JWT son válidos hasta su expiración aunque se cierre sesión; aquí se verifica
-- que la sesión (claim session_id) exista en auth.sessions. Así, cerrar sesión o la
-- expulsión por inactividad cortan el acceso administrativo de inmediato.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1 from private.app_admin a where a.user_id = (select auth.uid())
    )
    and exists (
      select 1 from auth.sessions s
      where s.id = nullif((select auth.jwt() ->> 'session_id'), '')::uuid
        and s.user_id = (select auth.uid())
        and (s.not_after is null or s.not_after > now())
    );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;
