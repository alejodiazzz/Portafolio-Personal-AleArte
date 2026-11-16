-- Ale Arte · Migración 4: color dominante de cada imagen (fondo del escaparate).
-- Lo calcula el panel al subir la foto. Formato estricto #rrggbb: el valor se usa en CSS.
alter table public.artwork_images
  add column dominant_color text
  constraint artwork_images_dominant_color_hex check (dominant_color ~ '^#[0-9a-f]{6}$');

comment on column public.artwork_images.dominant_color is 'Color de fondo del escaparate (#rrggbb), calculado al subir la imagen.';
