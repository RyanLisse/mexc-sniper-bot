import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/unit/**/*.test.{js,ts}',
      'tests/integration/**/*.test.{js,ts}'
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
    env: {
      OPENAI_API_KEY: 'test-openai-key',
      MEXC_API_KEY: 'test-mexc-key',
      MEXC_SECRET_KEY: 'test-mexc-secret',
      MEXC_BASE_URL: 'https://api.mexc.com',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n'
    },
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