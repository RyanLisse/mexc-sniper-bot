import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      }
    },
    testTimeout: 5000,
    hookTimeout: 2000,
    teardownTimeout: 2000,
    setupFiles: [],
    include: ['tests/unit/user-preferences.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'coverage',
    ],
  },
});