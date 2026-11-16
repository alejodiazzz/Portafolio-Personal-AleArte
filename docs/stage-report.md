# Informe de etapa — Ale Arte (Etapas 1 a 5, sin diseño visual)

Fecha: 2026-11-16 · Rama: `feat/etapas-2-5`

## 1. Qué se implementó

- **Base de datos** (3 migraciones reproducibles): categorías, obras e imágenes, con restricciones, índices, categorías iniciales y seguridad (RLS, admin único, MFA y sesión viva).
- **Autenticación**: Supabase Auth con correo y contraseña, sin registro público, MFA TOTP obligatorio, CAPTCHA Turnstile, cierre de sesión global y por inactividad.
- **Edge Functions**: `media-sign` (firma de subidas), `media-delete` (borrado en BD y Cloudinary) y `media-cleanup` (barrido de huérfanos + keep-alive).
- **Imágenes**: validación por tipo real y tamaño, conversión a WebP (máx. 2560 px, q 0.9) en el navegador, subida firmada a Cloudinary y entrega en WebP/AVIF automático en 400/800/1600 px con `srcset` y carga diferida.
- **Portafolio público** (UI técnica mínima): listado paginado (12 por página, "Cargar más"), filtro por categoría y detalle con precio según las reglas, medidas, técnica, descripción, estado, WhatsApp con mensaje que incluye la obra, e Instagram.
- **Panel admin** (UI técnica mínima): CRUD de obras; publicar o despublicar; cambiar disponibilidad; ordenar; subir, reemplazar, eliminar y reordenar imágenes; elegir portada; editar textos alternativos; CRUD y orden de categorías.
- **Despliegue**: `_headers` (CSP y caché) generado en el build, `_redirects` para la SPA, CI (tests, build y escaneo de secretos), cron keep-alive y documentación.

## 2. Arquitectura final

```
Navegador (SPA React 19 + TS + Vite 8, Cloudflare Pages)
 ├─ lectura pública ─────────► Supabase PostgREST (publishable key + RLS + vista public_artworks)
 ├─ login + MFA (JWT) ───────► Supabase Auth (+ Turnstile)
 ├─ CRUD admin (JWT aal2) ───► PostgREST (RLS: private.is_admin())
 ├─ firma / borrado (JWT) ───► Edge Functions ──► Cloudinary (secretos solo aquí)
 └─ imágenes ────────────────► Cloudinary CDN (f_auto, q_auto, w_400/800/1600)
GitHub Actions (cada 3 días) ─► media-cleanup (keep-alive + huérfanos)
```

Dependencias de runtime: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js` y `zod` (zod solo en el panel). Bundle público: ~158 KB gzip; el panel se carga aparte (~32 KB gzip).

## 3. Modelo de datos

- `categories` (id, name, slug, description, display_order, created_at)
- `artworks` (id, title, slug, description, price, **public_price** (calculada), currency=COP, height, width, measurement_unit, technique, category_id → categories **RESTRICT**, creation_date, availability_status, publication_status, display_order, created_at, updated_at)
- `artwork_images` (id, artwork_id → artworks **CASCADE**, storage_path = public_id de Cloudinary, image_alt, width, height, format, bytes, is_cover (una portada por obra), display_order, created_at)
- `private.app_admin` (user_id → auth.users), con máximo una fila.
- Vista `public_artworks` (security_invoker): obras publicadas, con el precio anulado si están vendidas o por encargo.

Detalle completo en `supabase/migrations/`.

## 4. Seguridad

Ver [security-report.md](security-report.md). En resumen: la autorización vive en PostgreSQL, no en el frontend. Exige el usuario registrado como admin, MFA completo y la sesión viva. Las Edge Functions añaden la comprobación del correo autorizado, y los secretos nunca llegan al navegador.

## 5. Resultados de las pruebas

- `npm test`: **93/93** (unidades, componentes, cabeceras, firma y validación de archivos).
- `npm run test:security`: **43 pasan, 3 omitidas** (las 3 necesitan credenciales reales de Cloudinary).
- `npx supabase db advisors`: sin errores ni advertencias.
- `npm run check:secrets`: sin secretos en el bundle.

## 6. Despliegue

**Desplegado y verificado** en https://portafolio-personal-alearte.diaza-alejandro123.workers.dev (Cloudflare Workers + Supabase `ale-arte-prod`, us-east-1 + Cloudinary). Admin registrado con MFA. El flujo completo fue probado por el propietario.

Pendientes opcionales: proyecto Supabase de pruebas en la nube (hoy las pruebas corren en local), secretos de GitHub para el workflow de keep-alive (`SUPABASE_URL_PROD`, `CRON_SECRET_PROD`), dominio propio y ajustes menores del informe de revisión.

## 7. Siguiente etapa

**No se avanzará al diseño visual sin tu autorización explícita.** Cuando apruebes esta etapa, comparte tus referencias visuales.
