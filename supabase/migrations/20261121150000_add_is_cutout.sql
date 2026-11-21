-- Ale Arte · Migración 7: obras recortadas (fondo transparente, p. ej. un óvalo).
-- Con is_cutout, el escaparate dibuja el marco siguiendo la forma de la obra en lugar de un rectángulo.
-- El panel lo detecta al subir la imagen; el admin puede cambiarlo a mano.
alter table public.artwork_images
  add column is_cutout boolean not null default false;

comment on column public.artwork_images.is_cutout is 'Imagen con fondo transparente: el marco del escaparate sigue su forma.';

-- Imágenes ya subidas con fondo transparente (revisadas el 2026-11-21): "Refugio de agua y naturaleza".
update public.artwork_images set is_cutout = true
where id = '73fa48df-7b49-4015-9ed4-6e8f3a9d81d5';
