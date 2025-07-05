import { config } from 'dotenv';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Safe parseInt function to prevent NaN in timeout configurations
function safeParseInt(value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
    console.warn(`VITEST_CONFIG: Invalid numeric value "${value}", using fallback ${fallback}`);
    return fallback;
  }
  return parsed;
}

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load test environment variables
config({ path: '.env.test', override: true })

// Test type detection from environment
const TEST_TYPE = process.env.TEST_TYPE || 'unit';
const isCI = process.env.CI === 'true';
const isPerformanceMode = TEST_TYPE === 'performance';
const isIntegrationMode = TEST_TYPE === 'integration';
const isStabilityMode = TEST_TYPE === 'stability';
const isSupabaseMode = TEST_TYPE === 'supabase';
const isSyncMode = TEST_TYPE === 'sync';
const isE2EMode = TEST_TYPE === 'e2e';

// Database configuration
if (!process.env.DATABASE_URL) {
  if (isIntegrationMode) {
    process.env.USE_REAL_DATABASE = 'true'
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
  } else {
    process.env.USE_MOCK_DATABASE = 'true'
    process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/mexc_sniper_test'
  }
}

/**
 * Unified Vitest Configuration for MEXC Sniper Bot
 * 
 * FEATURES:
 * - Single source of truth for all test configurations
 * - Dynamic adaptation based on TEST_TYPE environment variable
 * - Optimized performance for each test scenario
 * - Comprehensive environment variable management
 * - Standardized timeout, setup, and execution patterns
 * 
 * SUPPORTED TEST TYPES:
 * - unit: Fast unit tests with React component support (default)
 * - integration: Server and API integration tests  
 * - performance: High-performance parallel execution
 * - stability: Zero-flaky-test focused configuration
 * - supabase: Supabase-specific auth and database tests
 * - sync: Single-threaded synchronous execution
 * - e2e: End-to-end workflow testing
 */

// Dynamic timeout configuration based on test type
const getTimeoutConfig = () => {
  switch (TEST_TYPE) {
    case 'performance':
      return {
        testTimeout: isCI ? 2000 : 3000,
        hookTimeout: isCI ? 3000 : 5000,
        teardownTimeout: isCI ? 3000 : 5000,
      };
    case 'integration':
      return {
        testTimeout: isCI ? 90000 : 120000,
        hookTimeout: isCI ? 60000 : 75000,
        teardownTimeout: isCI ? 40000 : 50000,
      };
    case 'stability':
      return {
        testTimeout: isCI ? 15000 : 20000,
        hookTimeout: isCI ? 20000 : 25000,
        teardownTimeout: isCI ? 20000 : 25000,
      };
    case 'supabase':
      return {
        testTimeout: 15000,
        hookTimeout: 10000,
        teardownTimeout: 10000,
      };
    case 'sync':
      return {
        testTimeout: 5000,
        hookTimeout: 5000,
        teardownTimeout: 5000,
      };
    case 'e2e':
      return {
        testTimeout: isCI ? 180000 : 240000, // 3-4 minutes for complex workflows
        hookTimeout: isCI ? 120000 : 150000, // 2-2.5 minutes for setup/teardown
        teardownTimeout: isCI ? 60000 : 90000, // 1-1.5 minutes for cleanup
      };
    default: // unit tests
      return {
        testTimeout: isCI ? 20000 : 30000,
        hookTimeout: isCI ? 30000 : 40000,
        teardownTimeout: isCI ? 30000 : 40000,
      };
  }
};

