# Ale Arte — Plan de implementación (Etapas 2–5, sin diseño visual)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portafolio SPA funcional y seguro: lectura pública desde Supabase, panel admin único con MFA, imágenes en Cloudinary vía Edge Functions, listo para Cloudflare Pages.

**Architecture:** SPA React/TS/Vite habla con Supabase (PostgREST + Auth). La autorización vive en PostgreSQL (RLS + `is_admin()` con aal2) y en 3 Edge Functions que guardan los secretos de Cloudinary. GitHub Actions hace keep-alive y barrido de huérfanos.

**Tech Stack:** React 18, TypeScript 5, Vite 5, react-router-dom 6, @supabase/supabase-js 2, zod 3, Vitest, Supabase CLI (vía `npx supabase`), Deno (Edge Functions), Cloudinary Upload/Admin API, Cloudflare Pages + Turnstile, `otpauth` (solo tests).

**Spec:** `docs/superpowers/specs/2026-11-16-ale-arte-arquitectura-design.md`

## Global Constraints

- **Sin diseño visual:** UI técnica mínima (HTML semántico, sin paleta, tipografías ni animaciones). No avanzar a diseño sin autorización explícita del propietario.
- Costo $0: solo planes gratuitos; ninguna dependencia que exija tarjeta.
- Dependencias de runtime solo: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `zod`.
- Ningún secreto en el navegador ni en el repo: `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_SECRET`, `ADMIN_EMAIL`, `CRON_SECRET` solo en secrets de Edge Functions / GitHub / `.env.test.local` (gitignored).
- Variables públicas (prefijo `VITE_`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_TURNSTILE_SITE_KEY`, `VITE_WHATSAPP_NUMBER`, `VITE_INSTAGRAM_URL`, `VITE_SITE_URL`.
- Prohibido `dangerouslySetInnerHTML`. Descripciones = texto plano.
- Moneda única `COP`. Unidades `cm | m | in`. Disponibilidad `available | sold | commission`. Publicación `draft | published`.
- Imágenes: entrada ≤ 15 MB, tipos JPEG/PNG/WebP; original almacenado WebP q0.9, lado mayor ≤ 2560 px; derivados `w_400`, `w_800`, `w_1600` con `f_auto,q_auto,c_limit`.
- `public_id` = `ale-arte/artworks/{artwork_id}/{uuid}`.
- Paginación pública: 12 por página.
- Errores al usuario genéricos (“No autorizado”, “Solicitud inválida”, “Ocurrió un error, intenta de nuevo”); detalle solo en `console`/logs del servidor.
- Textos de interfaz en español.

## Review Focus

1. **Sesión admin a medio MFA (aal1)** intentando CRUD directo por API → debe recibir 0 filas afectadas / 401-403, nunca éxito. Test en Task 4.
2. **Archivo que dice ser imagen pero no lo es** (extensión `.jpg`, contenido PDF/EXE o SVG) → rechazado antes de subir. Test en Task 7.
3. **Borrar categoría con obras asignadas** → error claro “La categoría tiene obras”, nada se borra. Test en Task 3 (BD) y mensaje en Task 11.
4. **Obra publicada sin imágenes o sin portada** → listado y detalle no se rompen (placeholder textual “Sin imagen”). Test en Task 8.
5. **Título con caracteres especiales/HTML** (`<script>`, tildes, emojis) → slug válido y se muestra escapado. Tests en Task 8.

---

### Task 0: Prerrequisitos (los hace el propietario, guiado)

No es código; el implementador entrega estas instrucciones y espera confirmación.

- [ ] Crear 2 proyectos Supabase Free: `ale-arte-dev` y `ale-arte-prod`. Anotar URL, anon key, service role key de cada uno.
- [ ] Crear cuenta Cloudinary Free. Anotar cloud name, API key, API secret.
- [ ] Crear cuenta Cloudflare: widget Turnstile (dominios `localhost` y `*.pages.dev` del proyecto) → site key + secret key.
- [ ] Crear repo remoto en GitHub (privado) y `git remote add origin …`.
- [ ] Ejecutar `! npx supabase login` en esta sesión.
- [ ] Activar 2FA en Supabase, Cloudinary, Cloudflare y GitHub.
- [ ] Crear `.env.local` y `.env.test.local` desde `.env.example` (Task 1) con valores de **dev**.

### Task 1: Scaffold, entorno validado y configuración de contacto

**Files:**
- Create: proyecto Vite (`package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`), `.gitignore` (incluye `.env*.local`, `dist`), `.env.example`
- Create: `src/config/env.ts`, `src/config/contact.ts`
- Test: `src/config/env.test.ts`, `src/config/contact.test.ts`

**Interfaces:**
- Produces: `env: { supabaseUrl: string; supabaseAnonKey: string; cloudinaryCloudName: string; turnstileSiteKey: string; whatsappNumber: string; instagramUrl: string; siteUrl: string }` (validado con zod al importar; lanza error descriptivo si falta algo).
- Produces: `parseEnv(raw: Record<string, string | undefined>): Env`
- Produces: `buildWhatsAppLink(opts?: { artworkTitle?: string; artworkUrl?: string }): string`; `instagramUrl: string`.

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`; instalar `react-router-dom @supabase/supabase-js zod`; dev `vitest jsdom @testing-library/react`. Script `"test": "vitest run"`.
- [ ] **Step 2: Tests que fallan**
```ts
test('parseEnv rechaza URL inválida', () => { expect(() => parseEnv({...valid, VITE_SUPABASE_URL: 'x'})).toThrow(/VITE_SUPABASE_URL/) })
test('parseEnv exige número WhatsApp solo dígitos con código país', () => { expect(() => parseEnv({...valid, VITE_WHATSAPP_NUMBER: '+57 300'})).toThrow() })
test('link genérico', () => expect(buildWhatsAppLink()).toBe('https://wa.me/573001234567?text=' + encodeURIComponent('Hola, quiero información sobre las obras de Ale Arte.')))
test('link con obra', () => expect(decodeURIComponent(buildWhatsAppLink({artworkTitle:'Luna & Sol', artworkUrl:'https://x.pages.dev/obra/luna-sol'}).split('text=')[1])).toBe('Hola, me interesa la obra "Luna & Sol": https://x.pages.dev/obra/luna-sol'))
```
- [ ] **Step 3:** `npm test` → FAIL. Implementar. `npm test` → PASS.
- [ ] **Step 4:** `.env.example` con todas las `VITE_*` + bloque comentado de secretos de servidor con valores ficticios. Commit `feat: scaffold y configuración validada`.

### Task 2: Esquema base (migración 1)

**Files:**
- Create: `supabase/config.toml` (`npx supabase init`), `supabase/migrations/20261116000001_schema.sql`, `supabase/seed.sql`

**Interfaces:**
- Produces: tipos `availability_status`, `publication_status`, `measurement_unit`; tablas `categories`, `artworks`, `artwork_images` exactamente como spec §6 (incluye `slug`, `display_order` en categories, `is_cover`, `bytes`); trigger `set_updated_at`; índices de §6; índice único parcial `artwork_images(artwork_id) where is_cover`.
- Constraints con valores del spec: longitudes (title 1–150, name 1–80, description ≤5000 / ≤1000, technique ≤150, image_alt ≤250), `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`, `price >= 0`, `currency = 'COP'`, `height/width > 0`, `(height is null and width is null) or measurement_unit is not null`.
- Seed: 5 categorías del spec con slugs `retratos-a-lapiz`, `pinturas-acrilicas`, `murales`, `retratos-de-mascotas`, `otros-proyectos`.

- [ ] **Step 1:** Escribir migración y seed. Seed como migración idempotente (`insert … on conflict (slug) do nothing`) para que también llegue a prod.
- [ ] **Step 2:** `npx supabase link --project-ref <dev>` y `npx supabase db push` → sin errores.
- [ ] **Step 3:** Verificar en SQL editor / `npx supabase db dump --schema public` que existen tablas, checks e índices.
- [ ] **Step 4:** Commit `feat(db): esquema base y categorías iniciales`.

### Task 3: Autorización y RLS (migración 2) + pruebas anónimas

**Files:**
- Create: `supabase/migrations/20261116000002_security.sql`
- Create: `tests/security/helpers.ts`, `tests/security/anon.test.ts`, `vitest.security.config.ts`
- Modify: `package.json` (script `"test:security": "vitest run -c vitest.security.config.ts"`)

**Interfaces:**
- Produces (SQL): esquema `private` (sin grants a anon/authenticated); `private.app_admin(user_id uuid primary key references auth.users on delete cascade)` + `create unique index app_admin_singleton on private.app_admin ((true))`; `public.is_admin() returns boolean` (security definer, stable, `set search_path = ''`, aal2); `private.is_artwork_published(p_id uuid) returns boolean` (security definer); vista `public.public_artworks` (owner postgres, sin security_invoker) con columnas `id, slug, title, description, price (null si sold/commission), currency, height, width, measurement_unit, technique, category_id, creation_date, availability_status, display_order, created_at` filtrando `published`; `grant select on public_artworks to anon, authenticated`.
- Políticas exactamente como spec §5.3 (artworks: solo `is_admin()` para todo; categories: select público, write admin; artwork_images: select si `private.is_artwork_published(artwork_id)` o admin, write admin). `alter table … force row level security`. `revoke truncate, references, trigger on all tables in schema public from anon, authenticated`.
- Produces (tests): `anonClient(): SupabaseClient`, `serviceClient(): SupabaseClient` (lee `.env.test.local`), `makeArtwork(svc, overrides?): Promise<{id: string}>`.

- [ ] **Step 1: Tests que fallan** (`anon.test.ts`, contra dev):
  - anon `insert` en `categories`, `artworks`, `artwork_images` → `error` no nulo.
  - anon `update`/`delete` en las 3 → 0 filas afectadas y la fila sigue igual (verificado con service client).
  - anon `select` de `artworks` → 0 filas aunque existan publicadas.
  - con una obra `draft` y otra `published` + `sold` con precio 500000: `public_artworks` devuelve solo la publicada y `price === null`.
  - imágenes de obra `draft` invisibles para anon; de obra publicada visibles.
  - borrar categoría con obras (service) → error de FK (Review Focus 3).
  - insertar 2ª fila en `private.app_admin` (service, vía rpc de prueba o SQL) → falla por `app_admin_singleton`.
- [ ] **Step 2:** `npm run test:security` → FAIL. Escribir migración, `npx supabase db push`, repetir → PASS.
- [ ] **Step 3:** Commit `feat(db): RLS, is_admin y vista pública`.

### Task 4: Auth, alta del admin y pruebas de autenticación

**Files:**
- Create: `scripts/bootstrap-admin.sql` (parámetro `:'admin_email'`: inserta en `private.app_admin` el `id` de `auth.users` con ese email; falla si no existe o ya hay admin)
- Create: `docs/setup-auth.md` (signups off, Turnstile secret en Auth → Attack Protection, contraseña mínima 12, Site URL/Redirect URLs, MFA TOTP habilitado, cómo ejecutar bootstrap, **recuperación por pérdida de autenticador**: borrar factor en Dashboard → Auth → Users)
- Test: `tests/security/auth.test.ts`

**Interfaces:**
- Consumes: helpers de Task 3.
- Produces (tests): `createTestAdmin(svc): Promise<{ email; password; totpSecret; aal2Client(): Promise<SupabaseClient>; aal1Client(): Promise<SupabaseClient> }>` — crea usuario con service role, lo registra en `app_admin` (borrando el previo en dev), enrola TOTP y verifica códigos con `otpauth`. `createTestUser(svc)` para no-admin.

- [ ] **Step 1: Configurar dev** según `docs/setup-auth.md` (manual en dashboard; Turnstile: para tests usar la *testing secret key* oficial de Cloudflare `1x0000000000000000000000000000000AA` solo en dev).
- [ ] **Step 2: Tests que fallan:**
  - `anon.auth.signUp(...)` → error (signups deshabilitados).
  - usuario autenticado no admin: insert/update/delete en las 3 tablas → bloqueado; `rpc('is_admin')` → `false`.
  - admin con **aal1**: `rpc('is_admin')` → `false`; insert en `artworks` → error (Review Focus 1).
  - admin con **aal2**: CRUD completo funciona; `rpc('is_admin')` → `true`.
  - JWT manipulado (cambiar payload, conservar firma) en header → PostgREST 401.
- [ ] **Step 3:** Ejecutar → PASS. Commit `feat(auth): alta de admin, MFA y pruebas de autenticación`.

### Task 5: Utilidades compartidas de Edge Functions

**Files:**
- Create: `supabase/functions/_shared/cloudinary.ts`, `_shared/http.ts`, `_shared/auth.ts`
- Test: `tests/unit/cloudinary-sign.test.ts` (importa `_shared/cloudinary.ts`; ese archivo no importa nada externo, solo Web Crypto)

**Interfaces:**
- Produces: `signParams(params: Record<string, string | number>, apiSecret: string): Promise<string>` — SHA-1 hex de params ordenados alfabéticamente `k=v&k2=v2` + secret (excluye `file`, `api_key`, `resource_type`, `cloud_name`).
- Produces: `buildPublicId(artworkId: string, uuid: string): string`; `isValidPublicId(id: string): boolean` (regex `^ale-arte/artworks/[0-9a-f-]{36}/[0-9a-f-]{36}$`).
- Produces: `corsHeaders(origin: string | null, allowed: string[]): HeadersInit`; `json(body: unknown, status?: number, origin?): Response`; `fail(status: 400|401|403|500, origin?): Response` con mensajes genéricos del spec.
- Produces: `requireAdmin(req: Request): Promise<{ userId: string; userClient: SupabaseClient } | Response>` — valida bearer, `auth.getUser`, `user.email === Deno.env.get('ADMIN_EMAIL')` (comparación en minúsculas), `rpc('is_admin')` con el JWT del usuario.

- [ ] **Step 1: Tests que fallan:** vector conocido de la doc de Cloudinary: `signParams({public_id:'sample_image', timestamp:1315060510}, 'abcd')` → `'b4ad47fb4e25c7bf5f92a20089f9db59bc302313'`; `isValidPublicId` acepta formato correcto y rechaza `../`, otras carpetas y vacíos.
- [ ] **Step 2:** Implementar → PASS. Commit `feat(edge): utilidades de firma, CORS y guardia admin`.

### Task 6: Edge Functions `media-sign`, `media-delete`, `media-cleanup`

**Files:**
- Create: `supabase/functions/media-sign/index.ts`, `media-delete/index.ts`, `media-cleanup/index.ts`
- Test: `tests/security/edge.test.ts`

**Interfaces:**
- Secrets: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `ADMIN_EMAIL`, `CRON_SECRET`, `ALLOWED_ORIGINS` (coma-separado).
- `POST media-sign` body `{ artworkId: uuid }` → `{ cloudName, apiKey, timestamp, publicId, signature, allowedFormats: 'webp,jpg,png' }`. Verifica que la obra exista (userClient).
- `POST media-delete` body `{ imageId: uuid } | { artworkId: uuid }` → borra fila(s) con userClient (RLS aplica) y luego en Cloudinary (`destroy` o `delete_resources_by_prefix` `ale-arte/artworks/{id}/`). Responde `{ ok: true, orphaned: boolean }`.
- `POST media-cleanup` header `x-cron-secret` → lista `ale-arte/artworks/` (Admin API, paginado, máx 500), borra recursos sin fila en `artwork_images` y `created_at` > 24 h (usa service role internamente). Responde `{ checked, deleted }`.
- Desplegar con `npx supabase functions deploy <name>`; `media-cleanup` con `--no-verify-jwt`.

- [ ] **Step 1: Tests que fallan (`edge.test.ts`):** sin header → 401; JWT de no-admin → 403; admin aal1 → 403; admin aal2 → 200 con firma; `artworkId` inválido → 400; `media-cleanup` sin/ con secreto incorrecto → 401; origen no permitido → sin `Access-Control-Allow-Origin`. Flujo real: firma → subir PNG 1×1 a Cloudinary con esa firma → insertar fila → `media-delete {artworkId}` → recurso ya no existe (Admin API).
- [ ] **Step 2:** Implementar, configurar secrets en dev (`npx supabase secrets set …`), desplegar, `npm run test:security` → PASS.
- [ ] **Step 3:** Commit `feat(edge): firma, borrado y barrido de imágenes`.

### Task 7: Librerías del frontend (cliente, URLs, procesamiento de imágenes)

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/cloudinary.ts`, `src/lib/images.ts`, `src/lib/errors.ts`
- Test: `src/lib/cloudinary.test.ts`, `src/lib/images.test.ts`, `src/lib/errors.test.ts`

**Interfaces:**
- Produces: `supabase: SupabaseClient` (persistSession, autoRefreshToken).
- Produces: `imageUrl(publicId: string, width: 400 | 800 | 1600): string` → `https://res.cloudinary.com/{cloud}/image/upload/f_auto,q_auto,c_limit,w_{width}/{publicId}`; `imageSrcSet(publicId): string`.
- Produces: `detectImageType(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | null` (magic bytes); `validateImageFile(file: File): Promise<{ ok: true } | { ok: false; reason: 'type' | 'size' }>` (≤ 15 MB); `prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number }>` (createImageBitmap → canvas/OffscreenCanvas, lado mayor ≤ 2560, `image/webp` 0.9).
- Produces: `uploadArtworkImage(artworkId: string, file: File, alt: string): Promise<ArtworkImage>` (valida → prepara → `functions.invoke('media-sign')` → POST multipart a Cloudinary → insert en `artwork_images` con width/height/format/bytes).
- Produces: `toUserMessage(err: unknown): string` (mapea a los 3 mensajes genéricos; `23503` → “La categoría tiene obras”; nunca expone texto del servidor).

- [ ] **Step 1: Tests que fallan:** URL exacta para `w_800`; srcset con 3 anchos; `detectImageType` sobre bytes de JPEG/PNG/WebP reales y sobre `%PDF`, `MZ` y `<svg` → `null` (Review Focus 2); archivo de 16 MB → `{ok:false, reason:'size'}`; `toUserMessage` nunca devuelve el `message` original.
- [ ] **Step 2:** Implementar → PASS (`prepareImage` y `uploadArtworkImage` se verifican en Task 11 en navegador). Commit `feat(lib): cliente, URLs de Cloudinary y validación de imágenes`.

### Task 8: Capa de datos (pública y admin) y utilidades de dominio

**Files:**
- Create: `src/features/portfolio/api.ts`, `src/features/admin/api.ts`, `src/lib/slug.ts`, `src/lib/price.ts`, `src/types.ts`
- Test: `src/lib/slug.test.ts`, `src/lib/price.test.ts`, `src/features/portfolio/api.test.ts` (con cliente mockeado)

**Interfaces:**
- Produces tipos `Category`, `PublicArtwork`, `Artwork`, `ArtworkImage`, `ArtworkInput` (zod schema `artworkInputSchema` con los mismos límites que la BD).
- Produces: `slugify(title: string): string`; `uniqueSlug(base: string, taken: string[]): string` (sufijos `-2`, `-3`…).
- Produces: `priceLabel(a: Pick<PublicArtwork,'price'|'availability_status'>): string` — reglas spec §7: `'$ 1.200.000 COP'` / `'Precio a consultar'` / `'Vendida'` / `'Cotiza la tuya'`.
- Produces (público): `listCategories()`, `listArtworks({ categorySlug?: string; page: number }): Promise<{ items: (PublicArtwork & { cover: ArtworkImage | null })[]; hasMore: boolean }>`, `getArtworkBySlug(slug): Promise<(PublicArtwork & { images: ArtworkImage[] }) | null>`.
- Produces (admin): `adminListArtworks()`, `adminGetArtwork(id)`, `createArtwork(input)`, `updateArtwork(id, input)`, `deleteArtwork(id)` (vía `media-delete`), `setPublication(id, status)`, `setAvailability(id, status)`, `moveArtwork(id, dir: 'up'|'down')`, `setCover(imageId)`, `deleteImage(imageId)` (vía `media-delete`), `moveImage(imageId, dir)`, `replaceImage(imageId, file)`, CRUD categorías `createCategory/updateCategory/deleteCategory/moveCategory`.

- [ ] **Step 1: Tests que fallan:** `slugify('Retrato de Ñandú <script>')` → `'retrato-de-nandu-script'`; `slugify('🎨!!')` → `'obra'` (fallback); `uniqueSlug('luna',['luna','luna-2'])` → `'luna-3'`; `priceLabel` 4 casos (formato `es-CO`); `listArtworks` pide `range(0,11)` y `hasMore` true con 12 resultados; obra sin imágenes → `cover: null` sin error (Review Focus 4); `artworkInputSchema` rechaza título vacío y precio negativo.
- [ ] **Step 2:** Implementar → PASS. Commit `feat(data): consultas públicas, admin, slugs y precios`.

### Task 9: Rutas públicas mínimas

**Files:**
- Create: `src/routes/router.tsx`, `src/features/portfolio/PortfolioPage.tsx`, `ArtworkPage.tsx`, `ContactLinks.tsx`, `ArtworkImage.tsx`
- Test: `src/features/portfolio/ArtworkPage.test.tsx`

**Interfaces:**
- Rutas: `/` (listado + filtro `?categoria=slug` + “Cargar más”), `/obra/:slug`, `/admin/*` (lazy, Task 10), `*` 404.
- `ArtworkImage({ image, sizes, priority? })`: `<img srcSet sizes loading="lazy" decoding="async" width height alt>`; `null` → texto “Sin imagen”.
- Detalle: título, galería, `priceLabel`, medidas `alto × ancho unidad`, técnica, categoría, descripción (texto plano), estado, `ContactLinks` con `buildWhatsAppLink({artworkTitle, artworkUrl: env.siteUrl + '/obra/' + slug})`.
- Estados de carga y error con `toUserMessage`.

- [ ] **Step 1: Test que falla:** render de obra con título `<b>x</b>` muestra texto literal (sin elemento `b`); muestra “Vendida”; enlace WhatsApp contiene el título codificado; slug inexistente → “Obra no encontrada”.
- [ ] **Step 2:** Implementar → PASS; `npm run dev` y verificar listado/detalle contra dev con datos seed (skill `run`). Commit `feat(public): listado, filtro y detalle mínimos`.

### Task 10: Acceso admin (login, Turnstile, MFA, guardas, cierre de sesión)

**Files:**
- Create: `src/features/admin/auth/useAdminSession.ts`, `LoginPage.tsx`, `MfaPage.tsx`, `AdminGuard.tsx`, `useIdleLogout.ts`
- Test: `src/features/admin/auth/AdminGuard.test.tsx`, `useIdleLogout.test.ts`

**Interfaces:**
- `useAdminSession(): { status: 'loading' | 'anon' | 'needs-mfa-enroll' | 'needs-mfa-verify' | 'admin' | 'forbidden'; signOut(): Promise<void> }` — usa `auth.mfa.getAuthenticatorAssuranceLevel()`, `listFactors()`, y `rpc('is_admin')` para `'admin'`/`'forbidden'`.
- Login: email + contraseña + widget Turnstile (script `https://challenges.cloudflare.com/turnstile/v0/api.js`, token en `options.captchaToken`). Error siempre “Credenciales inválidas”.
- MFA: enrolar (QR `totp.qr_code` como `<img>`, código) y verificar (`challengeAndVerify`).
- `AdminGuard` redirige según status; `'forbidden'` → cierra sesión y muestra “No autorizado”.
- `useIdleLogout(minutes = 30)`: `signOut({ scope: 'local' })` tras inactividad (eventos pointer/key).
- Botón “Cerrar sesión” → `signOut({ scope: 'global' })`.

- [ ] **Step 1: Tests que fallan:** guard con cada status renderiza destino correcto; idle con timers falsos llama `signOut` a los 30 min y no antes si hay actividad.
- [ ] **Step 2:** Implementar → PASS; prueba manual en navegador con admin dev: login → enrolar → verificar → panel; usuario no admin → “No autorizado”. Commit `feat(admin): login con captcha, MFA y sesión`.

### Task 11: Panel admin mínimo (obras, imágenes, categorías)

**Files:**
- Create: `src/features/admin/ArtworksListPage.tsx`, `ArtworkFormPage.tsx`, `ArtworkImagesEditor.tsx`, `CategoriesPage.tsx`
- Test: `src/features/admin/ArtworkFormPage.test.tsx`

**Interfaces:**
- Consume la API admin de Task 8 y `uploadArtworkImage` de Task 7.
- Lista: tabla con título, categoría, publicación, disponibilidad, orden (↑/↓), acciones (editar, publicar/despublicar, marcar vendida, eliminar con confirmación en la propia UI, no `window.confirm`).
- Formulario: todos los campos de spec §6 validados con `artworkInputSchema`; slug autogenerado editable; precio/medidas opcionales.
- Imágenes: `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`, progreso por archivo, alt obligatorio, portada, ↑/↓, reemplazar, eliminar.
- Categorías: crear/editar/eliminar/ordenar; error FK → “La categoría tiene obras”.

- [ ] **Step 1: Test que falla:** enviar formulario con precio `-5` muestra error y no llama `createArtwork`; con medidas sin unidad muestra error.
- [ ] **Step 2:** Implementar → PASS. Verificación manual (skill `run` + `claude-in-chrome`): crear obra, subir 2 fotos (una JPEG 8 MB), portada, publicar, verla en `/`, reemplazar imagen, eliminar obra → confirmar en Cloudinary que la carpeta quedó vacía. Commit `feat(admin): gestión de obras, imágenes y categorías`.

### Task 12: Hosting, cabeceras, CI y keep-alive

**Files:**
- Create: `public/_headers`, `public/_redirects`, `.github/workflows/ci.yml`, `.github/workflows/keep-alive-cleanup.yml`, `scripts/check-bundle-secrets.mjs`
- Create: `docs/deploy.md` (Cloudflare Pages: build `npm run build`, output `dist`, variables; alternativa Render; dominio propio; actualizar la app; migraciones a prod con `db push`; secrets de funciones; prod auth config)

**Interfaces:**
- `_redirects`: `/* /index.html 200`.
- `_headers` para `/*`: `Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data: https://res.cloudinary.com; connect-src 'self' https://<ref>.supabase.co https://api.cloudinary.com; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`. El ref de Supabase se inyecta en build (script que genera `_headers` desde `VITE_SUPABASE_URL`).
- `check-bundle-secrets.mjs`: falla si `dist/` contiene `service_role`, el patrón JWT con `"role":"service_role"` decodificado, `CLOUDINARY_API_SECRET` o `api_secret`.
- `ci.yml`: en PR/push → `npm ci`, `npm test`, `npm run build`, `node scripts/check-bundle-secrets.mjs`.
- `keep-alive-cleanup.yml`: `cron: '0 12 */3 * *'` + `workflow_dispatch`; `curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET_DEV" $DEV_URL/functions/v1/media-cleanup` y lo mismo para prod.

- [ ] **Step 1:** Test: `npm run build && node scripts/check-bundle-secrets.mjs` → PASS; añadir temporalmente un string `service_role` a un archivo → FAIL; revertir.
- [ ] **Step 2:** Push a GitHub, CI verde; `workflow_dispatch` del keep-alive → 200 en dev.
- [ ] **Step 3:** Commit `chore: hosting, cabeceras de seguridad, CI y keep-alive`.

### Task 13: Auditoría de seguridad, despliegue a prod e informe

**Files:**
- Create: `docs/security-report.md`, `docs/stage-report.md`

- [ ] **Step 1:** Ejecutar `npm run test:security` completo en dev; `git log -p | grep -iE "service_role|api_secret|sk_"` sobre el historial → sin coincidencias reales.
- [ ] **Step 2:** Pruebas manuales: `/admin` sin sesión; login con correo distinto; 5+ intentos fallidos (ver rate limit/captcha); subir `.svg` y `.pdf` renombrado; `curl` directo a `/rest/v1/artworks` con anon key (PATCH/DELETE) → bloqueado.
- [ ] **Step 3:** Configurar prod (migraciones, auth, secrets, bootstrap admin con el correo real del propietario, que él mismo ejecuta), desplegar en Cloudflare Pages, smoke test en la URL `*.pages.dev`, verificar cabeceras con `curl -I`.
- [ ] **Step 4:** Escribir `security-report.md` (cada prueba: objetivo, método, resultado, corrección) y `stage-report.md` con los 6 puntos del requerimiento §10 (implementado, arquitectura, modelo de datos, seguridad, pruebas, pendientes).
- [ ] **Step 5:** Commit `docs: auditoría e informe de etapa`. **Detenerse y pedir autorización explícita para la etapa de diseño visual.**
