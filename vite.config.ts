/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/** Genera dist/_headers (Cloudflare Pages) con CSP ajustada al proyecto de Supabase. */
export function securityHeaders(supabaseUrl: string): string {
  const supabase = new URL(supabaseUrl).origin
  const realtime = supabase.replace(/^http/, 'ws') // wss:// en producción (Realtime de subastas)
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "img-src 'self' data: https://res.cloudinary.com",
    `connect-src 'self' ${supabase} ${realtime} https://api.cloudinary.com`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
  return `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache
`
}

function headersPlugin(supabaseUrl: string | undefined): Plugin {
  return {
    name: 'ale-arte-security-headers',
    apply: 'build',
    generateBundle() {
      if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL es obligatorio para generar _headers')
      this.emitFile({ type: 'asset', fileName: '_headers', source: securityHeaders(supabaseUrl) })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), headersPlugin(env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)],
    // Las fuentes pequeñas (<4 KB) se incrustaban como data: y la CSP (font-src 'self') las bloqueaba.
    build: { assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.ts'],
      setupFiles: ['./src/test-setup.ts'],
      env: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        VITE_CLOUDINARY_CLOUD_NAME: 'demo',
        VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
        VITE_WHATSAPP_NUMBER: '573001234567',
        VITE_INSTAGRAM_URL: 'https://instagram.com/alearte',
        VITE_SITE_URL: 'http://localhost:5173',
      },
    },
  }
})
