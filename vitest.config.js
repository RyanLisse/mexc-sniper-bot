import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      '__tests__/**/*.test.{js,ts}',
      'all-tests/vitest-unit-tests/**/*.test.{js,ts}'
    ],
    exclude: [
      'node_modules', 
      'dist', 
      '.next', 
      'coverage',
      'all-tests/e2e-tests/**/*',
      'playwright-report/**/*',
      '**/*.spec.ts',
      '**/*.spec.js',
      'test-results/**/*'
    ],
    setupFiles: ['./vitest-setup.js'],
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './'),
      '@/src': path.resolve(process.cwd(), './src'),
    },
  },
  esbuild: {
    target: 'node14'
  }
})