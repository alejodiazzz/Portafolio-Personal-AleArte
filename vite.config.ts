/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
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
})
