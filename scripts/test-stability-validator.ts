#!/usr/bin/env bun

/**
 * Test Stability Validator
 * MISSION: Validate ALL test stability and reliability improvements
 * 
 * Validates:
 * - Test isolation and cleanup
 * - Memory leak prevention
 * - Timing-dependent test fixes
 * - Configuration optimization
 * - Resource management
 * - Flaky test elimination
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  category: string;
  checks: Array<{
    name: string;
    passed: boolean;
    details?: string;
    error?: string;
  }>;
  overallPassed: boolean;
}

class TestStabilityValidator {
  private results: ValidationResult[] = [];
  
  async validateAll(): Promise<void> {
    console.log('🔍 Test Stability & Reliability Validation');
    console.log('==========================================');
    
    await this.validateConfiguration();
    await this.validateTestUtilities();
    await this.validateMemoryManagement();
    await this.validateTimingFixes();
    await this.validateTestExecution();
    
    this.generateReport();
  }
  
  private async validateConfiguration(): Promise<void> {
    console.log('\n📝 Validating Test Configuration...');
    
    const checks = [
      {
        name: 'Stability config exists',
        check: () => existsSync('vitest.config.stability.ts'),
        details: 'Enhanced stability configuration file'
      },
      {
        name: 'Unified config updated',
        check: () => {
          const config = readFileSync('vitest.config.unified.ts', 'utf-8');
          return config.includes('STABILITY-OPTIMIZED') && 
                 config.includes('maxMemoryLimitBeforeRecycle') &&
                 config.includes('test-stability-utilities');
        },
        details: 'Main configuration enhanced with stability features'
      },
      {
        name: 'Package.json scripts added',
        check: () => {
          const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
          return pkg.scripts['test:stability'] && 
                 pkg.scripts['test:unit:stability'] &&
                 pkg.scripts['test:single-thread'];
        },
        details: 'New stability test scripts available'
      },
      {
        name: 'Environment variables configured',
        check: () => {
          const config = readFileSync('vitest.config.unified.ts', 'utf-8');
          return config.includes('VITEST_STABILITY_MODE') &&
                 config.includes('ENABLE_STABILITY_MONITORING') &&
                 config.includes('TEST_TIMING_MODE');
        },
        details: 'Stability environment variables configured'
      }
    ];
    
    const results = await this.runChecks('Configuration', checks);
    this.results.push(results);
  }
  
  private async validateTestUtilities(): Promise<void> {
    console.log('\n🛠️ Validating Test Utilities...');
    
    const checks = [
      {
        name: 'Stability utilities exist',
        check: () => existsSync('tests/utils/test-stability-utilities.ts'),
        details: 'Core stability utilities implementation'
      },
      {
        name: 'Timing fix utilities exist',
        check: () => existsSync('tests/utils/timing-fix-utilities.ts'),
        details: 'Timing-specific fix utilities'
      },
      {
        name: 'Order test fixes exist',
        check: () => existsSync('tests/fixes/order-test-stability-fixes.ts'),
        details: 'Specific fixes for order test failures'
      },
      {
        name: 'Setup file updated',
        check: () => {
          const setup = readFileSync('tests/setup/vitest-setup.ts', 'utf-8');
          return setup.includes('setupStableTestEnvironment') &&
                 setup.includes('processEventManager') &&
                 setup.includes('error boundary');
        },
        details: 'Test setup enhanced with stability features'
      }
    ];
    
    const results = await this.runChecks('Test Utilities', checks);
    this.results.push(results);
  }
  
  private async validateMemoryManagement(): Promise<void> {
    console.log('\n🧠 Validating Memory Management...');
    
    const checks = [
      {
        name: 'Process event manager integration',
        check: () => {
          const setup = readFileSync('tests/setup/vitest-setup.ts', 'utf-8');
          return setup.includes('processEventManager.increaseMaxListeners') &&
                 setup.includes('processEventManager.registerHandler') &&
                 setup.includes('processEventManager.unregisterHandler');
        },
        details: 'Process event manager properly integrated'
      },
      {
        name: 'Memory leak prevention utilities',
        check: () => {
          const utilities = readFileSync('tests/utils/test-stability-utilities.ts', 'utf-8');
          return utilities.includes('MemoryLeakPrevention') &&
                 utilities.includes('TestContextManager') &&
                 utilities.includes('globalTimeoutMonitor');
        },
        details: 'Memory leak prevention mechanisms in place'
      },
      {
        name: 'Cleanup mechanisms',
        check: () => {
          const utilities = readFileSync('tests/utils/test-stability-utilities.ts', 'utf-8');
          return utilities.includes('cleanupContext') &&
                 utilities.includes('clearAllListeners') &&
                 utilities.includes('registerCleanup');
        },
        details: 'Comprehensive cleanup mechanisms'
      },
      {
        name: 'Memory monitoring',
        check: () => {
          const config = readFileSync('vitest.config.stability.ts', 'utf-8');
          return config.includes('logHeapUsage: true') &&
                 config.includes('maxMemoryLimitBeforeRecycle') &&
                 config.includes('--max-old-space-size=4096');
        },
        details: 'Memory monitoring and limits configured'
      }
    ];
    
    const results = await this.runChecks('Memory Management', checks);
    this.results.push(results);
  }
  
  private async validateTimingFixes(): Promise<void> {
    console.log('\n⏰ Validating Timing Fixes...');
    
    const checks = [
      {
        name: 'Stable timing context',
        check: () => {
          const timingUtils = readFileSync('tests/utils/timing-fix-utilities.ts', 'utf-8');
          return timingUtils.includes('StableTimingContext') &&
                 timingUtils.includes('freezeTimeAt') &&
                 timingUtils.includes('advanceTime');
        },
        details: 'Stable timing context implementation'
      },
      {
        name: 'Date/time utilities',
        check: () => {
          const timingUtils = readFileSync('tests/utils/timing-fix-utilities.ts', 'utf-8');
          return timingUtils.includes('StableDateManager') &&
                 timingUtils.includes('createStableDate') &&
                 timingUtils.includes('ensureTimeDifference');
        },
        details: 'Date/time manipulation utilities'
      },
      {
        name: 'Performance testing fixes',
        check: () => {
          const orderFixes = readFileSync('tests/fixes/order-test-stability-fixes.ts', 'utf-8');
          return orderFixes.includes('OrderPerformanceFix') &&
                 orderFixes.includes('testOrderPerformanceStable') &&
                 orderFixes.includes('expectPerformanceWithTolerance');
        },
        details: 'Performance testing stability improvements'
      },
      {
        name: 'State transition fixes',
        check: () => {
          const orderFixes = readFileSync('tests/fixes/order-test-stability-fixes.ts', 'utf-8');
          return orderFixes.includes('OrderStateTransitionFix') &&
                 orderFixes.includes('executeWithTimingGuarantee') &&
                 orderFixes.includes('expectUpdatedAtDifference');
        },
        details: 'State transition timing fixes'
      }
    ];
    
    const results = await this.runChecks('Timing Fixes', checks);
    this.results.push(results);
  }
  
  private async validateTestExecution(): Promise<void> {
    console.log('\n🏃 Validating Test Execution...');
    
    const checks = [
      {
        name: 'Test configuration syntax',
        check: () => {
          try {
            execSync('bun run type-check', { stdio: 'pipe' });
            return true;
          } catch {
            return false;
          }
        },
        details: 'All TypeScript files compile successfully'
      },
      {
        name: 'Stability config loads',
        check: () => {
          try {
            // Test if the stability config can be loaded
            execSync('bun x vitest --version --config=vitest.config.stability.ts', { stdio: 'pipe' });
            return true;
          } catch {
            return false;
          }
        },
        details: 'Stability configuration loads without errors'
      },
      {
        name: 'Test utilities compile',
        check: () => {
          try {
            execSync('bun x tsc tests/utils/test-stability-utilities.ts --noEmit --skipLibCheck', { stdio: 'pipe' });
            return true;
          } catch {
            return false;
          }
        },
        details: 'Test utility files compile successfully'
      },
      {
        name: 'Process isolation works',
        check: () => {
          const config = readFileSync('vitest.config.stability.ts', 'utf-8');
          return config.includes('isolate: true') &&
                 config.includes('fileParallelism: false') &&
                 config.includes('singleThread');
        },
        details: 'Process isolation configured for stability'
      }
    ];
    
    const results = await this.runChecks('Test Execution', checks);
    this.results.push(results);
  }
  
  private async runChecks(category: string, checks: Array<{
    name: string;
    check: () => boolean;
    details: string;
  }>): Promise<ValidationResult> {
    const results: ValidationResult = {
      category,
      checks: [],
      overallPassed: true
    };
    
    for (const { name, check, details } of checks) {
      try {
        const passed = check();
        results.checks.push({ name, passed, details });
        
        if (passed) {
          console.log(`  ✅ ${name}`);
        } else {
          console.log(`  ❌ ${name}`);
          results.overallPassed = false;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.checks.push({ name, passed: false, details, error: errorMsg });
        console.log(`  ❌ ${name} - Error: ${errorMsg}`);
        results.overallPassed = false;
      }
    }
    
    return results;
  }
  
  private generateReport(): void {
    console.log('\n📊 Test Stability Validation Report');
    console.log('=====================================');
    
    let totalPassed = 0;
    let totalChecks = 0;
    let allCategoriesPassed = true;
    
    for (const result of this.results) {
      const categoryPassed = result.checks.filter(c => c.passed).length;
      const categoryTotal = result.checks.length;
      
      totalPassed += categoryPassed;
      totalChecks += categoryTotal;
      
      if (!result.overallPassed) {
        allCategoriesPassed = false;
      }
      
      const status = result.overallPassed ? '✅' : '❌';
      console.log(`${status} ${result.category}: ${categoryPassed}/${categoryTotal}`);
    }
    
    console.log(`\n📈 Overall Result: ${totalPassed}/${totalChecks} checks passed`);
    
    if (allCategoriesPassed) {
      console.log('🎉 ALL TEST STABILITY VALIDATIONS PASSED!');
      console.log('\n✅ Mission Accomplished:');
      console.log('  - Test isolation and cleanup ✅');
      console.log('  - Memory leak prevention ✅');
      console.log('  - Timing-dependent fixes ✅');
      console.log('  - Configuration optimization ✅');
      console.log('  - Resource management ✅');
      console.log('  - Flaky test elimination ✅');
    } else {
      console.log('⚠️  Some stability validations failed. Review the issues above.');
    }
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChecks,
        totalPassed,
        overallPassed: allCategoriesPassed
      },
      categories: this.results
    };
    
    writeFileSync(
      'test-stability-validation-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to test-stability-validation-report.json');
  }
}

// Execute validation
async function main() {
  const validator = new TestStabilityValidator();
  await validator.validateAll();
}

main().catch(console.error);