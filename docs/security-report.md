# Informe de auditoría de seguridad — Ale Arte

Fecha: 2026-11-16 · Entorno probado: Supabase **local** (Docker, misma versión de Postgres/Auth/PostgREST que la nube) · Rama `feat/etapas-2-5`

Las pruebas automáticas viven en `tests/security/` (`npm run test:security`) y en las pruebas unitarias (`npm test`). Cada control se verificó también en **rojo**: se desactivó a propósito y se comprobó que la prueba fallaba.

## Resumen

| # | Prueba | Método | Resultado |
|---|---|---|---|
| 1 | Acceso anónimo al panel `/admin` | La SPA muestra el login; toda operación la valida la BD y las funciones | ✅ Sin datos ni operaciones sin sesión admin |
| 2 | Login con correo distinto al autorizado | Usuario válido no admin (con y sin MFA) → CRUD y funciones | ✅ `is_admin=false`, escrituras rechazadas, funciones → 403 |
| 3 | Registro de nuevos usuarios | `auth.signUp` y `POST /auth/v1/signup` | ✅ `signup_disabled` (422) |
| 4 | Acceso directo a rutas admin | Ver 1: la ruta es solo UX; la protección está en RLS | ✅ |
| 5 | Modificar obras sin autorización | `PATCH /rest/v1/artworks` anónimo y como usuario no admin | ✅ 401 / 0 filas; datos intactos (verificado por SQL) |
| 6 | Eliminar registros sin autorización | `DELETE` en las 3 tablas, anónimo y no admin; `media-delete` como no admin | ✅ Bloqueado; filas intactas |
| 7 | Acceso directo a endpoints de Supabase | Esquema `private` por API, RPC a funciones privadas, lectura de `price` | ✅ `PGRST106`, `PGRST202`, `42501` |
| 8 | Archivos no permitidos | PDF, EXE, SVG, WAV renombrados como imagen; > 15 MB | ✅ Rechazados por *magic bytes* antes de subir; Cloudinary además restringe `allowed_formats` en la firma |
| 9 | Manipulación de solicitudes HTTP | JWT con `aal` alterado sin re-firmar; token basura; `artworkId` con `../` | ✅ 401 / 400 |
| 10 | Exposición de claves | `check:secrets` sobre `dist/` (patrones + decodificación de JWT); búsqueda en historial git | ✅ Sin secretos; `.env*.local` y `supabase/functions/.env` ignorados |
| 11 | Políticas RLS | 23 pruebas: anónimo, no admin, admin aal1, admin aal2, borradores, precios ocultos, FK, admin único | ✅ |
| 12 | Sesiones | Admin sin MFA (aal1) sin privilegios; token tras cerrar sesión; cierre por inactividad (30 min) | ✅ (ver hallazgo H1) |
| 13 | Linter de seguridad de Supabase (`db advisors`) | | ✅ 0 errores, 0 advertencias (1 aviso informativo intencional) |

Totales: **unitarias 93/93**, **seguridad 43 pasan, 3 omitidas** (requieren credenciales reales de Cloudinary).

## Hallazgos y correcciones

**H1 — Token válido después de cerrar sesión (corregido).** Los JWT de Supabase siguen vigentes hasta que expiran (1 h por defecto) aunque se cierre sesión. Corrección: `private.is_admin()` exige además que la sesión del token (`session_id`) siga existiendo en `auth.sessions` (migración `admin_session_check`). Prueba: `tras cerrar sesión, el token anterior ya no da acceso de admin` (RED→GREEN).

**H2 — Vista con privilegios de su dueño (corregido en diseño).** La vista pública inicial (`security definer`) era segura, pero el linter de Supabase la marca como ERROR. Se reemplazó por `security_invoker` + columna calculada `public_price` + permisos por columna: el visitante nunca puede pedir `price`.

**H3 — CORS local con comodín (no aplica a producción).** El gateway local de Supabase responde `Access-Control-Allow-Origin: *` por su cuenta. Las funciones solo permiten los orígenes de `ALLOWED_ORIGINS` (probado con tests unitarios). Hay que verificarlo en la nube (pendiente P3). CORS no es una barrera de autenticación: la protección es el JWT.

