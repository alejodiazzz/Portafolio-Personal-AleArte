import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  test: {
    environment: 'node',
    include: ['tests/security/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), 'TEST_'),
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
}))
