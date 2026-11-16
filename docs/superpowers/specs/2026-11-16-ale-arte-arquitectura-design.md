# Ale Arte — Diseño de arquitectura (Etapa 1)

Fecha: 2026-11-16 · Estado: borrador para aprobación

## 1. Intención

Portafolio web dinámico de la marca **Ale Arte**: retratos a lápiz, acrílicos sobre lienzo, retratos de personas/familias/mascotas, murales y otros. Los visitantes exploran obras por categoría, ven su ficha (precio, medidas, técnica, descripción, disponibilidad) y contactan al artista por WhatsApp o Instagram. Un único propietario administra todo desde un panel privado, sin tocar código ni la base de datos.

Prioridades, en orden: **seguridad del panel**, **costo $0 sostenible**, mantenibilidad, rendimiento móvil.

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Contenido 100 % desde base de datos (nada de obras en el código).
- CRUD completo de obras, imágenes y categorías desde el panel.
- Autorización real en servidor/BD, no solo visual.
- Imágenes de alta calidad, servidas en WebP/AVIF y en tamaños adecuados.
- Infraestructura reproducible desde cero (migraciones + documentación).

**No-objetivos (esta etapa)**
- Diseño visual (colores, tipografía, composición, animación). Solo UI técnica mínima. **No se avanza a diseño sin autorización explícita.**
- Vista previa por obra al compartir enlaces (OG por obra): descartado, se usa SPA pura.
- Pagos, carrito, multiusuario, internacionalización.

**Anti-objetivos (sería un fracaso aunque “funcione”)**
- Que alguien sin ser el admin pueda modificar datos o imágenes por cualquier vía (API directa, JS manipulado).
- Que una secret key (Supabase service role, Cloudinary API secret) llegue al navegador o al repositorio.
- Que el sitio se caiga o genere cobros por exceder cuotas gratuitas sin aviso.

## 3. Restricciones verificadas (planes gratuitos, nov-2026)

Cifras de fuentes secundarias; reconfirmar en las páginas oficiales al crear las cuentas.

| Servicio | Límites relevantes | Riesgo | Mitigación |
|---|---|---|---|
| Supabase Free | 500 MB BD, 2 proyectos activos, 50k MAU, ~5 GB egress, 500k invocaciones Edge Functions/mes | **Pausa tras 7 días sin actividad** | Cron gratuito (GitHub Actions) cada 3 días que invoca la función de limpieza (consulta BD) |
| Cloudinary Free | 25 créditos/mes compartidos (1 crédito = 1 GB almacenamiento, 1 GB transferencia o 1.000 transformaciones); máx. 10 MB por imagen | Agotar créditos por imágenes enormes | Pre-compresión en el navegador del admin (máx. 2560 px lado mayor) y set fijo de tamaños derivados |
| Render Free (static) | Desde ago-2026 ~5 GB/mes de ancho de banda compartido por workspace | Bajo, la SPA pesa ~200–300 KB y las imágenes salen de Cloudinary | Ver §4.6: se recomienda Cloudflare Pages (sin tope práctico de ancho de banda, sin tarjeta); Render queda como alternativa soportada |

## 4. Arquitectura

### 4.1 Enfoques considerados (almacenamiento de imágenes)

| Enfoque | A favor | En contra |
|---|---|---|
| A. Supabase Storage | Un solo proveedor, RLS en Storage | 1 GB y egress compartido; sin transformaciones gratis; AVIF inviable |
| **B. Cloudinary (elegido)** | WebP/AVIF automático (`f_auto`), tamaños por URL, CDN, 25 créditos | Requiere firma server-side → Edge Function; dos proveedores |
| C. Cloudflare R2 | 10 GB, egress gratis | Exige tarjeta; sin transformaciones; también requiere firma |

El propietario eligió **B**.

Autenticación: el propietario pidió **JWT** → se usa **Supabase Auth**, que emite JWT firmados validados por PostgreSQL (RLS) y por las Edge Functions. No se implementa un emisor de tokens propio.

Frontend: **SPA** (React + TypeScript + Vite), elegido por el propietario.

### 4.2 Componentes

```
Navegador (SPA React)
 ├─ lectura pública ──────────────► Supabase PostgREST (anon key + RLS)
 ├─ login/sesión (JWT, MFA) ──────► Supabase Auth
 ├─ CRUD admin (JWT) ─────────────► Supabase PostgREST (RLS: is_admin())
 ├─ pedir firma de subida (JWT) ──► Edge Function `media-sign`
 ├─ subir imagen firmada ─────────► Cloudinary Upload API
 ├─ borrar obra/imagen (JWT) ─────► Edge Function `media-delete` ──► BD + Cloudinary Admin API
 └─ ver imágenes ─────────────────► Cloudinary CDN (f_auto,q_auto,w_N)

GitHub Actions (cron cada 3 días) ─► Edge Function `media-cleanup` (keep-alive + barrido de huérfanos)
```

