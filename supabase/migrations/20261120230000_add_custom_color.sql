-- Ale Arte · Migración 6: color de fondo elegido a mano en el panel.
-- Si existe, reemplaza al automático (dominant_color), que se conserva para volver a él.
-- Formato estricto #rrggbb: el valor se usa en CSS.
alter table public.artwork_images
  add column custom_color text
  constraint artwork_images_custom_color_hex check (custom_color ~ '^#[0-9a-f]{6}$');

comment on column public.artwork_images.custom_color is 'Color de fondo del escaparate (#rrggbb) elegido por el admin; null = usar dominant_color.';
