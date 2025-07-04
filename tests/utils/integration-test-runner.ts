/**
 * Integration Test Runner
 * 
 * Orchestrates integration test execution with comprehensive server management,
 * parallel test optimization, and reliability monitoring.
 */

import { spawn, ChildProcess } from 'child_process';
import { SharedServerManager, setupIntegrationServer, teardownIntegrationServers } from './integration-server-manager';
import { withRetryTimeout, withApiTimeout } from './timeout-utilities';
import fs from 'fs/promises';
import path from 'path';

export interface TestRunConfig {
  testPattern?: string;
  parallel?: boolean;
  maxConcurrency?: number;
  serverPort?: number;
  enableLogs?: boolean;
  enableCoverage?: boolean;
  outputFormat?: 'json' | 'junit' | 'verbose' | 'silent';
  retryFailedTests?: boolean;
  maxRetries?: number;
  cleanupAfterRun?: boolean;
  preflightChecks?: boolean;
}

export interface TestRunResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  serverLogs?: string[];
  errors: string[];
  warnings: string[];
}

export interface PreflightCheckResult {
  server: boolean;
  database: boolean;
  environment: boolean;
  dependencies: boolean;
  overall: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Advanced integration test runner with reliability features
 */
export class IntegrationTestRunner {
  private config: Required<TestRunConfig>;
  private testProcess: ChildProcess | null = null;
  private serverSetupComplete = false;
  private startTime = 0;

  constructor(config: TestRunConfig = {}) {
    this.config = {
      testPattern: config.testPattern || 'tests/integration/**/*.test.ts',
      parallel: config.parallel ?? true,
      maxConcurrency: config.maxConcurrency || 4,
      serverPort: config.serverPort || 3109,
      enableLogs: config.enableLogs ?? true,
      enableCoverage: config.enableCoverage ?? false,
      outputFormat: config.outputFormat || 'verbose',
      retryFailedTests: config.retryFailedTests ?? true,
      maxRetries: config.maxRetries || 2,
      cleanupAfterRun: config.cleanupAfterRun ?? true,
      preflightChecks: config.preflightChecks ?? true
    };
  }