Secretos solo en servidor: `CLOUDINARY_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `CRON_SECRET` viven como *secrets* de Edge Functions / GitHub Actions. En el navegador solo: URL de Supabase, anon key, cloud name de Cloudinary, WhatsApp, Instagram, site key de Turnstile (todos públicos por diseño).

### 4.3 Dependencias (mínimas)

`react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `zod` (validación). Dev: `vite`, `typescript`, `vitest`, `eslint`. Sin librería de estado/queries; hooks propios. Sin SDK de Cloudinary en el cliente (las URLs se construyen con una función de 20 líneas; la subida es un `fetch` multipart).

### 4.4 Flujo de imágenes

1. Admin elige archivos. Cliente valida **tipo real** (magic bytes: JPEG/PNG/WebP/HEIC→rechazar si no decodifica) y tamaño ≤ 15 MB de entrada.
2. Cliente reescala a máx. 2560 px de lado mayor y codifica **WebP calidad 0.9** (canvas) → asegura < 10 MB y ahorra créditos sin perder detalle visible.
3. Cliente llama `media-sign` con su JWT. La función verifica admin (§5), genera `public_id` = `ale-arte/artworks/{artwork_id}/{uuid}` y firma (`timestamp`, `public_id`, `allowed_formats=webp,jpg,png`, `max_file_size`).
4. Cliente sube directo a Cloudinary con la firma (el secreto nunca sale del servidor).
5. Cliente inserta fila en `artwork_images` (RLS admin) con `storage_path` (=public_id), `width`, `height`, `format`, `bytes`.
6. Entrega: URLs `f_auto,q_auto,c_limit,w_{400|800|1600}` en `srcset` + `sizes`, `loading="lazy"`, `decoding="async"`. Miniaturas en el listado (400/800), 1600 solo en la vista de detalle. AVIF/WebP lo decide Cloudinary según el navegador.
7. Reemplazar = subir nueva + borrar anterior vía `media-delete`.

### 4.5 Integridad y archivos huérfanos

- Borrar obra o imagen: siempre vía `media-delete` (JWT admin). Orden: borrar filas en BD → borrar recursos en Cloudinary (`delete_resources_by_prefix` para una obra). Si Cloudinary falla, la fila ya no existe y el recurso queda huérfano → lo recoge el barrido.
- `media-cleanup` (cron, autenticado con `CRON_SECRET`): lista recursos bajo `ale-arte/artworks/`, borra los que no tengan fila en `artwork_images` y tengan > 24 h (margen para subidas en curso). Además sirve de keep-alive de Supabase.
- RLS permite al admin `DELETE` directo por PostgREST; si eso deja un archivo huérfano, el barrido lo cubre. Se prefiere a bloquear DELETE (más simple, mismo resultado).

### 4.6 Hosting (elegido por el propietario)

**Cloudflare Pages** en subdominio gratuito `*.pages.dev` (dominio propio después; se documenta cómo). El origen del sitio se configura en CORS de Edge Functions, CSP, Turnstile y Redirect URLs de Supabase Auth.

Detalle: **Cloudflare Pages** (gratis, sin tarjeta, CDN, `_headers` para CSP y caché, fallback SPA con `_redirects`). Se documenta también Render Static Site (rewrite `/* → /index.html`, headers en dashboard). El código no depende del host.

## 5. Seguridad

### 5.1 Autenticación (Supabase Auth)
- Email + contraseña. **Registro público desactivado** (`Enable signups = off`). La cuenta admin se crea a mano desde el dashboard.
- **MFA TOTP obligatorio** para operar: la autorización exige `aal2` en el JWT. El panel fuerza enrolamiento en el primer login.
- **Cloudflare Turnstile** (CAPTCHA gratuito) en el login, validado por Supabase Auth; más los rate limits nativos de Auth contra fuerza bruta.
- Contraseñas: las gestiona Supabase (bcrypt); nunca se guardan en tablas propias. Política: mínimo 12 caracteres, protección contra contraseñas filtradas si el plan la ofrece.
- Sesión: tokens en almacenamiento del SDK, refresco automático, `signOut` (scope global disponible). Cierre por inactividad en cliente (30 min) como capa adicional.

