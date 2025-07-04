/**
 * Test Environment Configuration System
 * MISSION: Test Configuration Optimization Agent - Environment Management
 * 
 * FEATURES:
 * - Dynamic environment switching based on test type
 * - Intelligent resource allocation
 * - Environment-specific optimizations
 * - Comprehensive test isolation
 * - Performance monitoring and analytics
 */

import { cpus } from 'os';
import type { InlineConfig } from 'vitest/config';

export type TestEnvironmentType = 'unit' | 'integration' | 'performance' | 'e2e' | 'ci' | 'local';

export interface TestEnvironmentConfig {
  environment: TestEnvironmentType;
  threads: {
    max: number;
    min: number;
    isolate: boolean;
  };
  timeouts: {
    test: number;
    hook: number;
    teardown: number;
  };
  performance: {
    enableCaching: boolean;
    enableCoverage: boolean;
    enableMonitoring: boolean;
    maxConcurrency: number;
  };
  isolation: {
    fileParallelism: boolean;
    processIsolation: boolean;
    memoryIsolation: boolean;
  };
  reporting: {
    reporters: string[];
    outputPath: string;
    enableBenchmark: boolean;
  };
}

/**
 * Get optimal CPU allocation based on environment
 */
function getOptimalCpuAllocation(environment: TestEnvironmentType): { max: number; min: number } {
  const totalCpus = cpus().length;
  const isCI = process.env.CI === 'true';
  
  switch (environment) {
    case 'performance':
      return {
        max: Math.min(totalCpus, 16),
        min: Math.floor(totalCpus * 0.5)
      };
    
    case 'ci':
      return {
        max: Math.min(totalCpus, isCI ? 2 : 4),
        min: 1
      };
    
    case 'unit':
      return {
        max: Math.min(totalCpus, 8),
        min: Math.floor(totalCpus * 0.25)
      };
    
    case 'integration':
      return {
        max: Math.min(totalCpus, 4),
        min: 1
      };
    
    case 'e2e':
      return {
        max: Math.min(totalCpus, 2),
        min: 1
      };
    
    case 'local':
    default:
      return {
        max: Math.min(totalCpus, 6),
        min: Math.floor(totalCpus * 0.25)
      };
  }
}

/**
 * Environment-specific configurations
 */
