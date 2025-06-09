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
      'all-tests/e2e-tests/**/*.spec.ts',
      'all-tests/e2e-tests/**/*.spec.js',
      'playwright-report/**/*',
      'test-results/**/*',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.e2e.*',
      '**/e2e/**/*'
    ],
    // setupFiles: ['./vitest-setup.js'],
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