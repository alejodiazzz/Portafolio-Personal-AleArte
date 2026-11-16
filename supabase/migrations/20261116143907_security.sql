-- Ale Arte · Migración 2: autorización y RLS
-- La autorización real vive aquí. El frontend solo oculta pantallas.

-- ── Esquema privado (no expuesto por la Data API) ──────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- Las políticas RLS se evalúan con el rol del usuario: necesita USAGE para llamar las funciones.
grant usage on schema private to anon, authenticated;

-- Único administrador: la tabla admite como máximo una fila.
create table private.app_admin (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index app_admin_singleton on private.app_admin ((true));
alter table private.app_admin enable row level security;
revoke all on private.app_admin from public, anon, authenticated;

-- ¿El usuario actual es el admin y completó MFA (aal2)?
create function private.is_admin()
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
    );
$$;

-- ¿La obra está publicada? (anon no puede leer artworks directamente)
create function private.is_artwork_published(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.artworks w
    where w.id = p_id and w.publication_status = 'published'
  );
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_artwork_published(uuid) from public;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_artwork_published(uuid) to anon, authenticated;

-- RPC pública para que el panel sepa si la sesión es admin (invoker: no eleva privilegios).
create function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ── RLS ────────────────────────────────────────────────────
alter table public.categories      enable row level security;
alter table public.artworks        enable row level security;
alter table public.artwork_images  enable row level security;
alter table public.categories      force row level security;
alter table public.artworks        force row level security;
alter table public.artwork_images  force row level security;

-- Privilegios explícitos (las tablas nuevas ya no se exponen por defecto).
revoke all on public.categories, public.artworks, public.artwork_images from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.artworks to authenticated;
grant select on public.artwork_images to anon;
grant select, insert, update, delete on public.artwork_images to authenticated;

-- categories: lectura pública, escritura admin
create policy categories_public_read on public.categories
  for select to anon, authenticated using (true);
create policy categories_admin_insert on public.categories
  for insert to authenticated with check ((select private.is_admin()));
create policy categories_admin_update on public.categories
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_admin_delete on public.categories
  for delete to authenticated using ((select private.is_admin()));

-- artworks: solo admin (el público lee la vista public_artworks)
create policy artworks_admin_all on public.artworks
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- artwork_images: lectura si la obra está publicada; escritura admin
create policy artwork_images_public_read on public.artwork_images
  for select to anon, authenticated
  using (private.is_artwork_published(artwork_id) or (select private.is_admin()));
create policy artwork_images_admin_insert on public.artwork_images
  for insert to authenticated with check ((select private.is_admin()));
create policy artwork_images_admin_update on public.artwork_images
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy artwork_images_admin_delete on public.artwork_images
  for delete to authenticated using ((select private.is_admin()));

-- ── Vista pública ──────────────────────────────────────────
-- Intencionalmente SIN security_invoker: se ejecuta como su dueño para leer artworks
-- (bloqueada para anon) y expone SOLO obras publicadas y columnas mínimas.
-- El precio se anula para obras vendidas o por encargo (no llega al navegador).
create view public.public_artworks as
select
  w.id,
  w.slug,
  w.title,
  w.description,
  case when w.availability_status = 'available' then w.price end as price,
  w.currency,
  w.height,
  w.width,
  w.measurement_unit,
  w.technique,
  w.category_id,
  w.creation_date,
  w.availability_status,
  w.display_order,
  w.created_at
from public.artworks w
where w.publication_status = 'published';

revoke all on public.public_artworks from public, anon, authenticated;
grant select on public.public_artworks to anon, authenticated;

-- Tipos usados por el cliente
grant usage on type public.availability_status, public.publication_status, public.measurement_unit
  to anon, authenticated;