export const TEST_ENVIRONMENT_CONFIGS: Record<TestEnvironmentType, TestEnvironmentConfig> = {
  unit: {
    environment: 'unit',
    threads: {
      ...getOptimalCpuAllocation('unit'),
      isolate: true,
    },
    timeouts: {
      test: 5000,
      hook: 10000,
      teardown: 5000,
    },
    performance: {
      enableCaching: true,
      enableCoverage: true,
      enableMonitoring: true,
      maxConcurrency: 16,
    },
    isolation: {
      fileParallelism: true,
      processIsolation: true,
      memoryIsolation: true,
    },
    reporting: {
      reporters: ['default', 'json'],
      outputPath: './test-results/unit-test-results.json',
      enableBenchmark: true,
    },
  },
  
  integration: {
    environment: 'integration',
    threads: {
      ...getOptimalCpuAllocation('integration'),
      isolate: true,
    },
    timeouts: {
      test: 15000,
      hook: 20000,
      teardown: 15000,
    },
    performance: {
      enableCaching: true,
      enableCoverage: true,
      enableMonitoring: true,
      maxConcurrency: 8,
    },
    isolation: {
      fileParallelism: false, // Sequential for database tests
      processIsolation: true,
      memoryIsolation: true,
    },
    reporting: {
      reporters: ['default', 'json', 'junit'],
      outputPath: './test-results/integration-test-results.json',
      enableBenchmark: true,
    },
  },
  
  performance: {
    environment: 'performance',
    threads: {
      ...getOptimalCpuAllocation('performance'),
      isolate: false, // Disable for speed
    },
    timeouts: {
      test: 2000,
      hook: 3000,
      teardown: 3000,
    },
    performance: {
      enableCaching: true,
      enableCoverage: false, // Disable for speed
      enableMonitoring: true,
      maxConcurrency: 32,
    },
    isolation: {
      fileParallelism: true,
      processIsolation: false, // Disable for speed
      memoryIsolation: false, // Disable for speed
    },
    reporting: {
      reporters: ['basic'],
      outputPath: './test-results/performance-test-results.json',
      enableBenchmark: true,
    },
  },
  
  e2e: {
    environment: 'e2e',
    threads: {
      ...getOptimalCpuAllocation('e2e'),
      isolate: true,
    },
    timeouts: {
      test: 30000,
      hook: 45000,
      teardown: 30000,
    },
    performance: {
      enableCaching: false,
      enableCoverage: false,
      enableMonitoring: true,
      maxConcurrency: 2,
    },
    isolation: {
      fileParallelism: false,
      processIsolation: true,
      memoryIsolation: true,
    },
    reporting: {
      reporters: ['default', 'json', 'junit'],
      outputPath: './test-results/e2e-test-results.json',
      enableBenchmark: false,
    },
  },
  
  ci: {
    environment: 'ci',
    threads: {
      ...getOptimalCpuAllocation('ci'),
      isolate: true,
    },
    timeouts: {
      test: 3000,
      hook: 5000,
      teardown: 5000,
    },
    performance: {
      enableCaching: true,
      enableCoverage: true,
      enableMonitoring: false, // Disable for CI speed
      maxConcurrency: 4,
    },
    isolation: {
      fileParallelism: true,
      processIsolation: true,
      memoryIsolation: true,
    },
    reporting: {
      reporters: ['github-actions', 'json', 'junit'],
      outputPath: './test-results/ci-test-results.json',
      enableBenchmark: false,
    },
  },
  
  local: {
    environment: 'local',
    threads: {
      ...getOptimalCpuAllocation('local'),
      isolate: true,
    },
    timeouts: {
      test: 8000,
      hook: 15000,
      teardown: 10000,
    },
    performance: {
      enableCaching: true,
      enableCoverage: true,
      enableMonitoring: true,
      maxConcurrency: 12,
    },
    isolation: {
      fileParallelism: true,
      processIsolation: true,
      memoryIsolation: true,
    },
    reporting: {
      reporters: ['verbose', 'json'],
      outputPath: './test-results/local-test-results.json',
      enableBenchmark: true,
    },
  },
};

/**
 * Get test environment configuration
 */
export function getTestEnvironmentConfig(environment?: TestEnvironmentType): TestEnvironmentConfig {
  const envType = environment || detectTestEnvironment();
  return TEST_ENVIRONMENT_CONFIGS[envType];
}

/**
 * Detect test environment from environment variables and context
 */
export function detectTestEnvironment(): TestEnvironmentType {
  // Check CI environment
  if (process.env.CI === 'true') {
    return 'ci';
  }
  
  // Check for specific test type flags
  if (process.env.TEST_PERFORMANCE_MODE === 'true') {
    return 'performance';
  }
  
  if (process.env.TEST_E2E_MODE === 'true') {
    return 'e2e';
  }
  
  if (process.env.TEST_INTEGRATION_MODE === 'true') {
    return 'integration';
  }
  
  // Check command line arguments
  const args = process.argv.join(' ');
  if (args.includes('performance')) {
    return 'performance';
  }
  
  if (args.includes('integration')) {
    return 'integration';
  }
  
  if (args.includes('e2e')) {
    return 'e2e';
  }
  
  // Default to local for development
  return process.env.NODE_ENV === 'production' ? 'ci' : 'local';
}

/**
 * Generate Vitest configuration from environment config
 */
