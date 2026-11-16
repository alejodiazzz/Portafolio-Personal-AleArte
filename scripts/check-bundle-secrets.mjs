#!/usr/bin/env node
// Falla si el build (dist/) contiene secretos de servidor. Uso: node scripts/check-bundle-secrets.mjs [dir]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'dist'
const PATTERNS = [
  [/service_role/i, 'referencia a service_role'],
  [/sb_secret_[A-Za-z0-9_-]+/, 'Supabase secret key'],
  [/api_secret/i, 'Cloudinary api_secret'],
  [/CLOUDINARY_API_SECRET|SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|ADMIN_EMAIL/, 'nombre de variable secreta'],
]
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g

const files = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]))
const problems = []
for (const file of files(dir)) {
  const text = readFileSync(file, 'utf8')
  for (const [re, label] of PATTERNS) if (re.test(text)) problems.push(`${file}: ${label}`)
  for (const token of text.match(JWT) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
      if (payload.role && payload.role !== 'anon') problems.push(`${file}: JWT con rol ${payload.role}`)
    } catch {}
  }
}
if (problems.length) {
  console.error('✗ Posibles secretos en el bundle:\n' + problems.map((p) => '  - ' + p).join('\n'))
  process.exit(1)
}
console.log(`✓ Sin secretos en ${dir}/`)
