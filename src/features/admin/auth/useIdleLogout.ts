import { useEffect, useRef } from 'react'

const EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

/** Ejecuta onIdle tras `minutes` sin actividad del usuario. */
export function useIdleLogout(onIdle: () => void, minutes = 30, enabled = true) {
  const cb = useRef(onIdle)
  cb.current = onIdle
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => cb.current(), minutes * 60 * 1000)
    }
    reset()
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [minutes, enabled])
}
