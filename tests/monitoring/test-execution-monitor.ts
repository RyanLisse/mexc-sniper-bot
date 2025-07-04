/**
 * Test Execution Monitoring and Performance Analytics
 * MISSION: Test Configuration Optimization Agent - Execution Monitoring
 * 
 * FEATURES:
 * - Real-time test execution monitoring
 * - Performance analytics and metrics collection
 * - Test failure analysis and reporting
 * - Resource utilization tracking
 * - Test execution optimization recommendations
 * - Historical performance tracking
 */

import { cpus } from 'os';
import { performance } from 'perf_hooks';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface TestExecutionMetrics {
  testName: string;
  testType: 'unit' | 'integration' | 'performance' | 'e2e';
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  error?: string;
  retries?: number;
  threadId?: number;
  tags?: string[];
}

export interface TestSuiteMetrics {
  suiteId: string;
  environment: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  averageTestDuration: number;
  maxTestDuration: number;
  minTestDuration: number;
  memoryPeak: number;
  cpuUtilization: number;
  threadsUsed: number;
  cacheHitRate?: number;
  recommendations?: string[];
}

export interface PerformanceAnalytics {
  testExecutionHistory: TestExecutionMetrics[];
  suiteHistory: TestSuiteMetrics[];
  performanceTrends: {
    averageDuration: number[];
    successRate: number[];
    memoryUsage: number[];
    cpuUsage: number[];
    timestamps: string[];
  };
  bottlenecks: {
    slowestTests: TestExecutionMetrics[];
    memoryHeavyTests: TestExecutionMetrics[];
    failingTests: TestExecutionMetrics[];
  };
  optimizationSuggestions: string[];
}

export class TestExecutionMonitor {
  private metrics: TestExecutionMetrics[] = [];
  private suiteMetrics: TestSuiteMetrics | null = null;
  private startCpuUsage?: NodeJS.CpuUsage;
  private analytics: PerformanceAnalytics;
  private outputDir: string;

