#!/usr/bin/env bun

/**
 * Stagehand Authentication Test Runner
 * 
 * This script runs the comprehensive Stagehand authentication tests
 * with proper environment setup and reporting.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

interface TestResults {
  passed: number;
  failed: number;
  total: number;
  duration: number;
  errors: string[];
}

class StaghandTestRunner {
  private baseUrl: string;
  private testEnvironment: string;
  
  constructor() {
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3008';
    this.testEnvironment = process.env.TEST_ENVIRONMENT || 'test';
  }
  
  async validateEnvironment(): Promise<boolean> {
    console.log('🔍 Validating test environment...');
    
    // Check if required environment variables are set
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
      return false;
    }
    
    // Check if test configuration files exist
    const configFiles = [
      'playwright.config.ts',
      'stagehand.config.unified.ts'
    ];
    
    const missingFiles = configFiles.filter(file => !existsSync(path.join(process.cwd(), file)));
    
    if (missingFiles.length > 0) {
      console.error(`❌ Missing configuration files: ${missingFiles.join(', ')}`);
      return false;
    }
    
    // Test application availability
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) {
        console.error(`❌ Application not available at ${this.baseUrl}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Cannot connect to application at ${this.baseUrl}:`, error.message);
      return false;
    }
    
    console.log('✅ Environment validation passed');
    return true;
  }
  
  async runTest(testFile: string): Promise<TestResults> {
    console.log(`🧪 Running test: ${testFile}`);
    
    const startTime = Date.now();
    const results: TestResults = {
      passed: 0,
      failed: 0,
      total: 0,
      duration: 0,
      errors: []
    };
    
    try {
      const command = `npx playwright test ${testFile} --config=playwright.config.ts`;
      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          TEST_BASE_URL: this.baseUrl,
          TEST_ENVIRONMENT: this.testEnvironment,
          PLAYWRIGHT_TEST: 'true'
        },
        timeout: 300000 // 5 minutes timeout
      });
      
      // Parse Playwright output
      const output = stdout + stderr;
      const passedMatch = output.match(/(\d+) passed/);
      const failedMatch = output.match(/(\d+) failed/);
      
      results.passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      results.failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      results.total = results.passed + results.failed;
      
      if (stderr) {
        results.errors.push(stderr);
      }
      
      console.log(`✅ Test completed: ${results.passed}/${results.total} passed`);
      
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
      results.failed = 1;
      results.total = 1;
      results.errors.push(error.message);
    }
    
    results.duration = Date.now() - startTime;
    return results;
  }
  
  async runAllStaghandTests(): Promise<void> {
    console.log('🚀 Starting Stagehand Authentication Test Suite');
    console.log(`📍 Base URL: ${this.baseUrl}`);
    console.log(`🌍 Environment: ${this.testEnvironment}`);
    
    // Validate environment first
    const isValid = await this.validateEnvironment();
    if (!isValid) {
      console.error('❌ Environment validation failed. Aborting tests.');
      process.exit(1);
    }
    
    const testFiles = [
      'tests/e2e/stagehand-user-creation.spec.ts',
      'tests/e2e/stagehand-auth-comprehensive.spec.ts',
      'tests/e2e/stagehand-critical-flows.spec.ts'
    ];
    
    const allResults: TestResults[] = [];
    
    for (const testFile of testFiles) {
      if (existsSync(path.join(process.cwd(), testFile))) {
        const results = await this.runTest(testFile);
        allResults.push(results);
      } else {
        console.warn(`⚠️ Test file not found: ${testFile}`);
      }
    }
    
    // Generate summary report
    this.generateSummaryReport(allResults);
  }
  
  private generateSummaryReport(results: TestResults[]): void {
    console.log('\n📊 Test Summary Report');
    console.log('=' .repeat(50));
    
    const totals = results.reduce((acc, result) => ({
      passed: acc.passed + result.passed,
      failed: acc.failed + result.failed,
      total: acc.total + result.total,
      duration: acc.duration + result.duration
    }), { passed: 0, failed: 0, total: 0, duration: 0 });
    
    console.log(`✅ Passed: ${totals.passed}`);
    console.log(`❌ Failed: ${totals.failed}`);
    console.log(`📝 Total: ${totals.total}`);
    console.log(`⏱️ Duration: ${(totals.duration / 1000).toFixed(2)}s`);
    console.log(`📈 Success Rate: ${totals.total > 0 ? ((totals.passed / totals.total) * 100).toFixed(1) : 0}%`);
    
    if (results.some(r => r.errors.length > 0)) {
      console.log('\n🚨 Errors:');
      results.forEach((result, index) => {
        if (result.errors.length > 0) {
          console.log(`Test ${index + 1} errors:`);
          result.errors.forEach(error => console.log(`  - ${error}`));
        }
      });
    }
    
    console.log('\n🏁 Test suite completed');
    
    // Exit with appropriate code
    process.exit(totals.failed > 0 ? 1 : 0);
  }
}

// Main execution
async function main() {
  const runner = new StaghandTestRunner();
  await runner.runAllStaghandTests();
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Stagehand Authentication Test Runner

Usage: bun run scripts/run-stagehand-auth-tests.ts [options]

Options:
  --help, -h     Show this help message

Environment Variables:
  TEST_BASE_URL          Base URL for testing (default: http://localhost:3008)
  TEST_ENVIRONMENT       Test environment (default: test)
  OPENAI_API_KEY         OpenAI API key for Stagehand AI features
  SUPABASE_URL           Supabase project URL
  SUPABASE_ANON_KEY      Supabase anonymous key

Examples:
  bun run scripts/run-stagehand-auth-tests.ts
  TEST_BASE_URL=http://localhost:3000 bun run scripts/run-stagehand-auth-tests.ts
  `);
  process.exit(0);
}

// Run the tests
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});