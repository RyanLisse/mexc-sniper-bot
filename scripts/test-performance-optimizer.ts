#!/usr/bin/env bun
/**
 * Test Performance Optimizer
 * MISSION: Test Performance Optimization Agent - Automated Performance Tuning
 * 
 * FEATURES:
 * - Real-time performance monitoring and bottleneck detection
 * - Automatic configuration switching based on performance metrics
 * - Memory usage tracking and optimization
 * - CPU utilization monitoring
 * - Test execution time analysis
 * - Automatic retry with different configurations on timeout
 * - Performance reporting and recommendations
 */

import { spawn, ChildProcess } from 'child_process';
import { cpus } from 'os';
import { performance } from 'perf_hooks';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  testType: string;
  configUsed: string;
  success: boolean;
  errorMessage?: string;
  testsRun: number;
  testsSkipped: number;
  testsFailed: number;
}

interface OptimizationRecommendation {
  issue: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  estimatedSpeedup: string;
}

class TestPerformanceOptimizer {
  private metrics: PerformanceMetrics[] = [];
  private currentProcess: ChildProcess | null = null;
  private readonly cpuCount = cpus().length;
  private readonly maxExecutionTime = 300000; // 5 minutes max
  private readonly timeoutThreshold = 30000; // 30 seconds for unit tests
  
  constructor() {
    console.log('🚀 Test Performance Optimizer initialized');
    console.log(`💻 System: ${this.cpuCount} CPU cores detected`);
  }
  
  /**
   * Run tests with performance monitoring and automatic optimization
   */
  async runOptimizedTests(testType: string = 'unit', maxRetries: number = 3): Promise<void> {
    console.log(`\n📊 Starting optimized test execution for: ${testType}`);
    
    // Try different configurations in order of performance
    const configurations = this.getConfigurationPriority(testType);
    
    let lastError: string | undefined;
    let attempt = 0;
    
    for (const config of configurations) {
      if (attempt >= maxRetries) {
        console.log(`❌ Maximum retry attempts (${maxRetries}) reached`);
        break;
      }
      
      attempt++;
      console.log(`\n🔄 Attempt ${attempt}/${maxRetries} using configuration: ${config}`);
      
      const result = await this.runTestWithConfig(testType, config);
      
      if (result.success) {
        console.log(`✅ Tests completed successfully with ${config}`);
        await this.generatePerformanceReport();
        return;
      } else {
        console.log(`❌ Configuration ${config} failed: ${result.errorMessage}`);
        lastError = result.errorMessage;
        
        // If timeout occurred, try next configuration immediately
        if (result.errorMessage?.includes('timeout') || result.errorMessage?.includes('SIGTERM')) {
          console.log(`⏰ Timeout detected, switching to next configuration...`);
          continue;
        }
      }
    }
    
    console.log(`\n💥 All configurations failed. Last error: ${lastError}`);
    await this.generateFailureReport(lastError);
    process.exit(1);
  }
  
  /**
   * Run tests with a specific configuration and monitor performance
   */
  private async runTestWithConfig(testType: string, configName: string): Promise<PerformanceMetrics> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();
    
    const metrics: PerformanceMetrics = {
      startTime,
      memoryUsage: startMemory,
      cpuUsage: startCpu,
      testType,
      configUsed: configName,
      success: false,
      testsRun: 0,
      testsSkipped: 0,
      testsFailed: 0,
    };
    
    console.log(`⚡ Memory usage at start: ${Math.round(startMemory.heapUsed / 1024 / 1024)}MB`);
    