// Dynamic test discovery based on test type
const getTestIncludes = () => {
  switch (TEST_TYPE) {
    case 'integration':
      return ['tests/integration/**/*.test.{js,ts,tsx}'];
    case 'performance':
      return [
        'tests/unit/**/*.test.{js,ts,tsx}',
        'tests/integration/**/*.test.{js,ts,tsx}',
        'tests/utils/**/*.test.{js,ts,tsx}',
        'tests/components/**/*.test.{js,ts,tsx}',
        'tests/performance/**/*.test.{js,ts,tsx}',
      ];
    case 'supabase':
      return [
        'tests/unit/*supabase*.test.{js,ts}',
        'tests/integration/*supabase*.test.{js,ts}',
        'tests/unit/supabase-auth.test.ts',
        'tests/unit/supabase-database.test.ts',
        'tests/unit/supabase-api-auth.test.ts',
        'tests/integration/supabase-integration.test.ts',
      ];
    case 'sync':
      return ['tests/unit/user-preferences.test.ts'];
    case 'e2e':
      return [
        'tests/e2e/**/*.test.{js,ts,tsx}',
        'tests/integration/**/*.e2e.test.{js,ts,tsx}',
        'tests/workflows/**/*.test.{js,ts,tsx}',
      ];
    default:
      return [
        'tests/unit/**/*.test.{js,ts,tsx}',
        'tests/integration/**/*.test.{js,ts,tsx}',
        'tests/utils/**/*.test.{js,ts,tsx}',
        'tests/components/**/*.test.{js,ts,tsx}',
      ];
  }
};

// Dynamic environment selection
const getEnvironment = () => {
  if (isPerformanceMode || isIntegrationMode || isSyncMode || isE2EMode) {
    return 'node';
  }
  return 'jsdom'; // Default for React component tests
};

// Dynamic pool configuration
const getPoolConfig = () => {
  if (isSyncMode) {
    return {
      pool: 'forks' as const,
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    };
  }

  const cpuCount = cpus().length;
  
  if (isPerformanceMode) {
    return {
      pool: 'threads' as const,
      poolOptions: {
        threads: {
          maxThreads: Math.min(cpuCount, 16),
          minThreads: Math.floor(cpuCount * 0.5),
          isolate: false,
          useAtomics: true,
          execArgv: [], // Empty to avoid worker conflicts
        },
      },
    };
  }

  if (isIntegrationMode) {
    return {
      pool: 'threads' as const,
      poolOptions: {
        threads: {
          maxThreads: Math.min(2, Math.max(1, Math.floor(cpuCount / 4))),
          minThreads: 1,
          isolate: true,
          useAtomics: true,
          execArgv: ['--no-warnings'],
        },
      },
    };
  }

  if (isStabilityMode) {
    return {
      pool: 'threads' as const,
      poolOptions: {
        threads: {
          maxThreads: Math.min(4, Math.max(1, Math.floor(cpuCount * 0.5))),
          minThreads: 1,
          isolate: true,
          useAtomics: true,
          singleThread: process.env.VITEST_SINGLE_THREAD === 'true',
        },
      },
    };
  }

  if (isSupabaseMode) {
    return {
      pool: 'threads' as const,
      poolOptions: {
        threads: {
          isolate: true,
          maxThreads: isCI ? 1 : 2,
          minThreads: 1,
        },
      },
    };
  }

  if (isE2EMode) {
    return {
      pool: 'threads' as const,
      poolOptions: {
        threads: {
          maxThreads: 1, // Single thread for deterministic E2E execution
          minThreads: 1,
          isolate: true,
          useAtomics: true,
          execArgv: ['--max-old-space-size=4096'], // More memory for E2E
        },
      },
    };
  }

  // Default configuration (unit tests)
  return {
    pool: 'threads' as const,
    poolOptions: {
      threads: {
        maxThreads: Math.max(1, Math.min(4, Math.floor(cpuCount * 0.5))),
        minThreads: 1,
        isolate: true,
        useAtomics: true,
      },
    },
  };
};

// Dynamic setup files configuration
const getSetupFiles = () => {
  const baseSetup = ['./tests/setup/vitest-setup.ts'];
  
  if (isSyncMode) return [];

  if (isPerformanceMode) return []; // Minimal setup for performance mode (Node environment)

  if (isIntegrationMode) {
    return [
      ...baseSetup,
      './tests/setup/integration-setup.ts'
    ];
  }

  if (isSupabaseMode) {
    return [
      ...baseSetup,
      './tests/setup/supabase-test-setup.ts'
    ];
  }

  if (isE2EMode) {
    return [
      ...baseSetup,
      './tests/setup/e2e-setup.ts'
    ];
  }

  // Default setup for unit, stability tests
  return [
    './tests/setup/react-dom-fix.ts', // Load React DOM fix FIRST
    ...baseSetup,
    './tests/utils/test-stability-utilities.ts',
    './tests/utils/async-utilities.ts',
    './tests/setup/hook-timeout-configuration.ts',
    './tests/setup/global-timeout-elimination.ts'
  ];
};