### 5.2 Autorización (fuente de verdad en la BD)
- Tabla `private.app_admin(user_id uuid pk references auth.users on delete cascade)` con índice único sobre `((true))` → **máximo una fila** (un solo admin). Esquema `private` no expuesto por la API.
- Función `public.is_admin()` `security definer`, `stable`, `search_path=''`: devuelve `true` solo si `auth.uid()` está en `private.app_admin` **y** `auth.jwt()->>'aal' = 'aal2'`.
- `ADMIN_EMAIL` (variable de entorno del servidor) se usa: (a) en el script de alta del admin que inserta su `user_id`; (b) como segunda comprobación en las Edge Functions (`user.email === ADMIN_EMAIL` **y** `is_admin()`). Nunca como autorización en el frontend.
- Las rutas `/admin/*` del SPA se ocultan si no hay sesión admin, pero esto es solo UX: todo lo crítico lo bloquea RLS / las funciones.

### 5.3 RLS (habilitado y forzado en todas las tablas públicas)
| Tabla | anon / authenticated | admin (`is_admin()`) |
|---|---|---|
| categories | SELECT todo | INSERT/UPDATE/DELETE |
| artworks | sin acceso directo; leen la vista `public_artworks` (solo publicadas, precio anulado si `sold`/`commission`, columnas mínimas) | todo sobre la tabla |
| artwork_images | SELECT si su obra está publicada (vía función `security definer` `private.is_artwork_published(id)`, porque anon no puede leer `artworks`) | todo |

Además: `revoke` de privilegios innecesarios (p. ej. TRUNCATE) a `anon`/`authenticated`; sin funciones `security definer` expuestas salvo `is_admin()`.

### 5.4 Edge Functions
- Verifican JWT (`verify_jwt` + `auth.getUser(token)`), `is_admin()` vía RPC con el JWT del usuario, y `ADMIN_EMAIL`.
- Validan cuerpo con esquema; respuestas de error genéricas (`403 No autorizado`, `400 Solicitud inválida`), detalles solo en logs.
- CORS restringido al dominio del sitio (y localhost en desarrollo).

### 5.5 Navegador
- **XSS:** React escapa por defecto; prohibido `dangerouslySetInnerHTML`; descripciones como texto plano. **CSP** estricta vía cabeceras del host (`default-src 'self'`; `img-src` Cloudinary; `connect-src` Supabase + Cloudinary; `frame-src` Turnstile).
- **CSRF:** no aplica de forma clásica: la API se autentica con `Authorization: Bearer <JWT>`, no con cookies. Se documenta la razón.
- Otras cabeceras: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.
- Validación de entradas con `zod` en cliente **y** `CHECK` constraints en BD (la BD es la barrera real; PostgREST parametriza, sin SQL dinámico).

## 6. Modelo de datos

Tipos enumerados:
- `availability_status`: `available` (disponible), `sold` (vendida), `commission` (por encargo).
- `publication_status`: `draft`, `published`.
- `measurement_unit`: `cm`, `m`, `in`.

**categories**: `id uuid pk`, `name text not null unique` (1–80), `slug text not null unique` (regex `^[a-z0-9-]+$`), `description text` (≤ 1000), `display_order int default 0`, `created_at timestamptz default now()`.
Semilla: Retratos a lápiz, Pinturas acrílicas, Murales, Retratos de mascotas, Otros proyectos.

**artworks**: `id uuid pk`, `title text not null` (1–150), `slug text unique` (para URLs legibles), `description text` (≤ 5000), `price numeric(12,0) null check (price >= 0)`, `currency char(3) not null default 'COP' check (currency = 'COP')`, `height numeric(7,2) null check > 0`, `width numeric(7,2) null check > 0`, `measurement_unit null`, check “si hay medidas, hay unidad”, `technique text` (≤ 150), `category_id uuid not null references categories on delete restrict`, `creation_date date null` (fecha de la obra), `availability_status not null default 'available'`, `publication_status not null default 'draft'`, `display_order int not null default 0`, `created_at`, `updated_at` (trigger).

**artwork_images**: `id uuid pk`, `artwork_id uuid not null references artworks on delete cascade`, `storage_path text not null unique` (public_id Cloudinary), `image_alt text` (≤ 250), `width int`, `height int`, `format text`, `bytes int`, `is_cover boolean default false`, `display_order int default 0`, `created_at`. Índice único parcial: una sola portada por obra (`where is_cover`).

