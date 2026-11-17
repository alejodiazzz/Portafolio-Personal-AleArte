import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// Bajo carga (suite completa en paralelo) la primera carga de un archivo pesado puede pasar de 1 s.
import { configure } from '@testing-library/react'
configure({ asyncUtilTimeout: 4000 })
