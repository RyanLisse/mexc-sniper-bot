#!/usr/bin/env bun

/**
 * Test Performance Monitoring Script
 * MISSION: Test Timeout & Performance Optimization Agent
 * 
 * Validates timeout optimizations and tracks performance improvements
 */

import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  duration: number;
  status: 'passed' | 'failed' | 'timeout';
  timeoutThreshold: number;
  details?: string;
}

interface PerformanceReport {
  timestamp: string;
  totalDuration: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  testsTimedOut: number;
  averageTestTime: number;
  slowestTest: TestResult | null;
  fastestTest: TestResult | null;
  results: TestResult[];
  optimizationStatus: 'success' | 'warning' | 'failure';
  recommendations: string[];
}

class TestPerformanceMonitor {
  private results: TestResult[] = [];
  private startTime = 0;

  async runTestSuite(testName: string, command: string, timeoutMs: number): Promise<TestResult> {
    console.log(`🚀 Running ${testName} (timeout: ${timeoutMs}ms)...`);
    
    const start = Date.now();
    
    return new Promise((resolve) => {
      const child = spawn('bun', ['run', command], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      // Timeout handler
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        const duration = Date.now() - start;
        console.log(`❌ ${testName} timed out after ${duration}ms`);
        resolve({
          name: testName,
          duration,
          status: 'timeout',
          timeoutThreshold: timeoutMs,
          details: `Test exceeded ${timeoutMs}ms timeout`
        });
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - start;
        const status = code === 0 ? 'passed' : 'failed';
        
        const emoji = status === 'passed' ? '✅' : '❌';
        console.log(`${emoji} ${testName} ${status} in ${duration}ms`);

        resolve({
          name: testName,
          duration,
          status,
          timeoutThreshold: timeoutMs,
          details: code !== 0 ? errorOutput.slice(-200) : undefined
        });
      });
    });
  }

  async runOptimizedTestSuite(): Promise<PerformanceReport> {
    console.log('🎯 Starting Test Performance Monitoring...\n');
    this.startTime = Date.now();

    // Test configurations with optimized timeouts
    const testConfigs = [
      { name: 'Unit Tests (Fast)', command: 'test:fast:unit', timeout: 5000 },
      { name: 'MexcRetryService Tests', command: 'test:retry-service', timeout: 8000 },
      { name: 'ValueObject Performance', command: 'test:value-object', timeout: 3000 },
      { name: 'Integration Tests (Optimized)', command: 'test:fast:integration', timeout: 25000 },
      { name: 'Quick Test Suite', command: 'test:fast:parallel', timeout: 10000 }
    ];

    // Run all test configurations
    for (const config of testConfigs) {
      try {
        const result = await this.runTestSuite(config.name, config.command, config.timeout);
        this.results.push(result);
      } catch (error) {
        console.error(`Error running ${config.name}:`, error);
        this.results.push({
          name: config.name,
          duration: config.timeout,
          status: 'failed',
          timeoutThreshold: config.timeout,
          details: `Error: ${error}`
        });
      }
    }

    return this.generateReport();
  }

  private generateReport(): PerformanceReport {
    const totalDuration = Date.now() - this.startTime;
    const testsRun = this.results.length;
    const testsPassed = this.results.filter(r => r.status === 'passed').length;
    const testsFailed = this.results.filter(r => r.status === 'failed').length;
    const testsTimedOut = this.results.filter(r => r.status === 'timeout').length;

    const durations = this.results.map(r => r.duration);
    const averageTestTime = durations.reduce((a, b) => a + b, 0) / durations.length;

    const slowestTest = this.results.reduce((prev, current) => 
      (prev.duration > current.duration) ? prev : current
    );

    const fastestTest = this.results.reduce((prev, current) => 
      (prev.duration < current.duration) ? prev : current
    );

    // Determine optimization status
    let optimizationStatus: 'success' | 'warning' | 'failure' = 'success';
    const recommendations: string[] = [];

    if (testsTimedOut > 0) {
      optimizationStatus = 'failure';
      recommendations.push(`${testsTimedOut} tests timed out - increase timeout values or optimize test performance`);
    }

    if (averageTestTime > 15000) {
      optimizationStatus = optimizationStatus === 'failure' ? 'failure' : 'warning';
      recommendations.push('Average test time exceeds 15 seconds - consider further optimization');
    }

    if (slowestTest.duration > 30000) {
      optimizationStatus = optimizationStatus === 'failure' ? 'failure' : 'warning';
      recommendations.push(`Slowest test (${slowestTest.name}) took ${slowestTest.duration}ms - consider breaking into smaller tests`);
    }

    // Add success recommendations
    if (optimizationStatus === 'success') {
      recommendations.push('All tests completed within acceptable timeouts');
      recommendations.push('Performance optimization targets achieved');
    }

    return {
      timestamp: new Date().toISOString(),
      totalDuration,
      testsRun,
      testsPassed,
      testsFailed,
      testsTimedOut,
      averageTestTime: Math.round(averageTestTime),
      slowestTest,
      fastestTest,
      results: this.results,
      optimizationStatus,
      recommendations
    };
  }

  private saveReport(report: PerformanceReport): void {
    const reportsDir = join(process.cwd(), 'test-results');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-performance-report-${timestamp}.json`;
    const filepath = join(reportsDir, filename);

    writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`📊 Performance report saved to: ${filepath}`);
  }

  private printSummary(report: PerformanceReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 TEST TIMEOUT & PERFORMANCE OPTIMIZATION REPORT');
    console.log('='.repeat(60));

    const statusEmoji = {
      success: '✅',
      warning: '⚠️',
      failure: '❌'
    }[report.optimizationStatus];

    console.log(`\n${statusEmoji} Overall Status: ${report.optimizationStatus.toUpperCase()}`);
    console.log(`⏱️  Total Duration: ${report.totalDuration}ms`);
    console.log(`📊 Tests Run: ${report.testsRun}`);
    console.log(`✅ Tests Passed: ${report.testsPassed}`);
    console.log(`❌ Tests Failed: ${report.testsFailed}`);
    console.log(`⏰ Tests Timed Out: ${report.testsTimedOut}`);
    console.log(`📈 Average Test Time: ${report.averageTestTime}ms`);
    
    if (report.slowestTest) {
      console.log(`🐌 Slowest Test: ${report.slowestTest.name} (${report.slowestTest.duration}ms)`);
    }
    
    if (report.fastestTest) {
      console.log(`🚀 Fastest Test: ${report.fastestTest.name} (${report.fastestTest.duration}ms)`);
    }

    console.log('\n📋 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    console.log('\n📊 DETAILED RESULTS:');
    report.results.forEach(result => {
      const statusEmoji = {
        passed: '✅',
        failed: '❌',
        timeout: '⏰'
      }[result.status];
      
      const efficiency = ((result.timeoutThreshold - result.duration) / result.timeoutThreshold * 100).toFixed(1);
      console.log(`  ${statusEmoji} ${result.name}: ${result.duration}ms (${efficiency}% under timeout)`);
    });

    console.log('\n' + '='.repeat(60));
  }

  async run(): Promise<void> {
    try {
      const report = await this.runOptimizedTestSuite();
      this.saveReport(report);
      this.printSummary(report);

      // Exit with appropriate code
      if (report.optimizationStatus === 'failure') {
        console.log('\n❌ Test performance optimization FAILED');
        process.exit(1);
      } else if (report.optimizationStatus === 'warning') {
        console.log('\n⚠️ Test performance optimization completed with WARNINGS');
        process.exit(0);
      } else {
        console.log('\n✅ Test performance optimization SUCCESSFUL');
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Error during test performance monitoring:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.main) {
  const monitor = new TestPerformanceMonitor();
  monitor.run();
}

export { TestPerformanceMonitor };