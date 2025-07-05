import { config } from 'dotenv';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load test environment variables
config({ path: '.env.test', override: true })

// System performance detection
const systemInfo = {
  cpuCores: cpus().length,
  totalMemory: process.env.NODE_ENV === 'test' ? 8 * 1024 * 1024 * 1024 : 16 * 1024 * 1024 * 1024, // 8GB test, 16GB prod
  isCI: process.env.CI === 'true',
  isDocker: process.env.DOCKER === 'true',
  nodeVersion: process.version,
}

// Performance mode detection
const PERF_MODE = process.env.PERF_MODE || 'standard'; // 'ultra', 'standard', 'fast'
const isUltraMode = PERF_MODE === 'ultra';
const isFastMode = PERF_MODE === 'fast';

// Intelligent performance calculations
const performanceConfig = {
  // Thread allocation based on performance mode
  maxThreads: (() => {
    if (isUltraMode) return Math.min(systemInfo.cpuCores, 16);
    if (isFastMode) return systemInfo.cpuCores * 2;
    return Math.max(2, Math.min(systemInfo.cpuCores - 1, Math.floor(systemInfo.cpuCores * 0.75)));
  })(),
  
  minThreads: Math.max(1, Math.floor(systemInfo.cpuCores * 0.25)),
  
  // Memory thresholds based on system memory and performance mode
  memoryLimitPerWorker: (() => {
    const baseLimit = Math.floor(systemInfo.totalMemory / systemInfo.cpuCores / 1024 / 1024);
    if (isUltraMode) return Math.min(baseLimit, 2048); // 2GB max for ultra mode
    if (isFastMode) return Math.min(baseLimit, 1024); // 1GB for fast mode
    return Math.min(baseLimit, 1536); // 1.5GB for standard
  })(),
  
  memoryRecycleThreshold: (() => {
    if (isUltraMode) return Math.floor(systemInfo.totalMemory * 0.7 / 1024 / 1024);
    if (isFastMode) return Math.floor(systemInfo.totalMemory * 0.5 / 1024 / 1024);
    return Math.floor(systemInfo.totalMemory * 0.6 / 1024 / 1024);
  })(),
  
  // Timeout configuration based on performance mode
  baseTimeout: (() => {
    if (isUltraMode) return systemInfo.isCI ? 800 : 1200; // Ultra-fast timeouts
    if (isFastMode) return systemInfo.isCI ? 1500 : 2000; // Fast timeouts
    return systemInfo.isCI ? 2000 : 3000; // Standard performance timeouts
  })(),
  
  hookTimeout: (() => {
    if (isUltraMode) return systemInfo.isCI ? 1000 : 1500;
    if (isFastMode) return systemInfo.isCI ? 2000 : 3000;
    return systemInfo.isCI ? 3000 : 5000;
  })(),
  
  teardownTimeout: (() => {
    if (isUltraMode) return systemInfo.isCI ? 500 : 1000;
    if (isFastMode) return systemInfo.isCI ? 1500 : 2000;
    return systemInfo.isCI ? 3000 : 5000;
  })(),
  
  // Concurrency based on system capabilities and performance mode
  maxConcurrency: (() => {
    if (isUltraMode) return systemInfo.cpuCores * 4;
    if (isFastMode) return systemInfo.cpuCores * 3;
    return Math.min(32, systemInfo.cpuCores * 2);
  })(),
}

console.log(`🚀 PERFORMANCE MODE: ${PERF_MODE.toUpperCase()}`)
console.log(`💻 System: ${systemInfo.cpuCores} cores, ${Math.round(systemInfo.totalMemory / 1024 / 1024 / 1024)}GB RAM`)
console.log(`⚡ Threads: ${performanceConfig.minThreads}-${performanceConfig.maxThreads} (${Math.round(performanceConfig.maxThreads / systemInfo.cpuCores * 100)}% utilization)`)
console.log(`🧠 Memory: ${performanceConfig.memoryLimitPerWorker}MB per worker, ${performanceConfig.memoryRecycleThreshold}MB recycle threshold`)
console.log(`⏱️  Timeouts: ${performanceConfig.baseTimeout}ms base, max concurrency: ${performanceConfig.maxConcurrency}`)