// Dynamic environment variables
const getTestEnvironmentVars = () => {
  const baseEnv = {
    NODE_ENV: 'test' as const,
    VITEST: 'true',
    TEST_TYPE,
    DATABASE_URL: process.env.DATABASE_URL,
    ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
  };

  const mockApiKeys = {
    OPENAI_API_KEY: `test-openai-key-${TEST_TYPE}`,
    MEXC_API_KEY: `test-mexc-key-${TEST_TYPE}`,
    MEXC_SECRET_KEY: `test-mexc-secret-${TEST_TYPE}`,
    MEXC_BASE_URL: 'https://api.mexc.com',
  };

  if (isPerformanceMode) {
    return {
      ...baseEnv,
      ...mockApiKeys,
      TEST_PERFORMANCE_MODE: 'true',
      FORCE_MOCK_DB: 'true',
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
      DISABLE_SLOW_OPERATIONS: 'true',
    };
  }

  if (isIntegrationMode) {
    return {
      ...baseEnv,
      USE_REAL_DATABASE: 'true',
      FORCE_MOCK_DB: 'false',
      SKIP_AUTH_IN_TESTS: 'false',
      ENABLE_DEBUG_LOGGING: process.env.TEST_DEBUG || 'false',
      TEST_SERVER_LOGS: process.env.TEST_SERVER_LOGS || 'false',
      PORT: process.env.TEST_PORT || '3109',
      TEST_PORT: process.env.TEST_PORT || '3109',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || mockApiKeys.OPENAI_API_KEY,
      MEXC_API_KEY: process.env.MEXC_API_KEY || mockApiKeys.MEXC_API_KEY,
      MEXC_SECRET_KEY: process.env.MEXC_SECRET_KEY || mockApiKeys.MEXC_SECRET_KEY,
      MEXC_BASE_URL: mockApiKeys.MEXC_BASE_URL,
    };
  }

  if (isSupabaseMode) {
    return {
      ...baseEnv,
      ...mockApiKeys,
      SUPABASE_TEST_MODE: 'true',
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ENABLE_SUPABASE_TESTING: 'true',
      FORCE_MOCK_DB: 'false',
      SKIP_AUTH_IN_TESTS: 'false',
      ENABLE_RLS_TESTING: 'true',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3008',
      NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    };
  }

  if (isE2EMode) {
    return {
      ...baseEnv,
      USE_REAL_DATABASE: process.env.USE_REAL_DATABASE || 'false',
      FORCE_MOCK_DB: process.env.FORCE_MOCK_DB || 'true',
      SKIP_AUTH_IN_TESTS: 'false', // Allow real auth flows in E2E
      ENABLE_DEBUG_LOGGING: process.env.TEST_DEBUG || 'false',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || mockApiKeys.OPENAI_API_KEY,
      MEXC_API_KEY: process.env.MEXC_API_KEY || mockApiKeys.MEXC_API_KEY,
      MEXC_SECRET_KEY: process.env.MEXC_SECRET_KEY || mockApiKeys.MEXC_SECRET_KEY,
      MEXC_BASE_URL: mockApiKeys.MEXC_BASE_URL,
      PORT: process.env.TEST_PORT || '3010',
      TEST_PORT: process.env.TEST_PORT || '3010',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3010',
      TEST_E2E_MODE: 'true',
      ENABLE_E2E_WORKFLOWS: 'true',
      DISABLE_RATE_LIMITING: 'true',
      E2E_TIMEOUT_MULTIPLIER: '2',
    };
  }

  // Default environment (unit, stability tests)
  return {
    ...baseEnv,
    ...mockApiKeys,
    VITEST_STABILITY_MODE: isStabilityMode ? 'true' : 'false',
    ENABLE_STABILITY_MONITORING: isStabilityMode ? 'true' : 'false',
    ENABLE_TIMEOUT_MONITORING: isCI ? 'false' : 'true',
    TEST_ISOLATION_MODE: 'enhanced',
    FORCE_MOCK_DB: 'true',
    SKIP_AUTH_IN_TESTS: 'true',
    ENABLE_DEBUG_LOGGING: 'false',
    DISABLE_RATE_LIMITING: 'true',
    NODE_OPTIONS: '--max-old-space-size=4096 --expose-gc',
    UV_THREADPOOL_SIZE: '8',
    TEST_TIMING_MODE: 'stable',
    JEST_TIMEOUT: '15000',
  };
};

