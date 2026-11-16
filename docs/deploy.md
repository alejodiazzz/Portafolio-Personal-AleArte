# Despliegue de Ale Arte

Arquitectura: SPA estática (Cloudflare Pages) + Supabase (BD, Auth, Edge Functions) + Cloudinary (imágenes) + GitHub Actions (CI y keep-alive). Todo en planes gratuitos.

## 0. Requisitos locales

- Node 24+, npm, Git. Docker Desktop (solo para el entorno local de Supabase y las pruebas de seguridad).
- `npm ci` instala todo, incluida la CLI de Supabase (`npx supabase …`).
- `npx supabase login`: inicia sesión en la CLI (una vez por equipo).

## 1. Variables y secretos

| Dónde | Variable | Ejemplo / origen | ¿Secreta? |
|---|---|---|---|
| Cloudflare Pages (build) | `VITE_SUPABASE_URL` | Supabase → Project Settings → API | No |
| | `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → *publishable* | No |
| | `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary → Dashboard | No |
| | `VITE_TURNSTILE_SITE_KEY` | Cloudflare → Turnstile → site key | No |
| | `VITE_WHATSAPP_NUMBER` | `573001234567` (sin `+`) | No |
| | `VITE_INSTAGRAM_URL` | `https://instagram.com/…` | No |
| | `VITE_SITE_URL` | `https://<proyecto>.pages.dev` | No |
| | `NODE_VERSION` | `24` | No |
| Supabase Edge Functions (`npx supabase secrets set`) | `ADMIN_EMAIL` | correo del propietario | **Sí** |
| | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary → API Keys | **Sí** (secret) |
| | `CRON_SECRET` | cadena aleatoria ≥ 32 caracteres (`openssl rand -hex 32`) | **Sí** |
| | `ALLOWED_ORIGINS` | `https://<proyecto>.pages.dev` (separar con comas) | No |
| GitHub → Settings → Secrets → Actions | `SUPABASE_URL_DEV`, `SUPABASE_URL_PROD` | URLs de los proyectos | No |
| | `CRON_SECRET_DEV`, `CRON_SECRET_PROD` | los mismos `CRON_SECRET` | **Sí** |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente en las funciones. **Nunca** pongas secretos con prefijo `VITE_`: todo lo `VITE_*` termina en el navegador. `npm run check:secrets` lo verifica tras cada build.

## 2. Supabase (repetir para dev y prod)

```bash
npx supabase link --project-ref <ref>
npx supabase db push                        # aplica supabase/migrations (esquema, RLS, categorías)
npx supabase secrets set ADMIN_EMAIL=… CLOUDINARY_CLOUD_NAME=… CLOUDINARY_API_KEY=… \
  CLOUDINARY_API_SECRET=… CRON_SECRET=… ALLOWED_ORIGINS=https://<proyecto>.pages.dev
npx supabase functions deploy media-sign --no-verify-jwt
npx supabase functions deploy media-delete --no-verify-jwt
npx supabase functions deploy media-cleanup --no-verify-jwt
npx supabase db advisors --linked --type security   # sin errores
```

`--no-verify-jwt`: cada función verifica el token por su cuenta (correo admin + MFA + `is_admin()`, o `x-cron-secret`).

Después configura Auth y crea el administrador según [setup-auth.md](setup-auth.md).

## 3. Cloudinary

1. Crea la cuenta gratuita y copia *cloud name*, *API key* y *API secret*.
2. Settings → Security: activa **“Strict transformations”** solo si notas abuso. Los tamaños 400/800/1600 del sitio se generan bajo demanda y quedan en caché.
3. Las imágenes viven en la carpeta `ale-arte/artworks/<id-obra>/`.

## 4. Cloudflare (Workers con archivos estáticos — configuración actual)

El proyecto se despliega como **Worker** `portafolio-personal-alearte` (Workers Builds conectado a GitHub, rama `main`):

- `wrangler.jsonc` define el Worker: sirve `dist/` y activa `not_found_handling: "single-page-application"` (rutas `/obra/...` y `/admin/...` → `index.html`). **No** usar `_redirects` con `/* /index.html 200`: Workers lo rechaza como bucle.
- `dist/_headers` (CSP, HSTS, caché) se genera en el build y Workers lo aplica.
- Build command `npm run build`; deploy command `npx wrangler deploy`.
- Variables `VITE_*` y `NODE_VERSION` en **Settings → Build → Build variables and secrets** (no en las variables de runtime, que Vite no ve).

### Alternativa: Cloudflare Pages

1. Workers & Pages → Create → Pages → conecta el repositorio de GitHub.
2. Framework preset: *None* (o Vite). Build command: `npm run build`. Output: `dist`.
3. Variables de entorno de la sección 1 (Production y Preview).
4. Despliega. `dist/_headers` (CSP y caché) se genera en el build. Para rutas de la SPA en Pages crea `public/_redirects` con `/* /index.html 200`.
5. Turnstile: añade el dominio `<proyecto>.pages.dev` (y tu dominio propio) al widget.
6. Supabase Auth → URL Configuration: Site URL y Redirect URLs = URL del sitio.

### Dominio propio (opcional)

Pages → Custom domains → añade el dominio. Luego actualiza `VITE_SITE_URL`, `ALLOWED_ORIGINS`, los dominios de Turnstile y la Site URL de Supabase Auth, y vuelve a desplegar.

### Alternativa: Render Static Site

Build `npm run build`, publish `dist`. En *Redirects/Rewrites* añade `/*` → `/index.html` (Rewrite). En *Headers* copia los valores de `dist/_headers`. Ojo: el plan gratuito de Render tiene ~5 GB/mes de ancho de banda.

## 5. GitHub Actions

- `ci.yml`: en cada push/PR → tests, build, verificación de secretos.
- `keep-alive-cleanup.yml`: cada 3 días invoca `media-cleanup` en dev y prod. Ejecuta *Run workflow* una vez para comprobarlo (debe responder `{"checked":…,"deleted":…}`).

## 6. Actualizar la aplicación

> **Nunca uses las credenciales de Cloudinary de producción en local.** La prueba de `media-cleanup` borra de Cloudinary toda imagen (> 24 h) que no esté en la BD *local*: con la cuenta de producción borraría las fotos reales. En local, `supabase/functions/.env` lleva valores ficticios y las 3 pruebas reales de Cloudinary quedan omitidas. Para ejecutarlas, crea una **cuenta gratuita de Cloudinary aparte** solo para pruebas y pon sus claves en `supabase/functions/.env` y `TEST_CLOUDINARY_*`.

1. Trabaja en una rama, `npm test`, `npm run test:security` (con Supabase local: `npx supabase start` + `npx supabase functions serve --env-file supabase/functions/.env`).
2. Cambios de BD: `npx supabase migration new <nombre>`, probar con `npx supabase db reset`, luego `db push` a dev y después a prod.
3. Merge a `main` → Cloudflare Pages despliega solo. Funciones: `npx supabase functions deploy <nombre> --no-verify-jwt`.

## 7. Verificación de producción

```bash
curl -sI https://<proyecto>.pages.dev | grep -iE "content-security|x-frame|strict-transport"
curl -s -X PATCH "$SUPABASE_URL/rest/v1/artworks?id=not.is.null" -H "apikey: $PUBLISHABLE" \
  -H "Content-Type: application/json" -d '{"title":"x"}'   # debe fallar o afectar 0 filas
```
