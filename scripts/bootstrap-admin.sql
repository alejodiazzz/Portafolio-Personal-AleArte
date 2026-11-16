-- Alta del ÚNICO administrador de Ale Arte.
-- Requisito: el usuario ya existe en Supabase Auth (creado a mano en Dashboard → Authentication → Users).
-- Uso (SQL Editor del dashboard): ver docs/setup-auth.md (versión sin comandos psql).
-- Uso (psql):  psql "$DB_URL" -v admin_email='correo@dominio.com' -f scripts/bootstrap-admin.sql
--
-- Falla si: el correo no existe en auth.users, o ya hay un administrador registrado.

\if :{?admin_email}
  select set_config('ale.admin_email', :'admin_email', false);
\else
  select set_config('ale.admin_email', 'CAMBIA-ESTE-CORREO@dominio.com', false); -- ← editar aquí
\endif

do $$
declare
  v_email text := lower(btrim(current_setting('ale.admin_email')));
  v_user  uuid;
begin
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    raise exception 'No existe un usuario de Auth con el correo %', v_email;
  end if;
  if exists (select 1 from private.app_admin) then
    raise exception 'Ya existe un administrador. Elimínalo primero si quieres reemplazarlo.';
  end if;
  insert into private.app_admin (user_id) values (v_user);
  raise notice 'Administrador registrado: % (%)', v_email, v_user;
end;
$$;
