-- Ale Arte · Migración 5: enlace a Instagram por obra y subastas.
-- Las ofertas guardan datos personales: solo el admin las lee; el público ve monto y conteo.

-- ── Enlace opcional a la publicación de Instagram ─────────
-- Formato canónico (el panel lo normaliza): https://www.instagram.com/p|reel|tv/<código>/
alter table public.artworks add column instagram_url text
  constraint artworks_instagram_url_format check (
    instagram_url ~ '^https://www\.instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]{5,64}/$'
  );
grant select (instagram_url) on public.artworks to anon;

create or replace view public.public_artworks
with (security_invoker = true) as
select
  w.id, w.slug, w.title, w.description, w.public_price as price, w.currency, w.height, w.width,
  w.measurement_unit, w.technique, w.category_id, w.creation_date, w.availability_status,
  w.display_order, w.created_at, w.instagram_url
from public.artworks w
where w.publication_status = 'published';

-- ── Subastas (estado público, sin datos personales) ────────
create table public.auctions (
  artwork_id     uuid primary key references public.artworks (id) on delete cascade,
  starting_price numeric(12, 0) not null check (starting_price > 0),
  min_increment  numeric(12, 0) not null check (min_increment > 0),
  ends_at        timestamptz not null,
  current_amount numeric(12, 0) check (current_amount > 0),
  bid_count      integer not null default 0 check (bid_count >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger auctions_set_updated_at
  before update on public.auctions
  for each row execute function public.set_updated_at();

-- ── Ofertas (datos personales: solo admin) ─────────────────
create table public.auction_bids (
  id           uuid primary key default gen_random_uuid(),
  artwork_id   uuid not null references public.auctions (artwork_id) on delete cascade,
  amount       numeric(12, 0) not null check (amount > 0),
  bidder_name  text not null check (char_length(btrim(bidder_name)) between 2 and 80),
  bidder_email text not null check (char_length(bidder_email) <= 254 and bidder_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  bidder_phone text not null check (bidder_phone ~ '^\+?[0-9]{7,15}$'),
  consent_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create index auction_bids_artwork_amount_idx on public.auction_bids (artwork_id, amount desc, created_at desc);

-- ── RLS y privilegios ─────────────────────────────────────
alter table public.auctions     enable row level security;
alter table public.auction_bids enable row level security;
alter table public.auctions     force row level security;
alter table public.auction_bids force row level security;

revoke all on public.auctions, public.auction_bids from public, anon, authenticated;
grant select on public.auctions to anon, authenticated;
-- El admin configura la subasta; monto actual y conteo solo cambian vía place_bid / borrado de ofertas.
grant insert (artwork_id, starting_price, min_increment, ends_at, is_active) on public.auctions to authenticated;
grant update (starting_price, min_increment, ends_at, is_active) on public.auctions to authenticated;
grant delete on public.auctions to authenticated;
grant select, delete on public.auction_bids to authenticated;

create policy auctions_public_read on public.auctions
  for select to anon, authenticated
  using ((is_active and private.is_artwork_published(artwork_id)) or (select private.is_admin()));
create policy auctions_admin_insert on public.auctions
  for insert to authenticated with check ((select private.is_admin()));
create policy auctions_admin_update on public.auctions
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy auctions_admin_delete on public.auctions
  for delete to authenticated using ((select private.is_admin()));

create policy auction_bids_admin_read on public.auction_bids
  for select to authenticated using ((select private.is_admin()));
create policy auction_bids_admin_delete on public.auction_bids
  for delete to authenticated using ((select private.is_admin()));

-- Al borrar una oferta (p. ej. una falsa), el estado público se recalcula.
create function private.recompute_auction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.auctions a set
    current_amount = (select max(b.amount) from public.auction_bids b where b.artwork_id = old.artwork_id),
    bid_count      = (select count(*)     from public.auction_bids b where b.artwork_id = old.artwork_id)
  where a.artwork_id = old.artwork_id;
  return null;
end;
$$;
revoke all on function private.recompute_auction() from public;
create trigger auction_bids_recompute
  after delete on public.auction_bids
  for each row execute function private.recompute_auction();

-- ── Registrar una oferta ──────────────────────────────────
-- Solo la llama la Edge Function auction-bid (service_role), después de verificar el CAPTCHA.
-- Bloquea la fila de la subasta: dos ofertas simultáneas no pueden ganar con el mismo monto.
-- Antifrancotirador: una oferta en los últimos 5 minutos extiende el cierre a now() + 5 min.
create function public.place_bid(
  p_artwork_id uuid, p_amount numeric, p_name text, p_email text, p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a        public.auctions%rowtype;
  v_min    numeric;
  v_top    text;
  v_title  text;
begin
  select * into a from public.auctions where artwork_id = p_artwork_id for update;
  if not found or not a.is_active or not private.is_artwork_published(p_artwork_id) or now() >= a.ends_at then
    return jsonb_build_object('status', 'closed');
  end if;

  v_min := coalesce(a.current_amount + a.min_increment, a.starting_price);
  if p_amount is null or p_amount <> trunc(p_amount) or p_amount < v_min then
    return jsonb_build_object('status', 'too_low', 'min_next', v_min,
      'current_amount', a.current_amount, 'bid_count', a.bid_count, 'ends_at', a.ends_at);
  end if;
  -- Tope contra ofertas absurdas que bloquearían la subasta.
  if p_amount > v_min * 10 then
    return jsonb_build_object('status', 'too_high', 'max', v_min * 10);
  end if;

  select lower(b.bidder_email) into v_top
  from public.auction_bids b where b.artwork_id = p_artwork_id
  order by b.amount desc, b.created_at desc limit 1;
  if v_top = lower(btrim(p_email)) then
    return jsonb_build_object('status', 'already_top');
  end if;

  insert into public.auction_bids (artwork_id, amount, bidder_name, bidder_email, bidder_phone, consent_at)
  values (p_artwork_id, p_amount, btrim(p_name), lower(btrim(p_email)), p_phone, now());

  update public.auctions set
    current_amount = p_amount,
    bid_count      = bid_count + 1,
    ends_at        = greatest(ends_at, now() + interval '5 minutes')
  where artwork_id = p_artwork_id
  returning * into a;

  select w.title into v_title from public.artworks w where w.id = p_artwork_id;
  return jsonb_build_object('status', 'ok', 'title', v_title,
    'current_amount', a.current_amount, 'bid_count', a.bid_count, 'ends_at', a.ends_at,
    'min_next', a.current_amount + a.min_increment);
end;
$$;
revoke all on function public.place_bid(uuid, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.place_bid(uuid, numeric, text, text, text) to service_role;

-- ── Tiempo real: la página escucha cambios del estado público ──
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.auctions;
  end if;
end;
$$;