## Mecanismos de seguridad (defensa en profundidad)

1. **Registro deshabilitado** y contraseña ≥ 12 con mayúsculas, minúsculas y dígitos.
2. **MFA TOTP obligatorio**: sin `aal2` la BD no concede nada.
3. **CAPTCHA Turnstile** en el login, validado por Supabase Auth, y límites de solicitudes nativos de Auth.
4. **Autorización en PostgreSQL**: RLS forzado en todas las tablas; `private.is_admin()` = usuario en `private.app_admin` (máx. 1 fila) + `aal2` + sesión viva.
5. **Edge Functions** con triple control: JWT válido según Auth, correo = `ADMIN_EMAIL` (secreto de servidor) e `is_admin()`. Los errores son genéricos.
6. **Secretos solo en el servidor** (Cloudinary, service role, cron). El navegador solo recibe valores públicos y `check:secrets` lo verifica en CI.
7. **Subidas firmadas** con ruta (`public_id`) y formatos fijados por el servidor.
8. **XSS**: React escapa todo; no se usa `dangerouslySetInnerHTML`; CSP estricta sin `unsafe-inline` en scripts.
9. **CSRF**: no aplica en su forma clásica. La API se autentica con `Authorization: Bearer`, no con cookies, así que un sitio ajeno no puede enviar peticiones autenticadas en nombre del admin.
10. **Cabeceras**: HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`.
11. **Validación doble**: zod en el cliente y restricciones `CHECK`/FK/únicas en la BD, que es la barrera real.
12. **Sesión**: cierre por inactividad a los 30 min y "Cerrar sesión" global, que revoca las sesiones (y con H1, también el acceso inmediato).

## Pendiente de verificar en la nube (requiere las cuentas del propietario)

- ~~P1. Flujo real con Cloudinary~~ ✅ 2026-11-16: 46/46 pruebas (subida firmada, borrado de obra + recurso, firma manipulada rechazada, barrido). `media-cleanup` en prod → `{"checked":0,"deleted":0}`.
- ~~P2. Turnstile en el login~~ ✅ prod: login sin token → `captcha_failed`; login real del admin con CAPTCHA + MFA TOTP completado.
- P3. ~~CORS de las funciones~~ ✅ verificado en prod (origen ajeno sin cabecera; `ale-arte.pages.dev` permitido). Cabeceras verificadas en producción (Workers): CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`.
- P4. ~~`db advisors` en prod~~ ✅ sin errores ni advertencias. Registro deshabilitado y escritura anónima bloqueada verificados en prod.
- P5. Rate limit de Auth tras varios intentos fallidos.

## Riesgos residuales

- Quien controle la cuenta de Supabase, Cloudinary, Cloudflare o GitHub controla el sitio: **activar 2FA en todas**.
- Las imágenes de obras en borrador tienen URL pública no adivinable (UUID). Es aceptable para este caso.
- En local, PostgREST todavía sirve el esquema OpenAPI con la clave pública; en la nube esto ya está deshabilitado desde feb-2026. Además, el esquema solo revela nombres de tablas y columnas, no datos.
- Planes gratuitos: los límites pueden cambiar. El keep-alive evita la pausa de Supabase y el barrido controla el almacenamiento en Cloudinary.

## Verificación de punta a punta en producción (2026-11-16)

El propietario completó el flujo real en `portafolio-personal-alearte.diaza-alejandro123.workers.dev`: login con CAPTCHA, enrolamiento TOTP, creación de obra, subida de imagen, portada y publicación. Comprobado desde la BD y Cloudinary:

- 1 obra publicada, 1 imagen (WebP 1440×2560, 508 KB) con portada; 1 factor MFA verificado del único admin.
- Cloudinary: 1 recurso, coincide con la BD, sin huérfanos.
- Lectura anónima de `public_artworks`: la obra "por encargo" llega con `price: null`. Lectura anónima de `artworks.price` → `42501`.
