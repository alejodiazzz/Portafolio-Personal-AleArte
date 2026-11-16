// Traduce errores a mensajes seguros para el usuario. Nunca expone el texto del servidor.

export const GENERIC_ERROR = 'Ocurrió un error, intenta de nuevo'

type Errorish = { code?: string; name?: string; status?: number; context?: { status?: number } }

export function toUserMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return GENERIC_ERROR
  const e = err as Errorish
  switch (e.code) {
    case '23503':
      return 'La categoría tiene obras'
    case '23505':
      return 'Ya existe un registro con ese nombre o URL'
    case '23514':
    case '22P02':
    case '22001':
      return 'Solicitud inválida'
    case '42501':
    case 'PGRST301':
      return 'No autorizado'
  }
  const status = e.context?.status ?? e.status
  if (status === 401 || status === 403) return 'No autorizado'
  if (status === 400) return 'Solicitud inválida'
  if (import.meta.env.DEV) console.error(err)
  return GENERIC_ERROR
}
