import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
vi.mock('./LoginPage', () => ({ LoginPage: () => <p>pantalla-login</p> }))
vi.mock('./MfaPage', () => ({
  MfaEnrollPage: () => <p>pantalla-enrolar</p>,
  MfaVerifyPage: () => <p>pantalla-verificar</p>,
}))
import { AdminGuard } from './AdminGuard'
import type { AdminStatus } from './useAdminSession'

const cases: [AdminStatus, string][] = [
  ['loading', 'Cargando…'],
  ['anon', 'pantalla-login'],
  ['needs-mfa-enroll', 'pantalla-enrolar'],
  ['needs-mfa-verify', 'pantalla-verificar'],
  ['forbidden', 'No autorizado'],
  ['admin', 'contenido-privado'],
]
test.each(cases)('estado %s muestra %s', (status, text) => {
  render(<AdminGuard status={status} onChange={() => {}}><p>contenido-privado</p></AdminGuard>)
  expect(screen.getByText(text)).toBeInTheDocument()
  if (status !== 'admin') expect(screen.queryByText('contenido-privado')).toBeNull()
})
