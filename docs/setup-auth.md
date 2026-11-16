# Configuración de autenticación y del administrador

Aplica a cada proyecto de Supabase (dev y prod). En local, `supabase/config.toml` ya trae esta configuración.

## 1. Ajustes de Auth (Dashboard → Authentication)

| Ajuste | Valor |
|---|---|
| Sign In / Providers → **Allow new users to sign up** | **Desactivado** |
| Email provider | Activado (correo + contraseña) |
| Confirm email | Activado |
| Password → longitud mínima | **12** |
| Password → requisitos | Minúsculas, mayúsculas y dígitos |
| Leaked password protection | Activar si el plan lo permite (si no, ignorar) |
| Multi-Factor → **TOTP** | **Enabled** (enroll + verify) |
| Attack Protection → **CAPTCHA** | Activado, proveedor **Turnstile**, pegar la *secret key* de Cloudflare |
| Rate limits | Dejar los valores por defecto (protegen contra fuerza bruta) |
| URL Configuration → Site URL | `https://<tu-sitio>.pages.dev` (dev: `http://localhost:5173`) |
| URL Configuration → Redirect URLs | La misma URL del sitio |

> En el proyecto **dev** puedes usar las claves de prueba oficiales de Turnstile (siempre aprueban):
> site key `1x00000000000000000000AA`, secret key `1x0000000000000000000000000000000AA`. **Nunca en prod.**

## 2. Crear la cuenta del administrador

1. Dashboard → Authentication → Users → **Add user → Create new user**.
2. Correo: el correo personal del propietario. Contraseña: larga y única (gestor de contraseñas). Marca *Auto Confirm User*.
3. Dashboard → SQL Editor → ejecuta (cambia el correo):

```sql
insert into private.app_admin (user_id)
select id from auth.users where lower(email) = lower('CORREO-DEL-PROPIETARIO@dominio.com');
-- Debe decir "INSERT 0 1". Si dice 0, el correo no coincide.
-- Si falla por "app_admin_singleton", ya existe un administrador.
```

Con `psql`: `psql "$DB_URL" -v admin_email='correo@dominio.com' -f scripts/bootstrap-admin.sql`.

4. Configura el secret `ADMIN_EMAIL` de las Edge Functions con **el mismo correo** (ver `docs/deploy.md`).
5. Abre `/admin` en el sitio: inicia sesión → el panel te pedirá **escanear el código QR** con una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password, Aegis…) → ingresa el código. Desde ahí cada inicio de sesión pedirá contraseña + código.

Hasta completar el código (nivel `aal2`), la base de datos rechaza cualquier operación administrativa.

## 3. Recuperación si pierdes el autenticador

1. Entra al dashboard de Supabase (protegido por tu cuenta de Supabase **con su propio 2FA**).
2. Authentication → Users → tu usuario → **Factors / MFA** → elimina el factor TOTP.
   Alternativa por SQL Editor: `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'tu-correo');`
3. Inicia sesión en `/admin` y vuelve a enrolar un autenticador.

Recomendación: guarda el QR/secreto inicial en tu gestor de contraseñas como respaldo.

## 4. Cambiar de administrador

```sql
delete from private.app_admin;
-- luego repetir el paso 2.3 con el nuevo correo, y actualizar el secret ADMIN_EMAIL
```

## 5. Endurecer cuentas externas

Activa 2FA en Supabase, Cloudinary, Cloudflare y GitHub: quien controle esas cuentas controla el sitio.
