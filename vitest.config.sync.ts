import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 5000,
    include: ['tests/unit/user-preferences.test.ts'],
    // Disable all threading and worker functionality for Bun
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    isolate: false,
    setupFiles: [],
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    // Force single process execution
    maxConcurrency: 1,
    // Disable file parallelization
    fileParallelism: false,
  },
});