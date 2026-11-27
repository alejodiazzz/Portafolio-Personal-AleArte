-- Ale Arte · Migración: ubicación geográfica para murales / obras urbanas
-- Permite indicar nombre del lugar y coordenadas (lat, lng) para mostrar en el mapa público.

alter table public.artworks
  add column location_name text check (char_length(location_name) <= 250),
  add column latitude numeric(9, 6) check (latitude between -90 and 90),
  add column longitude numeric(9, 6) check (longitude between -180 and 180),
  add constraint artworks_coordinates_both_or_none check (
    (latitude is null and longitude is null) or (latitude is not null and longitude is not null)
  );

grant select (location_name, latitude, longitude) on public.artworks to anon;

create or replace view public.public_artworks
with (security_invoker = true) as
select
  w.id,
  w.slug,
  w.title,
  w.description,
  w.public_price as price,
  w.currency,
  w.height,
  w.width,
  w.measurement_unit,
  w.technique,
  w.category_id,
  w.creation_date,
  w.availability_status,
  w.display_order,
  w.created_at,
  w.instagram_url,
  w.location_name,
  w.latitude,
  w.longitude
from public.artworks w
where w.publication_status = 'published';
