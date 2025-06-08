import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: [
      './all-tests/vitest-unit-tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
      './__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'
    ],
    exclude: [
      './all-tests/e2e-tests/**/*',
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    setupFiles: ['./vitest-setup.js'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/src': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './components'),
      '@/app': path.resolve(__dirname, './app'),
    },
  },
})