/**
 * High-Performance Vitest Configuration for MEXC Sniper Bot
 * 
 * PERFORMANCE MODES:
 * - ultra: Maximum speed, minimal isolation, highest resource utilization
 * - fast: Balanced speed and stability, aggressive parallelization
 * - standard: Optimized performance with reliability (default)
 * 
 * FEATURES:
 * - Intelligent CPU and memory utilization
 * - Dynamic performance tuning based on system capabilities
 * - Aggressive parallel execution strategies
 * - Fast-fail timeout optimization
 * - Enhanced caching with intelligent invalidation
 * - Memory pressure monitoring and auto-cleanup
 * 
 * USAGE:
 * - PERF_MODE=ultra vitest run --config=vitest.config.performance.ts
 * - PERF_MODE=fast vitest run --config=vitest.config.performance.ts
 * - vitest run --config=vitest.config.performance.ts (standard mode)
 */

export default defineConfig({
  plugins: [tsconfigPaths()],
  
  // Use modern cache directory
  cacheDir: `./node_modules/.vite-performance-${PERF_MODE}`,
  
  test: {
    // Node environment for maximum performance (no DOM overhead)
    environment: 'node',
    globals: true,
    
    // Performance-focused test discovery
    include: [
      'tests/unit/**/*.test.{js,ts,tsx}',
      'tests/integration/**/*.test.{js,ts,tsx}',
      'tests/utils/**/*.test.{js,ts,tsx}',
      'tests/components/**/*.test.{js,ts,tsx}',
      'tests/performance/**/*.test.{js,ts,tsx}',
      ...(isUltraMode ? [] : ['tests/components/**/*.test.{js,ts,tsx}']), // Skip React components in ultra mode
    ],
    
    // Comprehensive exclusions for performance
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
      '**/*.slow.test.*', // Always exclude slow tests in performance mode
      '**/*.stress.test.*', // Exclude stress tests
      ...(isUltraMode ? ['**/*.benchmark.test.*'] : []), // Exclude benchmarks in ultra mode
      ...(isFastMode ? ['**/flaky-tests/**/*'] : []), // Exclude flaky tests in fast mode
    ],
    
    // Performance-optimized timeouts
    testTimeout: performanceConfig.baseTimeout,
    hookTimeout: performanceConfig.hookTimeout,
    teardownTimeout: performanceConfig.teardownTimeout,
    
    // No retries in performance mode for speed
    retry: isUltraMode ? 0 : 0,
    
    // Disable coverage for maximum performance
    coverage: {
      provider: 'v8',
      enabled: false,
    },
    
    // Performance environment variables
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      TEST_TYPE: 'performance',
      TEST_PERFORMANCE_MODE: 'true',
      PERF_MODE,
      
      // Performance optimizations
      UV_THREADPOOL_SIZE: String(performanceConfig.maxThreads + 4),
      NODE_OPTIONS: `--max-old-space-size=${performanceConfig.memoryRecycleThreshold}`,
      
      // Force all mocks for speed
      FORCE_MOCK_DB: 'true',
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
      DISABLE_SLOW_OPERATIONS: 'true',
      DISABLE_RATE_LIMITING: 'true',
      DISABLE_ANALYTICS: 'true',
      DISABLE_TELEMETRY: 'true',
      
      // Ultra-performance flags
      ...(isUltraMode && {
        SKIP_NETWORK_CALLS: 'true',
        SKIP_FILE_OPERATIONS: 'true',
        SKIP_DATABASE_OPERATIONS: 'true',
        TEST_ULTRA_PERFORMANCE: 'true',
      }),
      
      // Fast mode flags
      ...(isFastMode && {
        TEST_FAST_MODE: 'true',
        VITEST_SEGFAULT_RETRY: '0',
      }),
      
      // Mock API keys for performance
      OPENAI_API_KEY: 'test-key-performance',
      MEXC_API_KEY: 'test-key-performance',
      MEXC_SECRET_KEY: 'test-secret-performance',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/mexc_sniper_test',
    },
    
    // Minimal setup files based on performance mode
    setupFiles: (() => {
      if (isUltraMode) return []; // No setup files for ultra mode
      if (isFastMode) return []; // Minimal setup for fast mode
      return [
        './tests/setup/vitest-setup.ts',
        './tests/utils/async-test-helpers.ts',
      ];
    })(),
    
    // Fast reporting based on performance mode
    reporters: (() => {
      if (isUltraMode) return [['default', { summary: false }]];
      if (isFastMode) return [['default', { summary: false }]];
      return [['default', { summary: true }]];
    })(),
    
    // Performance output
    outputFile: {
      json: `./test-results/performance-${PERF_MODE}-results.json`,
    },
    
    // Disable watch mode
    watch: false,
    
    // Maximum performance settings
    logHeapUsage: false, // Disable for speed
    isolate: isUltraMode ? false : false, // Disable isolation for maximum speed
    
    // Optimized sequence configuration
    sequence: {
      concurrent: true,
      shuffle: false, // Disable shuffling for speed
      hooks: 'parallel',
      setupFiles: 'parallel',
    },
    
    // Maximum parallelization with optimized worker management
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: performanceConfig.maxThreads,
        minThreads: performanceConfig.minThreads,
        
        // Performance optimizations based on mode
        isolate: isUltraMode ? false : false, // Disable for maximum speed
        useAtomics: true, // Enable atomic operations for speed
        singleThread: false, // Enable multi-threading
        
        // Optimized memory management
        execArgv: [], // Empty to avoid conflicts
        maxMemoryLimitBeforeRecycle: performanceConfig.memoryRecycleThreshold * 1024 * 1024,
        memoryLimit: performanceConfig.memoryLimitPerWorker * 1024 * 1024,
        
        // Worker optimization based on performance mode
        terminateTimeout: isUltraMode ? 1000 : 2000,
        maxInactiveTime: isUltraMode ? 15000 : 30000,
      },
    },
    
    // Maximum concurrency based on performance mode
    maxConcurrency: performanceConfig.maxConcurrency,
    fileParallelism: true, // Enable file parallelism
    
    // Aggressive caching with intelligent invalidation
    // Note: cacheDir is configured at root level for Vitest 3.x compatibility
    
    // Performance benchmarking
    benchmark: {
      outputFile: `./test-results/performance-${PERF_MODE}-benchmark.json`,
    },
    
    // Optimized execution settings
    silent: false, // Allow minimal output for monitoring
    passWithNoTests: true,
    
    // Performance diff tracking (optional, will be created if needed)
    // diff: `./test-results/performance-${PERF_MODE}-diff.json`,
    
    // Fast-fail on first error in ultra mode
    bail: isUltraMode ? 1 : 0,
  },
  
  // Optimized build configuration
  esbuild: {
    target: 'node18',
    sourcemap: isUltraMode ? false : false, // Disable sourcemaps for speed
    jsx: 'automatic',
    jsxImportSource: 'react',
    keepNames: false, // Disable for speed
    minifyIdentifiers: false, // Disable for speed
    minifySyntax: false, // Disable for speed
  },
  
  // Performance constants
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false,
    __PERFORMANCE_MODE__: true,
    __ULTRA_PERFORMANCE__: isUltraMode,
    __FAST_MODE__: isFastMode,
    global: 'globalThis',
  },
  
  // Aggressive dependency optimization
  optimizeDeps: {
    include: [
      'vitest',
      ...(isUltraMode ? [] : ['@testing-library/react', 'jsdom']), // Skip React deps in ultra mode
      'react',
      'react-dom',
    ],
    exclude: [
      'playwright',
      '@playwright/test',
      'puppeteer',
      'selenium-webdriver',
      'cypress',
      ...(isUltraMode ? ['@testing-library/react', 'jsdom'] : []), // Exclude React deps in ultra mode
    ],
    // Force dependency bundling for speed
    force: true,
  },
  
  // Performance-optimized server configuration
  server: {
    hmr: false, // Disable HMR for speed
    watch: null, // Disable file watching
    middlewareMode: false,
    fs: {
      strict: false, // Relax file system restrictions for speed
      allow: ['..', '.'],
      deny: ['.env*'], // Deny environment files
    },
  },
  
  // Resolve optimization
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@utils': path.resolve(__dirname, './tests/utils')
    },
    // Performance-focused extensions
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  
  // Build optimization
  build: {
    target: 'node18',
    minify: false, // Disable minification for speed
    sourcemap: false, // Disable sourcemaps for speed
    reportCompressedSize: false, // Disable size reporting for speed
  },
});