Índices: `artworks(publication_status, category_id, display_order)`, `artworks(display_order, created_at)`, `artwork_images(artwork_id, display_order)`.

Lectura pública: listado paginado (12 por página, `range`) seleccionando solo columnas necesarias + portada; detalle con todas las imágenes.

Migraciones en `supabase/migrations/` (Supabase CLI), reproducibles desde cero.

## 7. Contacto

`src/config/contact.ts` centraliza `VITE_WHATSAPP_NUMBER`, `VITE_INSTAGRAM_URL`. Enlace `https://wa.me/<número>?text=<mensaje codificado>`; en detalle de obra el mensaje incluye título (y slug/URL de la obra). Botones visibles en cada detalle.

**Reglas de precio (decididas por el propietario):** `available` con precio → se muestra en COP (`Intl.NumberFormat('es-CO')`); `available` sin precio → “Precio a consultar”; `sold` → “Vendida”, sin precio; `commission` → “Cotiza la tuya”, sin precio. Solo se envía al cliente lo que se muestra (la vista pública no expone el precio de obras vendidas o por encargo; se implementa con una vista `public_artworks` que anula `price` en esos casos).

## 8. Estructura del proyecto

```
/src
  /config        contacto, entorno validado con zod
  /lib           supabase client, cloudinary url builder, image processing
  /features
    /portfolio   listado, filtro por categoría, detalle
    /admin       login+MFA, obras, imágenes, categorías
  /routes        router, guardas de UX
/supabase
  /migrations    SQL
  /functions     media-sign, media-delete, media-cleanup
  seed.sql
/tests
  /security      scripts contra el proyecto de pruebas
/.github/workflows  keep-alive-cleanup.yml, ci.yml
.env.example, docs/ (setup, despliegue, seguridad)
```

## 9. Pruebas y auditoría (Etapa 4)

Se usan **dos proyectos Supabase gratuitos**: `dev/test` y `prod` (el límite gratis es 2 activos). Las pruebas de seguridad corren contra `dev/test`.

- Unitarias (Vitest): validación de archivos, constructor de URLs, esquemas zod, enlace de WhatsApp.
- Seguridad (scripts con `supabase-js` y `fetch`): anon intenta INSERT/UPDATE/DELETE en las 3 tablas; usuario no admin (creado temporalmente vía service role en test) intenta lo mismo; signup público → debe fallar; admin con `aal1` (sin MFA) → debe ser rechazado; llamadas a Edge Functions sin JWT, con JWT ajeno o manipulado; subida de archivo no permitido; lectura anon de borradores → 0 filas; búsqueda de secretos en el bundle (`dist/`) y en el repo.
- Resultados documentados en `docs/security-report.md`; vulnerabilidades corregidas antes de avanzar.

## 10. Decisiones del constructor (marcadas como tales)
- **MFA:** el admin inicia sesión (aal1) → el panel lo lleva a enrolar TOTP (QR) → verifica → aal2. Con aal1 solo ve las pantallas de MFA; RLS y funciones bloquean todo lo demás. **Recuperación** si pierde el autenticador: el propietario entra al dashboard de Supabase (protegido por su propia cuenta con 2FA) y elimina el factor; procedimiento documentado en `docs/`. Se recomienda activar 2FA también en Supabase, Cloudinary, GitHub y Cloudflare.
- **Imágenes de borradores:** las URLs de Cloudinary son públicas pero no adivinables (`public_id` con UUID). Se acepta; no se usa entrega autenticada.
- **Barrido:** volumen esperado bajo (decenas–cientos de imágenes); una llamada paginada a la Admin API por ejecución cabe en el límite gratuito.
- **Keep-alive:** el cron mantiene activos ambos proyectos (dev/test y prod), con secretos separados.
- **Slugs:** se generan del título (minúsculas, sin tildes, guiones) con sufijo numérico si chocan; editables en el panel. Rutas públicas `/obra/:slug`; renombrar no conserva el slug viejo.
- **Orden:** campo numérico + botones subir/bajar (sin drag & drop, por la restricción de UI mínima). Portada: botón “marcar como portada”.
- WebP 2560 px q0.9 como original almacenado; tamaños derivados 400/800/1600.
- MFA obligatorio (el requisito decía “evaluar”).
- Sin TanStack Query ni SDK de Cloudinary en cliente, para mantener dependencias mínimas.
- `slug` en artworks y `is_cover` en imágenes, campos añadidos al esquema pedido.

## 11. Fuera de esta etapa
Diseño visual, SEO avanzado/OG por obra, analíticas, dominio propio (se documenta cómo conectarlo).