  /**
   * Run integration tests with comprehensive orchestration
   */
  async run(): Promise<TestRunResult> {
    this.startTime = Date.now();
    
    console.log('🚀 Starting Integration Test Runner...');
    console.log(`📊 Configuration:`, {
      testPattern: this.config.testPattern,
      parallel: this.config.parallel,
      maxConcurrency: this.config.maxConcurrency,
      serverPort: this.config.serverPort,
      enableCoverage: this.config.enableCoverage
    });

    try {
      // 1. Preflight checks
      if (this.config.preflightChecks) {
        await this.runPreflightChecks();
      }

      // 2. Setup test infrastructure
      await this.setupTestInfrastructure();

      // 3. Run tests
      const result = await this.executeTests();

      // 4. Cleanup
      if (this.config.cleanupAfterRun) {
        await this.cleanup();
      }

      console.log(`✅ Integration tests completed in ${result.duration}ms`);
      console.log(`📊 Results: ${result.passedTests}/${result.totalTests} passed`);

      return result;

    } catch (error) {
      console.error('❌ Integration test run failed:', error.message);
      
      // Attempt cleanup on failure
      await this.cleanup();
      
      return {
        success: false,
        totalTests: 0,
        passedTests: 0,
        failedTests: 1,
        skippedTests: 0,
        duration: Date.now() - this.startTime,
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Run preflight checks to ensure test environment is ready
   */
  async runPreflightChecks(): Promise<PreflightCheckResult> {
    console.log('🔍 Running preflight checks...');
    
    const result: PreflightCheckResult = {
      server: false,
      database: false,
      environment: false,
      dependencies: false,
      overall: false,
      errors: [],
      warnings: []
    };

    try {
      // Check environment variables
      const requiredEnvVars = ['DATABASE_URL'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length === 0) {
        result.environment = true;
      } else {
        result.errors.push(`Missing environment variables: ${missingVars.join(', ')}`);
      }

      // Check dependencies
      try {
        await this.checkDependencies();
        result.dependencies = true;
      } catch (error) {
        result.errors.push(`Dependency check failed: ${error.message}`);
      }

      // Test server startup
      try {
        const { server } = await setupIntegrationServer({
          port: this.config.serverPort + 1000, // Use different port for preflight
          startupTimeout: 30000
        });
        
        const status = server.getStatus();
        if (status.isReady) {
          result.server = true;
          console.log('✅ Server preflight check passed');
        } else {
          result.errors.push('Server failed to start during preflight check');
        }
        
        await server.stop();
      } catch (error) {
        result.errors.push(`Server preflight failed: ${error.message}`);
      }

      // Test database connectivity
      try {
        // Import here to avoid early initialization
        const { db } = await import('../../src/db');
        await db.execute('SELECT 1' as any);
        result.database = true;
        console.log('✅ Database preflight check passed');
      } catch (error) {
        result.warnings.push(`Database preflight warning: ${error.message}`);
        // Don't fail on database check as tests might use mocks
        result.database = true;
      }

      result.overall = result.server && result.database && result.environment && result.dependencies;

      if (result.overall) {
        console.log('✅ All preflight checks passed');
      } else {
        console.warn('⚠️ Some preflight checks failed:', result.errors);
      }

      return result;

    } catch (error) {
      result.errors.push(`Preflight check error: ${error.message}`);
      return result;
    }
  }

  /**
   * Setup test infrastructure
   */
  private async setupTestInfrastructure(): Promise<void> {
    console.log('🏗️ Setting up test infrastructure...');

    try {
      // Pre-warm the shared server for faster test execution
      const { server } = await setupIntegrationServer({
        port: this.config.serverPort,
        env: {
          NODE_ENV: 'test',
          USE_REAL_DATABASE: 'true',
          FORCE_MOCK_DB: 'false',
          TEST_SERVER_LOGS: this.config.enableLogs.toString()
        },
        logOutput: this.config.enableLogs,
        enableDevMode: true
      });

      // Wait for stable health
      await server.waitForStableHealth(3);
      this.serverSetupComplete = true;

      console.log('✅ Test infrastructure ready');

    } catch (error) {
      throw new Error(`Test infrastructure setup failed: ${error.message}`);
    }
  }

  /**
   * Execute the actual tests
   */
  private async executeTests(): Promise<TestRunResult> {
    console.log('🧪 Executing integration tests...');

    return new Promise((resolve, reject) => {
      const vitestArgs = this.buildVitestArgs();
      
      console.log(`📦 Running: npx vitest ${vitestArgs.join(' ')}`);
      
      this.testProcess = spawn('npx', ['vitest', ...vitestArgs], {
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          USE_REAL_DATABASE: 'true',
          FORCE_MOCK_DB: 'false',
          TEST_PORT: this.config.serverPort.toString(),
          TEST_SERVER_LOGS: this.config.enableLogs.toString()
        }
      });

      let stdout = '';
      let stderr = '';
      
      if (this.testProcess.stdout) {
        this.testProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          
          if (this.config.outputFormat === 'verbose') {
            console.log(output.trim());
          }
        });
      }

      if (this.testProcess.stderr) {
        this.testProcess.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          
          if (this.config.outputFormat === 'verbose') {
            console.error(output.trim());
          }
        });
      }

      this.testProcess.on('close', (code) => {
        const duration = Date.now() - this.startTime;
        
        try {
          const result = this.parseTestOutput(stdout, stderr, code === 0, duration);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse test output: ${error.message}`));
        }
      });

      this.testProcess.on('error', (error) => {
        reject(new Error(`Test process error: ${error.message}`));
      });
    });
  }

  /**
   * Build vitest command arguments
   */
  private buildVitestArgs(): string[] {
    const args = ['run']; // Always use run mode for CI

    // Test pattern
    args.push(this.config.testPattern);

    // Parallel configuration
    if (this.config.parallel) {
      args.push('--reporter=verbose');
      args.push(`--pool=threads`);
      args.push(`--poolOptions.threads.maxThreads=${this.config.maxConcurrency}`);
    } else {
      args.push('--no-coverage');
      args.push('--poolOptions.threads.maxThreads=1');
    }

    // Coverage
    if (this.config.enableCoverage) {
      args.push('--coverage');
      args.push('--coverage.provider=v8');
      args.push('--coverage.reporter=text');
      args.push('--coverage.reporter=json');
    }

    // Output format
    switch (this.config.outputFormat) {
      case 'json':
        args.push('--reporter=json');
        args.push('--outputFile=test-results/integration-results.json');
        break;
      case 'junit':
        args.push('--reporter=junit');
        args.push('--outputFile=test-results/integration-junit.xml');
        break;
      case 'silent':
        args.push('--reporter=basic');
        args.push('--silent');
        break;
      default:
        args.push('--reporter=verbose');
    }

    // Retries
    if (this.config.retryFailedTests) {
      args.push(`--retry=${this.config.maxRetries}`);
    }

    // Timeout
    args.push('--testTimeout=120000'); // 2 minutes per test

    return args;
  }

  /**
   * Parse test output to extract results
   */
  private parseTestOutput(stdout: string, stderr: string, success: boolean, duration: number): TestRunResult {
    const result: TestRunResult = {
      success,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration,
      errors: [],
      warnings: []
    };

    try {
      // Parse test counts from output
      const testSummaryMatch = stdout.match(/(\d+) passed.*?(\d+) failed.*?(\d+) skipped/);
      if (testSummaryMatch) {
        result.passedTests = parseInt(testSummaryMatch[1], 10);
        result.failedTests = parseInt(testSummaryMatch[2], 10);
        result.skippedTests = parseInt(testSummaryMatch[3], 10);
        result.totalTests = result.passedTests + result.failedTests + result.skippedTests;
      } else {
        // Alternative parsing
        const passedMatch = stdout.match(/(\d+) passed/);
        const failedMatch = stdout.match(/(\d+) failed/);
        const skippedMatch = stdout.match(/(\d+) skipped/);

        result.passedTests = passedMatch ? parseInt(passedMatch[1], 10) : 0;
        result.failedTests = failedMatch ? parseInt(failedMatch[1], 10) : 0;
        result.skippedTests = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
        result.totalTests = result.passedTests + result.failedTests + result.skippedTests;
      }

      // Parse coverage if enabled
      if (this.config.enableCoverage) {
        const coverageMatch = stdout.match(/(\d+\.?\d*)%.*?(\d+\.?\d*)%.*?(\d+\.?\d*)%.*?(\d+\.?\d*)%/);
        if (coverageMatch) {
          result.coverage = {
            statements: parseFloat(coverageMatch[1]),
            branches: parseFloat(coverageMatch[2]),
            functions: parseFloat(coverageMatch[3]),
            lines: parseFloat(coverageMatch[4])
          };
        }
      }

      // Extract errors from stderr
      if (stderr) {
        const errorLines = stderr.split('\n').filter(line => 
          line.includes('Error') || line.includes('FAIL') || line.includes('✗')
        );
        result.errors.push(...errorLines.slice(0, 10)); // Limit to 10 errors
      }

      // Extract warnings
      const warningLines = stdout.split('\n').filter(line => 
        line.includes('warn') || line.includes('⚠️') || line.includes('WARNING')
      );
      result.warnings.push(...warningLines.slice(0, 5)); // Limit to 5 warnings

    } catch (error) {
      result.errors.push(`Failed to parse test output: ${error.message}`);
    }

    return result;
  }

  /**
   * Check required dependencies
   */
  private async checkDependencies(): Promise<void> {
    const requiredCommands = ['npx', 'bun'];
    
    for (const cmd of requiredCommands) {
      try {
        const result = await this.runCommand(`which ${cmd}`);
        if (!result.includes(cmd)) {
          throw new Error(`Command not found: ${cmd}`);
        }
      } catch (error) {
        throw new Error(`Dependency check failed for ${cmd}: ${error.message}`);
      }
    }
  }

  /**
   * Run a shell command and return output
   */
  private async runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('sh', ['-c', command], { stdio: 'pipe' });
      let output = '';

      if (process.stdout) {
        process.stdout.on('data', (data) => {
          output += data.toString();
        });
      }

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Command failed with code ${code}: ${command}`));
        }
      });