const timeoutConfig = getTimeoutConfig();
const poolConfig = getPoolConfig();

export default defineConfig({
  plugins: [tsconfigPaths()],
  
  // Cache directory configuration for Vitest 3.x compatibility
  cacheDir: `./node_modules/.vite-${TEST_TYPE}`,
  
  test: {
    // Dynamic environment selection
    environment: getEnvironment(),
    globals: !isSyncMode,
    
    // Enhanced jsdom options for React tests
    ...(getEnvironment() === 'jsdom' && {
      environmentOptions: {
        jsdom: {
          url: 'http://localhost:3000',
          contentType: 'text/html',
          pretendToBeVisual: true,
          includeNodeLocations: true,
          storageQuota: 10000000,
          resources: 'usable',
          runScripts: 'dangerously',
        },
      },
    }),
    
    // Dynamic test discovery
    include: getTestIncludes(),
    
    // Comprehensive exclusions
    exclude: [
      'node_modules', 
      'dist', 
      '.next', 
      'coverage',
      'build',
      'out',
      'tests/e2e/**/*',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.e2e.*',
      'playwright-report/**/*',
      'test-results/**/*',
      'test-screenshots/**/*',
      'all-tests/**/*',
      ...(isPerformanceMode ? ['**/*.slow.test.*'] : []),
      ...(isStabilityMode ? ['**/flaky-tests/**/*'] : []),
      ...(isSupabaseMode ? ['tests/unit/*kinde*.test.ts'] : []),
    ],
    
    // Dynamic timeout configuration
    ...timeoutConfig,
    
    // Dynamic retry configuration
    retry: (() => {
      if (isPerformanceMode) return 0;
      if (isIntegrationMode) return isCI ? 2 : 1;
      if (isStabilityMode) return isCI ? 2 : 1;
      if (isSupabaseMode) return isCI ? 3 : 1;
      if (isSyncMode) return 0;
      if (isE2EMode) return isCI ? 3 : 2; // Enhanced retry for flaky E2E scenarios
      return isCI ? 1 : 0;
    })(),
    
    // Dynamic coverage configuration
    coverage: {
      enabled: process.env.COVERAGE === 'true' && !isPerformanceMode && !isSyncMode,
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: `./coverage/${TEST_TYPE}`,
      ...(isSupabaseMode && {
        include: [
          'src/lib/supabase-*.ts',
          'src/db/schemas/supabase-*.ts',
          'app/api/auth/**/*.ts',
        ],
        exclude: [
          'src/**/*.test.{js,ts}',
          'src/**/*.spec.{js,ts}',
          'src/**/*.d.ts',
          'src/lib/kinde-*.ts',
        ],
        thresholds: {
          global: {
            branches: 80,
            functions: 85,
            lines: 85,
            statements: 85
          }
        }
      }),
    },
    
    // Dynamic environment variables
    env: getTestEnvironmentVars(),
    
    // Dynamic setup files
    setupFiles: getSetupFiles(),
    
    // Dynamic reporters
    reporters: (() => {
      if (isPerformanceMode) return [['default', { summary: false }]];
      if (isIntegrationMode) return [['default', { summary: true }], ['json', { outputFile: './test-results/integration-results.json' }]];
      if (isStabilityMode) return [['default', { summary: true }], ['verbose']];
      if (isSupabaseMode) return isCI ? ['github-actions', 'json', 'junit'] : ['verbose'];
      if (isSyncMode) return [['default', { summary: false }]];
      return [['default', { summary: false }]];
    })(),
    
    // Dynamic output configuration
    outputFile: (() => {
      const base = `./test-results/${TEST_TYPE}-results.json`;
      if (isIntegrationMode || isSupabaseMode) {
        return {
          json: base,
          junit: `./test-results/${TEST_TYPE}-junit.xml`,
          ...(isSupabaseMode && { html: `./test-results/${TEST_TYPE}-report.html` }),
        };
      }
      return { json: base };
    })(),
    
    // Watch mode configuration
    watch: !isCI && isSupabaseMode,
    
    // Performance and execution settings
    logHeapUsage: isStabilityMode || process.env.TEST_HEAP_USAGE === 'true',
    isolate: !isPerformanceMode && !isSyncMode,
    
    // Dynamic sequence configuration
    sequence: (() => {
      if (isPerformanceMode) {
        return {
          concurrent: true,
          shuffle: false,
          hooks: 'parallel',
          setupFiles: 'parallel',
        };
      }
      if (isIntegrationMode) {
        return {
          concurrent: false,
          shuffle: false,
          hooks: 'parallel',
          setupFiles: 'parallel',
        };
      }
      if (isStabilityMode) {
        return {
          concurrent: true,
          shuffle: false,
          hooks: 'stack',
          setupFiles: 'parallel',
        };
      }
      if (isSupabaseMode) {
        return {
          hooks: 'stack',
          setupFiles: 'list',
        };
      }
      if (isE2EMode) {
        return {
          concurrent: false, // Sequential execution for E2E
          shuffle: false, // Maintain deterministic order
          hooks: 'stack', // Sequential hook execution
          setupFiles: 'list', // Sequential setup files
        };
      }
      if (isSyncMode) {
        return {
          concurrent: false,
          shuffle: false,
        };
      }
      // Default for unit tests
      return {
        concurrent: true,
        shuffle: process.env.TEST_SHUFFLE === 'true',
        hooks: 'parallel',
        setupFiles: 'parallel',
      };
    })(),
    
    // Dynamic pool configuration
    ...poolConfig,
    
    // Dynamic concurrency settings
    maxConcurrency: (() => {
      if (isPerformanceMode) return 32;
      if (isIntegrationMode) return 2;
      if (isStabilityMode) {
        // FIXED: Ensure environment variable exists with explicit fallback
        const envValue = process.env.VITEST_MAX_CONCURRENCY;
        return safeParseInt(envValue || '4', 4);
      }
      if (isSyncMode) return 1;
      if (isE2EMode) return 1; // Single concurrency for E2E determinism
      return 8;
    })(),
    
    fileParallelism: !isIntegrationMode && !isStabilityMode && !isSyncMode && !isE2EMode && (isCI ? false : true),
    
    // Enhanced caching - using root-level cacheDir for Vitest 3.x compatibility
    
    // Benchmark configuration
    benchmark: {
      outputFile: `./test-results/${TEST_TYPE}-benchmark.json`,
      ...(isStabilityMode && { include: ['**/stability-benchmark.test.ts'] }),
    },
    
    // Reporting settings
    silent: isPerformanceMode ? false : process.env.TEST_SILENT === 'true',
    passWithNoTests: !isIntegrationMode,
    
    // Performance-specific options (diff disabled to avoid file not found errors)
    // ...(isPerformanceMode && {
    //   diff: './test-results/performance-diff.json',
    // }),
  },
  
  // Build configuration
  esbuild: {
    target: 'node18',
    sourcemap: !isPerformanceMode,
    jsx: 'automatic',
    jsxImportSource: 'react',
    ...(isStabilityMode && { keepNames: true }),
  },
  
  // Dynamic global constants
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false,
    __PERFORMANCE_MODE__: isPerformanceMode,
    __INTEGRATION_TEST__: isIntegrationMode,
    __STABILITY_MODE__: isStabilityMode,
    __SUPABASE_TEST__: isSupabaseMode,
    __E2E_TEST__: isE2EMode,
    global: 'globalThis',
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/db': path.resolve(__dirname, './src/db'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@tests': path.resolve(__dirname, './tests'),
      '@utils': path.resolve(__dirname, './tests/utils')
    }
  },
  
  // Conditional optimizations
  ...(isPerformanceMode && {
    optimizeDeps: {
      include: ['vitest', '@testing-library/react', 'jsdom'],
      exclude: ['playwright', '@playwright/test'],
    },
  }),
  
  // Server configuration for specific test types
  ...(isIntegrationMode && {
    server: {
      port: 5173,
      strictPort: false,
      fs: {
        allow: ['..', '.']
      }
    }
  }),
  
  ...(isStabilityMode && {
    server: {
      hmr: false,
      watch: null,
    }
  }),
});