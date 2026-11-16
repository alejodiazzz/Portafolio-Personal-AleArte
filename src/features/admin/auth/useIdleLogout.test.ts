import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useIdleLogout } from './useIdleLogout'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('llama onIdle a los 30 minutos sin actividad', () => {
  const onIdle = vi.fn()
  renderHook(() => useIdleLogout(onIdle))
  vi.advanceTimersByTime(30 * 60 * 1000 - 1)
  expect(onIdle).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(onIdle).toHaveBeenCalledTimes(1)
})
test('la actividad reinicia el contador', () => {
  const onIdle = vi.fn()
  renderHook(() => useIdleLogout(onIdle))
  vi.advanceTimersByTime(29 * 60 * 1000)
  window.dispatchEvent(new Event('keydown'))
  vi.advanceTimersByTime(29 * 60 * 1000)
  expect(onIdle).not.toHaveBeenCalled()
})
test('desactivado no programa nada', () => {
  const onIdle = vi.fn()
  renderHook(() => useIdleLogout(onIdle, 30, false))
  vi.advanceTimersByTime(60 * 60 * 1000)
  expect(onIdle).not.toHaveBeenCalled()
})
