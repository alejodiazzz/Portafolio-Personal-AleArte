-- Ale Arte · Migración 1: esquema base
-- Tipos, tablas, restricciones, índices, trigger updated_at y categorías iniciales.

create type public.availability_status as enum ('available', 'sold', 'commission');
create type public.publication_status as enum ('draft', 'published');
create type public.measurement_unit as enum ('cm', 'm', 'in');

-- ── categories ─────────────────────────────────────────────
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique check (char_length(btrim(name)) between 1 and 80),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  description   text check (char_length(description) <= 1000),
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

-- ── artworks ───────────────────────────────────────────────
create table public.artworks (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(btrim(title)) between 1 and 150),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 180),
  description         text check (char_length(description) <= 5000),
  price               numeric(12, 0) check (price >= 0),
  -- Precio visible al público: solo si la obra está disponible (columna calculada).
  public_price        numeric(12, 0) generated always as (
                        case when availability_status = 'available' then price end
                      ) stored,
  currency            char(3) not null default 'COP' check (currency = 'COP'),
  height              numeric(7, 2) check (height > 0),
  width               numeric(7, 2) check (width > 0),
  measurement_unit    public.measurement_unit,
  technique           text check (char_length(technique) <= 150),
  category_id         uuid not null references public.categories (id) on delete restrict,
  creation_date       date,
  availability_status public.availability_status not null default 'available',
  publication_status  public.publication_status not null default 'draft',
  display_order       integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint artworks_unit_required check (
    (height is null and width is null) or measurement_unit is not null
  )
);

create index artworks_public_listing_idx
  on public.artworks (publication_status, category_id, display_order);
create index artworks_order_idx
  on public.artworks (display_order, created_at);
create index artworks_category_id_idx
  on public.artworks (category_id);

-- ── artwork_images ─────────────────────────────────────────
create table public.artwork_images (
  id            uuid primary key default gen_random_uuid(),
  artwork_id    uuid not null references public.artworks (id) on delete cascade,
  storage_path  text not null unique
                check (storage_path ~ '^ale-arte/artworks/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  image_alt     text check (char_length(image_alt) <= 250),
  width         integer check (width > 0),
  height        integer check (height > 0),
  format        text check (format in ('webp', 'jpg', 'png', 'avif')),
  bytes         integer check (bytes > 0),
  is_cover      boolean not null default false,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index artwork_images_artwork_order_idx
  on public.artwork_images (artwork_id, display_order);
create unique index artwork_images_one_cover_idx
  on public.artwork_images (artwork_id) where is_cover;

-- ── updated_at ─────────────────────────────────────────────
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger artworks_set_updated_at
  before update on public.artworks
  for each row execute function public.set_updated_at();

-- ── categorías iniciales (idempotente, también llega a prod) ──
insert into public.categories (name, slug, display_order) values
  ('Retratos a lápiz',      'retratos-a-lapiz',      1),
  ('Pinturas acrílicas',    'pinturas-acrilicas',    2),
  ('Murales',               'murales',               3),
  ('Retratos de mascotas',  'retratos-de-mascotas',  4),
  ('Otros proyectos',       'otros-proyectos',       5)
on conflict (slug) do nothing;