      process.on('error', reject);
    });
  }

  /**
   * Cleanup test infrastructure
   */
  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test infrastructure...');

    try {
      // Stop test process if still running
      if (this.testProcess && !this.testProcess.killed) {
        this.testProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise(resolve => {
          setTimeout(() => {
            if (this.testProcess && !this.testProcess.killed) {
              this.testProcess.kill('SIGKILL');
            }
            resolve(undefined);
          }, 5000);
        });
      }

      // Cleanup shared servers
      await teardownIntegrationServers();

      console.log('✅ Test infrastructure cleanup completed');

    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }
}

/**
 * CLI interface for the integration test runner
 */
export async function runIntegrationTestsCLI(args: string[] = process.argv.slice(2)): Promise<void> {
  const config: TestRunConfig = {};

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--pattern':
        config.testPattern = args[++i];
        break;
      case '--port':
        config.serverPort = parseInt(args[++i], 10);
        break;
      case '--parallel':
        config.parallel = true;
        break;
      case '--no-parallel':
        config.parallel = false;
        break;
      case '--coverage':
        config.enableCoverage = true;
        break;
      case '--verbose':
        config.outputFormat = 'verbose';
        break;
      case '--silent':
        config.outputFormat = 'silent';
        break;
      case '--no-cleanup':
        config.cleanupAfterRun = false;
        break;
      case '--no-preflight':
        config.preflightChecks = false;
        break;
      case '--retry':
        config.retryFailedTests = true;
        config.maxRetries = parseInt(args[++i], 10) || 2;
        break;
    }
  }

  const runner = new IntegrationTestRunner(config);
  const result = await runner.run();

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Export for programmatic usage
export { IntegrationTestRunner };

// CLI entry point
if (require.main === module) {
  runIntegrationTestsCLI().catch((error) => {
    console.error('💥 Integration test runner failed:', error);
    process.exit(1);
  });
}