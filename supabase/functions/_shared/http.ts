// Respuestas HTTP y CORS para Edge Functions. Mensajes de error genéricos (sin detalles internos).

const MESSAGES = {
  400: 'Solicitud inválida',
  401: 'No autorizado',
  403: 'No autorizado',
  405: 'Método no permitido',
  500: 'Ocurrió un error, intenta de nuevo',
} as const
export type FailStatus = keyof typeof MESSAGES

export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

export function corsHeaders(origin: string | null, allowed: string[] = allowedOrigins()): HeadersInit {
  const h: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin
  return h
}

export function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function fail(status: FailStatus, origin: string | null = null): Response {
  return json({ error: MESSAGES[status] }, status, origin)
}

/** Preflight y método: devuelve una Response si la petición no debe continuar. */
export function preflight(req: Request): Response | null {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return fail(405, origin)
  return null
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}