export function generateVitestConfig(environmentConfig: TestEnvironmentConfig): Partial<InlineConfig> {
  const config = environmentConfig;
  
  return {
    test: {
      testTimeout: config.timeouts.test,
      hookTimeout: config.timeouts.hook,
      teardownTimeout: config.timeouts.teardown,
      
      pool: 'threads',
      poolOptions: {
        threads: {
          maxThreads: config.threads.max,
          minThreads: config.threads.min,
          isolate: config.threads.isolate,
          useAtomics: true,
        },
      },
      
      maxConcurrency: config.performance.maxConcurrency,
      fileParallelism: config.isolation.fileParallelism,
      
      isolate: config.isolation.processIsolation,
      
      coverage: {
        enabled: config.performance.enableCoverage,
        reporter: config.performance.enableCoverage ? ['text', 'json', 'lcov'] : undefined,
        reportsDirectory: './coverage/vitest',
      },
      
      cache: config.performance.enableCaching ? {
        dir: `./node_modules/.vitest/${config.environment}`,
      } : false,
      
      benchmark: config.reporting.enableBenchmark ? {
        outputFile: `./test-results/${config.environment}-benchmark.json`,
      } : undefined,
      
      reporters: config.reporting.reporters as any,
      
      outputFile: {
        json: config.reporting.outputPath,
        junit: config.reporting.outputPath.replace('.json', '.xml'),
      },
      
      sequence: {
        concurrent: config.isolation.fileParallelism,
        shuffle: process.env.TEST_SHUFFLE === 'true',
        hooks: config.isolation.fileParallelism ? 'parallel' : 'stack',
        setupFiles: config.isolation.fileParallelism ? 'parallel' : 'list',
      },
    },
  };
}

/**
 * Get environment-specific test include patterns
 */
export function getTestIncludePatterns(environment: TestEnvironmentType): string[] {
  const basePatterns = [
    'tests/unit/**/*.test.{js,ts,tsx}',
    'tests/utils/**/*.test.{js,ts,tsx}',
    'tests/components/**/*.test.{js,ts,tsx}',
  ];
  
  switch (environment) {
    case 'integration':
      return [
        ...basePatterns,
        'tests/integration/**/*.test.{js,ts,tsx}',
      ];
    
    case 'performance':
      return [
        ...basePatterns,
        'tests/performance/**/*.test.{js,ts,tsx}',
      ];
    
    case 'e2e':
      return [
        'tests/e2e/**/*.test.{js,ts,tsx}',
      ];
    
    case 'ci':
      return [
        ...basePatterns,
        'tests/integration/**/*.test.{js,ts,tsx}',
        '!tests/**/*.slow.test.*',
        '!tests/**/*.flaky.test.*',
      ];
    
    default:
      return basePatterns;
  }
}

/**
 * Get environment-specific test exclude patterns
 */
export function getTestExcludePatterns(environment: TestEnvironmentType): string[] {
  const baseExcludes = [
    'node_modules',
    'dist',
    '.next',
    'coverage',
    'build',
    'out',
    'playwright-report/**/*',
    'test-results/**/*',
    'test-screenshots/**/*',
    'all-tests/**/*',
  ];
  
  switch (environment) {
    case 'performance':
      return [
        ...baseExcludes,
        '**/*.slow.test.*',
        '**/*.spec.ts',
        '**/*.spec.js',
        'tests/e2e/**/*',
        'tests/integration/**/*',
      ];
    
    case 'ci':
      return [
        ...baseExcludes,
        '**/*.slow.test.*',
        '**/*.flaky.test.*',
        'tests/e2e/**/*',
        '**/*.spec.ts',
        '**/*.spec.js',
      ];
    
    default:
      return [
        ...baseExcludes,
        '**/*.spec.ts',
        '**/*.spec.js',
        '**/*.e2e.*',
      ];
  }
}

/**
 * Performance monitoring utilities
 */
export class TestEnvironmentMonitor {
  private startTime: number = Date.now();
  private metrics: Record<string, any> = {};
  
  constructor(private environment: TestEnvironmentType) {}
  
  recordMetric(key: string, value: any): void {
    this.metrics[key] = value;
  }
  
  recordPerformance(operation: string, duration: number): void {
    if (!this.metrics.performance) {
      this.metrics.performance = {};
    }
    this.metrics.performance[operation] = duration;
  }
  
  getMetrics(): Record<string, any> {
    return {
      ...this.metrics,
      environment: this.environment,
      totalDuration: Date.now() - this.startTime,
      timestamp: new Date().toISOString(),
    };
  }
  
  exportMetrics(): void {
    const metrics = this.getMetrics();
    const fs = require('fs');
    const path = require('path');
    
    const outputPath = `./test-results/${this.environment}-metrics.json`;
    fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
  }
}

/**
 * Global test environment monitor
 */
export const testEnvironmentMonitor = new TestEnvironmentMonitor(detectTestEnvironment());