    try {
      const result = await this.executeTestCommand(testType, configName);
      
      metrics.endTime = performance.now();
      metrics.duration = metrics.endTime - startTime;
      metrics.success = result.exitCode === 0;
      metrics.testsRun = this.parseTestCount(result.output, 'passed') + this.parseTestCount(result.output, 'failed');
      metrics.testsFailed = this.parseTestCount(result.output, 'failed');
      metrics.testsSkipped = this.parseTestCount(result.output, 'skipped');
      
      if (!metrics.success) {
        metrics.errorMessage = result.output;
      }
      
      console.log(`⏱️  Execution time: ${Math.round(metrics.duration)}ms`);
      console.log(`🧪 Tests: ${metrics.testsRun} run, ${metrics.testsFailed} failed, ${metrics.testsSkipped} skipped`);
      
    } catch (error) {
      metrics.endTime = performance.now();
      metrics.duration = metrics.endTime - startTime;
      metrics.success = false;
      metrics.errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`💥 Test execution failed after ${Math.round(metrics.duration)}ms`);
    }
    
    this.metrics.push(metrics);
    return metrics;
  }
  
  /**
   * Execute test command with timeout handling
   */
  private executeTestCommand(testType: string, configName: string): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve, reject) => {
      const configMap: Record<string, string> = {
        'optimized': 'vitest.config.optimized.ts',
        'performance': 'vitest.config.performance.ts',
        'master': 'vitest.config.master.ts',
        'unified': 'vitest.config.unified.ts',
      };
      
      const configFile = configMap[configName] || 'vitest.config.master.ts';
      const command = 'bun';
      const args = ['vitest', 'run', `--config=${configFile}`];
      
      // Set environment variables
      const env = {
        ...process.env,
        TEST_TYPE: testType,
        NODE_OPTIONS: '--max-old-space-size=4096 --expose-gc',
        UV_THREADPOOL_SIZE: String(this.cpuCount + 4),
        FORCE_COLOR: '1',
      };
      
      console.log(`🔧 Command: ${command} ${args.join(' ')}`);
      
      let output = '';
      let hasTimedOut = false;
      
      this.currentProcess = spawn(command, args, { 
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });
      
      // Set up timeout
      const timeout = setTimeout(() => {
        hasTimedOut = true;
        console.log(`⏰ Test execution timed out after ${this.maxExecutionTime}ms`);
        if (this.currentProcess && !this.currentProcess.killed) {
          this.currentProcess.kill('SIGTERM');
          setTimeout(() => {
            if (this.currentProcess && !this.currentProcess.killed) {
              this.currentProcess.kill('SIGKILL');
            }
          }, 5000);
        }
      }, this.maxExecutionTime);
      
      // Capture output
      this.currentProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        process.stdout.write(chunk); // Real-time output
      });
      
      this.currentProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        process.stderr.write(chunk); // Real-time error output
      });
      
      this.currentProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (hasTimedOut) {
          reject(new Error(`Test execution timed out after ${this.maxExecutionTime}ms`));
        } else {
          resolve({ exitCode: code || 0, output });
        }
      });
      
      this.currentProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  /**
   * Get configuration priority based on test type and historical performance
   */
  private getConfigurationPriority(testType: string): string[] {
    // Get historical performance data
    const historicalPerformance = this.getHistoricalPerformance(testType);
    
    // Default priority order
    let priority: string[] = [];
    
    switch (testType) {
      case 'performance':
        priority = ['optimized', 'performance', 'master'];
        break;
      case 'integration':
        priority = ['optimized', 'master', 'unified'];
        break;
      case 'unit':
      default:
        priority = ['optimized', 'master', 'unified', 'performance'];
        break;
    }
    
    // Reorder based on historical success rates
    if (historicalPerformance.length > 0) {
      priority.sort((a, b) => {
        const aSuccess = historicalPerformance.filter(m => m.configUsed === a && m.success).length;
        const bSuccess = historicalPerformance.filter(m => m.configUsed === b && m.success).length;
        return bSuccess - aSuccess; // Higher success rate first
      });
    }
    
    return priority;
  }
  
  /**
   * Parse test count from vitest output
   */
  private parseTestCount(output: string, type: 'passed' | 'failed' | 'skipped'): number {
    const regex = new RegExp(`(\\d+)\\s+${type}`, 'i');
    const match = output.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  /**
   * Get historical performance data
   */
  private getHistoricalPerformance(testType: string): PerformanceMetrics[] {
    const historyFile = join(process.cwd(), 'test-results', 'performance-history.json');
    
    if (!existsSync(historyFile)) {
      return [];
    }
    
    try {
      const data = JSON.parse(readFileSync(historyFile, 'utf-8'));
      return data.filter((m: PerformanceMetrics) => m.testType === testType);
    } catch {
      return [];
    }
  }
  
  /**
   * Generate comprehensive performance report
   */
  private async generatePerformanceReport(): Promise<void> {
    console.log('\n📈 Generating Performance Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      systemInfo: {
        cpuCores: this.cpuCount,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      metrics: this.metrics,
      recommendations: this.generateRecommendations(),
      summary: this.generateSummary(),
    };
    
    // Save detailed report
    const reportFile = join(process.cwd(), 'test-results', `performance-report-${Date.now()}.json`);
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    // Update historical data
    this.updateHistoricalData();
    
    // Print summary
    this.printSummary(report);
    
    console.log(`📄 Detailed report saved to: ${reportFile}`);
  }
  
  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const successfulRuns = this.metrics.filter(m => m.success);
    const failedRuns = this.metrics.filter(m => !m.success);
    
    if (failedRuns.length > 0) {
      failedRuns.forEach(run => {
        if (run.errorMessage?.includes('timeout')) {
          recommendations.push({
            issue: `Timeout in ${run.configUsed} configuration`,
            recommendation: 'Increase timeout values or reduce test parallelism',
            priority: 'high',
            estimatedSpeedup: '50-80%',
          });
        }
        
        if (run.errorMessage?.includes('ENOMEM') || run.errorMessage?.includes('memory')) {
          recommendations.push({
            issue: 'Memory exhaustion detected',
            recommendation: 'Reduce maxThreads or increase heap size',
            priority: 'high',
            estimatedSpeedup: '30-60%',
          });
        }
      });
    }
    
    if (successfulRuns.length > 0) {
      const avgDuration = successfulRuns.reduce((sum, run) => sum + (run.duration || 0), 0) / successfulRuns.length;
      
      if (avgDuration > 60000) { // > 1 minute
        recommendations.push({
          issue: 'Test execution time exceeds 1 minute',
          recommendation: 'Consider test sharding or increased parallelization',
          priority: 'medium',
          estimatedSpeedup: '20-40%',
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Generate performance summary
   */
  private generateSummary() {
    const successfulRuns = this.metrics.filter(m => m.success);
    const totalTests = this.metrics.reduce((sum, m) => sum + m.testsRun, 0);
    const totalFailures = this.metrics.reduce((sum, m) => sum + m.testsFailed, 0);
    const avgDuration = successfulRuns.length > 0 
      ? successfulRuns.reduce((sum, m) => sum + (m.duration || 0), 0) / successfulRuns.length 
      : 0;
    
    return {
      totalAttempts: this.metrics.length,
      successfulAttempts: successfulRuns.length,
      totalTests,
      totalFailures,
      successRate: successfulRuns.length / this.metrics.length,
      averageDuration: Math.round(avgDuration),
      fastestConfig: successfulRuns.length > 0 
        ? successfulRuns.sort((a, b) => (a.duration || 0) - (b.duration || 0))[0].configUsed
        : 'none',
    };
  }
  
  /**
   * Update historical performance data
   */
  private updateHistoricalData(): void {
    const historyFile = join(process.cwd(), 'test-results', 'performance-history.json');
    let history: PerformanceMetrics[] = [];
    
    if (existsSync(historyFile)) {
      try {
        history = JSON.parse(readFileSync(historyFile, 'utf-8'));
      } catch {
        history = [];
      }
    }
    
    // Add current metrics
    history.push(...this.metrics);
    
    // Keep only last 100 entries per test type
    const testTypes = [...new Set(history.map(m => m.testType))];
    const trimmedHistory: PerformanceMetrics[] = [];
    
    testTypes.forEach(testType => {
      const typeMetrics = history
        .filter(m => m.testType === testType)
        .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
        .slice(0, 100);
      trimmedHistory.push(...typeMetrics);
    });
    
    writeFileSync(historyFile, JSON.stringify(trimmedHistory, null, 2));
  }
  
  /**
   * Print performance summary to console
   */
  private printSummary(report: any): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE OPTIMIZATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`📈 Success Rate: ${Math.round(report.summary.successRate * 100)}%`);
    console.log(`⏱️  Average Duration: ${report.summary.averageDuration}ms`);
    console.log(`🧪 Total Tests: ${report.summary.totalTests}`);
    console.log(`❌ Total Failures: ${report.summary.totalFailures}`);
    console.log(`🏆 Fastest Config: ${report.summary.fastestConfig}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n🔧 OPTIMIZATION RECOMMENDATIONS:');
      report.recommendations.forEach((rec: OptimizationRecommendation, i: number) => {
        const priority = rec.priority === 'high' ? '🔥' : rec.priority === 'medium' ? '⚠️' : 'ℹ️';
        console.log(`${priority} ${i + 1}. ${rec.issue}`);
        console.log(`   💡 ${rec.recommendation}`);
        console.log(`   📈 Estimated speedup: ${rec.estimatedSpeedup}`);
      });
    }
    
    console.log('='.repeat(60));
  }
  
  /**
   * Generate failure report
   */
  private async generateFailureReport(lastError?: string): Promise<void> {
    console.log('\n💥 Generating Failure Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      systemInfo: {
        cpuCores: this.cpuCount,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      attempts: this.metrics,
      lastError,
      recommendations: this.generateFailureRecommendations(),
    };
    
    const reportFile = join(process.cwd(), 'test-results', `failure-report-${Date.now()}.json`);
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Failure report saved to: ${reportFile}`);
  }
  
  /**
   * Generate failure-specific recommendations
   */
  private generateFailureRecommendations(): OptimizationRecommendation[] {
    return [
      {
        issue: 'All test configurations failed',
        recommendation: 'Check for syntax errors, missing dependencies, or environment issues',
        priority: 'high',
        estimatedSpeedup: 'N/A',
      },
      {
        issue: 'Possible system resource constraints',
        recommendation: 'Try running with fewer parallel workers or increase system resources',
        priority: 'high',
        estimatedSpeedup: 'N/A',
      },
      {
        issue: 'Configuration conflicts detected',
        recommendation: 'Review vitest configuration files for conflicting settings',
        priority: 'medium',
        estimatedSpeedup: 'N/A',
      },
    ];
  }
  
  /**
   * Handle graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down test optimizer...');
    
    if (this.currentProcess && !this.currentProcess.killed) {
      console.log('⏹️  Terminating current test process...');
      this.currentProcess.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!this.currentProcess.killed) {
        this.currentProcess.kill('SIGKILL');
      }
    }
    
    console.log('✅ Test optimizer shutdown complete');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'unit';
  const maxRetries = parseInt(args[1] || '3', 10);
  
  const optimizer = new TestPerformanceOptimizer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await optimizer.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await optimizer.shutdown();
    process.exit(0);
  });
  
  try {
    await optimizer.runOptimizedTests(testType, maxRetries);
    console.log('\n🎉 Test optimization completed successfully!');
  } catch (error) {
    console.error('\n💥 Test optimization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { TestPerformanceOptimizer };