  constructor(outputDir = './test-results/monitoring') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
    this.analytics = this.loadHistoricalData();
    this.startCpuUsage = process.cpuUsage();
  }

  private ensureOutputDir(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private loadHistoricalData(): PerformanceAnalytics {
    const analyticsPath = join(this.outputDir, 'performance-analytics.json');
    
    if (existsSync(analyticsPath)) {
      try {
        const data = readFileSync(analyticsPath, 'utf-8');
        return JSON.parse(data);
      } catch (error) {
        console.warn('Failed to load historical analytics data:', error);
      }
    }

    return {
      testExecutionHistory: [],
      suiteHistory: [],
      performanceTrends: {
        averageDuration: [],
        successRate: [],
        memoryUsage: [],
        cpuUsage: [],
        timestamps: [],
      },
      bottlenecks: {
        slowestTests: [],
        memoryHeavyTests: [],
        failingTests: [],
      },
      optimizationSuggestions: [],
    };
  }

  /**
   * Start monitoring a test suite
   */
  startSuite(suiteId: string, environment: string): void {
    this.suiteMetrics = {
      suiteId,
      environment,
      startTime: performance.now(),
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsSkipped: 0,
      averageTestDuration: 0,
      maxTestDuration: 0,
      minTestDuration: Infinity,
      memoryPeak: 0,
      cpuUtilization: 0,
      threadsUsed: 1,
    };
  }

  /**
   * Start monitoring a test
   */
  startTest(testName: string, testType: TestExecutionMetrics['testType'], tags?: string[]): void {
    const metric: TestExecutionMetrics = {
      testName,
      testType,
      startTime: performance.now(),
      status: 'running',
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(this.startCpuUsage),
      threadId: this.getCurrentThreadId(),
      tags,
    };

    this.metrics.push(metric);
    this.updateSuiteMetrics();
  }

  /**
   * End monitoring a test
   */
  endTest(testName: string, status: 'passed' | 'failed' | 'skipped', error?: string): void {
    const metric = this.metrics.find(m => m.testName === testName && !m.endTime);
    
    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.status = status;
      metric.error = error;
      metric.memoryUsage = process.memoryUsage();
      metric.cpuUsage = process.cpuUsage(this.startCpuUsage);

      this.updateSuiteMetrics();
      this.detectBottlenecks(metric);
    }
  }

  /**
   * End monitoring a test suite
   */
  endSuite(): TestSuiteMetrics | null {
    if (!this.suiteMetrics) return null;

    this.suiteMetrics.endTime = performance.now();
    this.suiteMetrics.totalDuration = this.suiteMetrics.endTime - this.suiteMetrics.startTime;
    
    const completedTests = this.metrics.filter(m => m.duration !== undefined);
    if (completedTests.length > 0) {
      const durations = completedTests.map(m => m.duration!);
      this.suiteMetrics.averageTestDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      this.suiteMetrics.maxTestDuration = Math.max(...durations);
      this.suiteMetrics.minTestDuration = Math.min(...durations);
    }

    this.suiteMetrics.recommendations = this.generateRecommendations();
    
    // Add to historical data
    this.analytics.suiteHistory.push({ ...this.suiteMetrics });
    this.updatePerformanceTrends();
    
    this.saveMetrics();
    
    return this.suiteMetrics;
  }

  /**
   * Update suite-level metrics
   */
  private updateSuiteMetrics(): void {
    if (!this.suiteMetrics) return;

    const completedTests = this.metrics.filter(m => m.duration !== undefined);
    
    this.suiteMetrics.testsRun = this.metrics.length;
    this.suiteMetrics.testsPassed = completedTests.filter(m => m.status === 'passed').length;
    this.suiteMetrics.testsFailed = completedTests.filter(m => m.status === 'failed').length;
    this.suiteMetrics.testsSkipped = completedTests.filter(m => m.status === 'skipped').length;

    // Update memory peak
    const currentMemory = process.memoryUsage().heapUsed;
    this.suiteMetrics.memoryPeak = Math.max(this.suiteMetrics.memoryPeak, currentMemory);

    // Estimate threads used based on concurrent tests
    const runningTests = this.metrics.filter(m => m.status === 'running');
    this.suiteMetrics.threadsUsed = Math.max(this.suiteMetrics.threadsUsed, runningTests.length);
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottlenecks(metric: TestExecutionMetrics): void {
    const duration = metric.duration || 0;
    const memoryUsed = metric.memoryUsage?.heapUsed || 0;

    // Detect slow tests (> 5 seconds)
    if (duration > 5000) {
      this.analytics.bottlenecks.slowestTests.push(metric);
      this.analytics.bottlenecks.slowestTests.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      this.analytics.bottlenecks.slowestTests = this.analytics.bottlenecks.slowestTests.slice(0, 10);
    }

    // Detect memory-heavy tests (> 100MB)
    if (memoryUsed > 100 * 1024 * 1024) {
      this.analytics.bottlenecks.memoryHeavyTests.push(metric);
      this.analytics.bottlenecks.memoryHeavyTests.sort((a, b) => 
        (b.memoryUsage?.heapUsed || 0) - (a.memoryUsage?.heapUsed || 0)
      );
      this.analytics.bottlenecks.memoryHeavyTests = this.analytics.bottlenecks.memoryHeavyTests.slice(0, 10);
    }

    // Detect failing tests
    if (metric.status === 'failed') {
      this.analytics.bottlenecks.failingTests.push(metric);
      this.analytics.bottlenecks.failingTests = this.analytics.bottlenecks.failingTests.slice(-20);
    }
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.suiteMetrics) return recommendations;

    // Analyze test duration
    if (this.suiteMetrics.averageTestDuration > 2000) {
      recommendations.push('Consider optimizing slow tests or increasing parallelization');
    }

    // Analyze failure rate
    const failureRate = this.suiteMetrics.testsFailed / this.suiteMetrics.testsRun;
    if (failureRate > 0.1) {
      recommendations.push('High failure rate detected - review test stability');
    }

    // Analyze memory usage
    if (this.suiteMetrics.memoryPeak > 500 * 1024 * 1024) {
      recommendations.push('High memory usage detected - consider memory optimization');
    }

    // Analyze thread utilization
    const maxThreads = cpus().length;
    if (this.suiteMetrics.threadsUsed < maxThreads * 0.5) {
      recommendations.push('Low CPU utilization - consider increasing parallelization');
    }

    // Analyze test balance
    const testTypeDistribution = this.getTestTypeDistribution();
    if (testTypeDistribution.unit < 0.7) {
      recommendations.push('Consider increasing unit test coverage for faster feedback');
    }

    return recommendations;
  }

  /**
   * Get test type distribution
   */
  private getTestTypeDistribution(): Record<string, number> {
    const total = this.metrics.length;
    const distribution: Record<string, number> = {};
    
    for (const metric of this.metrics) {
      distribution[metric.testType] = (distribution[metric.testType] || 0) + 1;
    }
    
    // Convert to percentages
    for (const type in distribution) {
      distribution[type] = distribution[type] / total;
    }
    
    return distribution;
  }

  /**
   * Update performance trends
   */
  private updatePerformanceTrends(): void {
    if (!this.suiteMetrics) return;

    const trends = this.analytics.performanceTrends;
    const timestamp = new Date().toISOString();
    
    trends.averageDuration.push(this.suiteMetrics.averageTestDuration);
    trends.successRate.push(this.suiteMetrics.testsPassed / this.suiteMetrics.testsRun);
    trends.memoryUsage.push(this.suiteMetrics.memoryPeak);
    trends.cpuUsage.push(this.suiteMetrics.cpuUtilization);
    trends.timestamps.push(timestamp);

    // Keep only last 50 data points
    const maxDataPoints = 50;
    if (trends.timestamps.length > maxDataPoints) {
      trends.averageDuration = trends.averageDuration.slice(-maxDataPoints);
      trends.successRate = trends.successRate.slice(-maxDataPoints);
      trends.memoryUsage = trends.memoryUsage.slice(-maxDataPoints);
      trends.cpuUsage = trends.cpuUsage.slice(-maxDataPoints);
      trends.timestamps = trends.timestamps.slice(-maxDataPoints);
    }
  }

  /**
   * Get current thread ID (simplified)
   */
  private getCurrentThreadId(): number {
    return parseInt(process.env.VITEST_WORKER_ID || '0', 10);
  }

  /**
   * Save all metrics to files
   */
  private saveMetrics(): void {
    // Save current execution metrics
    const executionPath = join(this.outputDir, 'test-execution-metrics.json');
    writeFileSync(executionPath, JSON.stringify(this.metrics, null, 2));

    // Save suite metrics
    if (this.suiteMetrics) {
      const suitePath = join(this.outputDir, 'test-suite-metrics.json');
      writeFileSync(suitePath, JSON.stringify(this.suiteMetrics, null, 2));
    }

    // Save analytics
    const analyticsPath = join(this.outputDir, 'performance-analytics.json');
    writeFileSync(analyticsPath, JSON.stringify(this.analytics, null, 2));

    // Generate performance report
    this.generatePerformanceReport();
  }

  /**
   * Generate comprehensive performance report
   */
  private generatePerformanceReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.suiteMetrics,
      bottlenecks: this.analytics.bottlenecks,
      recommendations: this.suiteMetrics?.recommendations || [],
      trends: this.analytics.performanceTrends,
      testDistribution: this.getTestTypeDistribution(),
      performanceScore: this.calculatePerformanceScore(),
    };

    const reportPath = join(this.outputDir, 'performance-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate human-readable report
    this.generateHumanReadableReport(report);
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculatePerformanceScore(): number {
    if (!this.suiteMetrics) return 0;

    let score = 100;

    // Deduct for slow tests
    const avgDurationPenalty = Math.min(30, (this.suiteMetrics.averageTestDuration - 1000) / 100);
    score -= Math.max(0, avgDurationPenalty);

    // Deduct for failures
    const failureRate = this.suiteMetrics.testsFailed / this.suiteMetrics.testsRun;
    score -= failureRate * 50;

    // Deduct for memory issues
    const memoryPenalty = Math.min(20, (this.suiteMetrics.memoryPeak - 200 * 1024 * 1024) / (10 * 1024 * 1024));
    score -= Math.max(0, memoryPenalty);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate human-readable performance report
   */
  private generateHumanReadableReport(report: any): void {
    const lines: string[] = [];
    
    lines.push('# Test Performance Report');
    lines.push(`Generated: ${report.timestamp}`);
    lines.push('');
    
    if (report.summary) {
      lines.push('## Summary');
      lines.push(`- Tests Run: ${report.summary.testsRun}`);
      lines.push(`- Tests Passed: ${report.summary.testsPassed}`);
      lines.push(`- Tests Failed: ${report.summary.testsFailed}`);
      lines.push(`- Tests Skipped: ${report.summary.testsSkipped}`);
      lines.push(`- Average Duration: ${report.summary.averageTestDuration.toFixed(2)}ms`);
      lines.push(`- Max Duration: ${report.summary.maxTestDuration.toFixed(2)}ms`);
      lines.push(`- Memory Peak: ${(report.summary.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
      lines.push(`- Performance Score: ${report.performanceScore.toFixed(1)}/100`);
      lines.push('');
    }
    
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      report.recommendations.forEach((rec: string) => {
        lines.push(`- ${rec}`);
      });
      lines.push('');
    }
    
    if (report.bottlenecks.slowestTests.length > 0) {
      lines.push('## Slowest Tests');
      report.bottlenecks.slowestTests.slice(0, 5).forEach((test: TestExecutionMetrics) => {
        lines.push(`- ${test.testName}: ${test.duration?.toFixed(2)}ms`);
      });
      lines.push('');
    }

    const reportPath = join(this.outputDir, 'performance-report.md');
    writeFileSync(reportPath, lines.join('\n'));
  }

  /**
   * Get current metrics
   */
  getMetrics(): TestExecutionMetrics[] {
    return this.metrics;
  }

  /**
   * Get analytics data
   */
  getAnalytics(): PerformanceAnalytics {
    return this.analytics;
  }
}

/**
 * Global test execution monitor instance
 */
export const testExecutionMonitor = new TestExecutionMonitor();

/**
 * Vitest plugin for automatic monitoring
 */
export function createTestMonitorPlugin(environment: string = 'test') {
  return {
    name: 'test-execution-monitor',
    configureServer() {
      testExecutionMonitor.startSuite(`suite-${Date.now()}`, environment);
    },
    buildStart() {
      console.log('🔍 Test execution monitoring started');
    },
    buildEnd() {
      const metrics = testExecutionMonitor.endSuite();
      if (metrics) {
        console.log(`📊 Test suite completed: ${metrics.testsPassed}/${metrics.testsRun} passed`);
        console.log(`⏱️  Average test duration: ${metrics.averageTestDuration.toFixed(2)}ms`);
        
        if (metrics.recommendations && metrics.recommendations.length > 0) {
          console.log('💡 Recommendations:');
          metrics.recommendations.forEach(rec => console.log(`   - ${rec}`));
        }
      }
    },
  };
}