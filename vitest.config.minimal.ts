import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 5000,
    include: ['tests/unit/user-preferences.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      }
    },
    setupFiles: [],
    sequence: {
      concurrent: false,
    }
  },
});