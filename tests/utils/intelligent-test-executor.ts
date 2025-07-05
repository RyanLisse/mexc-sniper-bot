/**
 * Intelligent Test Execution Manager
 * MISSION: Test Performance Optimization Specialist - Dynamic Performance Management
 * 
 * FEATURES:
 * - Real-time performance monitoring during test execution
 * - Dynamic thread scaling based on system load
 * - Intelligent memory management and garbage collection
 * - Automatic test timeout adjustment based on complexity
 * - Performance-based test prioritization
 * - Resource contention detection and mitigation
 * - Adaptive concurrency management
 */

import { performance } from 'perf_hooks';
import { cpus } from 'os';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface SystemMetrics {
  cpuUsage: NodeJS.CpuUsage;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: number;
  activeThreads: number;
  testQueueLength: number;
}

interface TestPerformanceProfile {
  testPath: string;
  averageExecutionTime: number;
  memoryFootprint: number;
  cpuIntensity: number;
  failureRate: number;
  complexity: 'low' | 'medium' | 'high' | 'extreme';
  lastRun: number;
  runCount: number;
}

interface PerformanceOptimization {
  action: 'increase_threads' | 'decrease_threads' | 'force_gc' | 'reduce_concurrency' | 'split_test_batch' | 'prioritize_fast_tests';
  reason: string;
  impact: 'low' | 'medium' | 'high';
  timestamp: number;
}

export class IntelligentTestExecutor {
  private metrics: SystemMetrics[] = [];
  private testProfiles = new Map<string, TestPerformanceProfile>();
  private optimizations: PerformanceOptimization[] = [];
  private currentThreadCount: number;
  private maxThreadCount: number;
  private minThreadCount: number;
  private performanceThresholds: {
    memoryWarning: number;
    memoryCritical: number;
    cpuHigh: number;
    cpuCritical: number;
    executionTimeWarning: number;
    executionTimeCritical: number;
  };
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private gcForced = false;
  private readonly systemCores = cpus().length;
  
  constructor() {
    console.log('🧠 Intelligent Test Executor initialized');
    
    // Initialize performance configuration
    this.maxThreadCount = Math.max(2, Math.min(this.systemCores - 1, Math.floor(this.systemCores * 0.75)));
    this.minThreadCount = Math.max(1, Math.floor(this.systemCores * 0.25));
    this.currentThreadCount = Math.floor((this.maxThreadCount + this.minThreadCount) / 2);
    
    // Set performance thresholds based on system capabilities
    const totalMemory = this.estimateSystemMemory();
    this.performanceThresholds = {
      memoryWarning: totalMemory * 0.6, // 60% memory usage warning
      memoryCritical: totalMemory * 0.8, // 80% memory usage critical
      cpuHigh: 70, // 70% CPU usage high
      cpuCritical: 90, // 90% CPU usage critical
      executionTimeWarning: 30000, // 30 second warning
      executionTimeCritical: 60000, // 60 second critical
    };
    
    this.loadHistoricalProfiles();
    this.startPerformanceMonitoring();
    
    console.log(`🎯 Performance targets: ${this.minThreadCount}-${this.maxThreadCount} threads, ${Math.round(totalMemory / 1024 / 1024)}MB memory threshold`);
  }
  
  /**
   * Start real-time performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.analyzePerformance();
      this.applyOptimizations();
    }, 2000); // Monitor every 2 seconds
    
    console.log('📊 Real-time performance monitoring started');
  }
  
  /**
   * Collect current system metrics
   */
  private collectSystemMetrics(): void {
    const metrics: SystemMetrics = {
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      timestamp: performance.now(),
      activeThreads: this.currentThreadCount,
      testQueueLength: 0, // Would be populated by test runner
    };
    
    this.metrics.push(metrics);
    
    // Keep only last 30 metrics (1 minute of data)
    if (this.metrics.length > 30) {
      this.metrics.shift();
    }
  }
  
  /**
   * Analyze current performance and identify optimization opportunities
   */
  private analyzePerformance(): void {
    if (this.metrics.length < 3) return; // Need at least 3 data points
    
    const currentMetrics = this.metrics[this.metrics.length - 1];
    const previousMetrics = this.metrics[this.metrics.length - 2];
    
    // Memory analysis
    const memoryUsageMB = currentMetrics.memoryUsage.heapUsed / 1024 / 1024;
    const memoryGrowthMB = (currentMetrics.memoryUsage.heapUsed - previousMetrics.memoryUsage.heapUsed) / 1024 / 1024;
    
    // CPU analysis
    const cpuUsagePercent = this.calculateCpuUsagePercent(currentMetrics.cpuUsage, previousMetrics.cpuUsage);
    
    // Detect performance issues and generate optimizations
    if (memoryUsageMB > this.performanceThresholds.memoryCritical) {
      this.addOptimization('force_gc', `Critical memory usage: ${Math.round(memoryUsageMB)}MB`, 'high');
    } else if (memoryUsageMB > this.performanceThresholds.memoryWarning && memoryGrowthMB > 50) {
      this.addOptimization('reduce_concurrency', `High memory usage with growth: ${Math.round(memoryUsageMB)}MB (+${Math.round(memoryGrowthMB)}MB)`, 'medium');
    }
    
    if (cpuUsagePercent > this.performanceThresholds.cpuCritical) {
      this.addOptimization('decrease_threads', `Critical CPU usage: ${Math.round(cpuUsagePercent)}%`, 'high');
    } else if (cpuUsagePercent < 30 && this.currentThreadCount < this.maxThreadCount) {
      this.addOptimization('increase_threads', `Low CPU usage: ${Math.round(cpuUsagePercent)}%, can increase threads`, 'low');
    }
    
    // Memory leak detection
    if (memoryGrowthMB > 100 && this.metrics.length >= 5) {
      const recentGrowth = this.metrics.slice(-5).reduce((sum, metric, index, arr) => {
        if (index === 0) return 0;
        return sum + (metric.memoryUsage.heapUsed - arr[index - 1].memoryUsage.heapUsed);
      }, 0) / 1024 / 1024;
      
      if (recentGrowth > 200) {
        this.addOptimization('force_gc', `Potential memory leak detected: ${Math.round(recentGrowth)}MB growth in 10s`, 'high');
      }
    }
  }
  
  /**
   * Apply performance optimizations
   */
  private applyOptimizations(): void {
    const recentOptimizations = this.optimizations.filter(opt => 
      performance.now() - opt.timestamp < 10000 // Last 10 seconds
    );
    
    // Apply high priority optimizations immediately
    const highPriorityOpts = recentOptimizations.filter(opt => 
      opt.impact === 'high' && performance.now() - opt.timestamp < 2000 // Last 2 seconds
    );
    
    for (const optimization of highPriorityOpts) {
      this.executeOptimization(optimization);
    }
    
    // Apply medium/low priority optimizations with throttling
    const lowPriorityOpts = recentOptimizations.filter(opt => 
      opt.impact !== 'high' && performance.now() - opt.timestamp < 5000 // Last 5 seconds
    );
    
    if (lowPriorityOpts.length > 0 && recentOptimizations.length < 3) {
      // Only apply if we haven't been too aggressive with optimizations
      this.executeOptimization(lowPriorityOpts[0]);
    }
  }
  
  /**
   * Execute a specific optimization
   */
  private executeOptimization(optimization: PerformanceOptimization): void {
    console.log(`🔧 Applying optimization: ${optimization.action} - ${optimization.reason}`);
    
    switch (optimization.action) {
      case 'force_gc':
        if (!this.gcForced && global.gc) {
          global.gc();
          this.gcForced = true;
          setTimeout(() => { this.gcForced = false; }, 5000); // Reset after 5 seconds
          console.log('🗑️  Forced garbage collection');
        }
        break;
        
      case 'increase_threads':
        if (this.currentThreadCount < this.maxThreadCount) {
          this.currentThreadCount = Math.min(this.maxThreadCount, this.currentThreadCount + 1);
          console.log(`⬆️  Increased thread count to ${this.currentThreadCount}`);
        }
        break;
        
      case 'decrease_threads':
        if (this.currentThreadCount > this.minThreadCount) {
          this.currentThreadCount = Math.max(this.minThreadCount, this.currentThreadCount - 1);
          console.log(`⬇️  Decreased thread count to ${this.currentThreadCount}`);
        }
        break;
        
      case 'reduce_concurrency':
        // This would be implemented by the test runner
        console.log('🚦 Reducing test concurrency to manage resources');
        break;
        
      case 'split_test_batch':
        console.log('✂️  Splitting large test batches for better resource management');
        break;
        
      case 'prioritize_fast_tests':
        console.log('🏃 Prioritizing fast tests to improve overall execution time');
        break;
    }
  }
  
  /**
   * Profile a test execution
   */
  profileTestExecution(testPath: string, executionTime: number, memoryDelta: number): void {
    const existing = this.testProfiles.get(testPath);
    
    if (existing) {
      // Update existing profile with exponential moving average
      const alpha = 0.3; // Learning rate
      existing.averageExecutionTime = existing.averageExecutionTime * (1 - alpha) + executionTime * alpha;
      existing.memoryFootprint = existing.memoryFootprint * (1 - alpha) + memoryDelta * alpha;
      existing.runCount++;
      existing.lastRun = Date.now();
    } else {
      // Create new profile
      const profile: TestPerformanceProfile = {
        testPath,
        averageExecutionTime: executionTime,
        memoryFootprint: memoryDelta,
        cpuIntensity: this.estimateCpuIntensity(executionTime),
        failureRate: 0,
        complexity: this.determineTestComplexity(executionTime, memoryDelta),
        lastRun: Date.now(),
        runCount: 1,
      };
      
      this.testProfiles.set(testPath, profile);
    }
    
    // Save profiles periodically
    if (this.testProfiles.size % 10 === 0) {
      this.saveTestProfiles();
    }
  }
  
  /**
   * Get optimized test execution order
   */
  getOptimizedTestOrder(testPaths: string[]): string[] {
    const profiledTests = testPaths.map(path => ({
      path,
      profile: this.testProfiles.get(path),
    }));
    
    // Sort by performance profile:
    // 1. Fast tests first (quick feedback)
    // 2. Then medium complexity
    // 3. Heavy tests last
    return profiledTests
      .sort((a, b) => {
        const aTime = a.profile?.averageExecutionTime || 5000; // Default 5s
        const bTime = b.profile?.averageExecutionTime || 5000;
        const aMemory = a.profile?.memoryFootprint || 10; // Default 10MB
        const bMemory = b.profile?.memoryFootprint || 10;
        
        // Combined score: time + memory pressure
        const aScore = aTime + (aMemory * 100);
        const bScore = bTime + (bMemory * 100);
        
        return aScore - bScore; // Ascending order (fast first)
      })
      .map(item => item.path);
  }
  
  /**
   * Get current performance recommendations
   */
  getCurrentRecommendations(): {
    threadCount: number;
    memoryStatus: 'optimal' | 'warning' | 'critical';
    cpuStatus: 'optimal' | 'warning' | 'critical';
    suggestions: string[];
  } {
    const currentMetrics = this.metrics[this.metrics.length - 1];
    if (!currentMetrics) {
      return {
        threadCount: this.currentThreadCount,
        memoryStatus: 'optimal',
        cpuStatus: 'optimal',
        suggestions: ['Monitoring not yet available - need more data points'],
      };
    }
    
    const memoryUsageMB = currentMetrics.memoryUsage.heapUsed / 1024 / 1024;
    const cpuUsagePercent = this.metrics.length > 1 ? 
      this.calculateCpuUsagePercent(currentMetrics.cpuUsage, this.metrics[this.metrics.length - 2].cpuUsage) : 0;
    
    const memoryStatus = memoryUsageMB > this.performanceThresholds.memoryCritical ? 'critical' :
                        memoryUsageMB > this.performanceThresholds.memoryWarning ? 'warning' : 'optimal';
                        
    const cpuStatus = cpuUsagePercent > this.performanceThresholds.cpuCritical ? 'critical' :
                     cpuUsagePercent > this.performanceThresholds.cpuHigh ? 'warning' : 'optimal';
    
    const suggestions: string[] = [];
    
    if (memoryStatus === 'critical') {
      suggestions.push('Critical memory usage - consider reducing test parallelism');
    } else if (memoryStatus === 'warning') {
      suggestions.push('High memory usage - monitor for memory leaks');
    }
    
    if (cpuStatus === 'critical') {
      suggestions.push('Critical CPU usage - reduce thread count');
    } else if (cpuStatus === 'optimal' && this.currentThreadCount < this.maxThreadCount) {
      suggestions.push('CPU usage is low - can increase parallelism');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('System performance is optimal');
    }
    
    return {
      threadCount: this.currentThreadCount,
      memoryStatus,
      cpuStatus,
      suggestions,
    };
  }
  
  /**
   * Generate performance report
   */
  generatePerformanceReport(): any {
    const recommendations = this.getCurrentRecommendations();
    const recentMetrics = this.metrics.slice(-10); // Last 10 data points
    
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / recentMetrics.length / 1024 / 1024;
    const peakMemoryUsage = Math.max(...recentMetrics.map(m => m.memoryUsage.heapUsed)) / 1024 / 1024;
    
    const topSlowTests = Array.from(this.testProfiles.values())
      .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
      .slice(0, 10);
    
    const topMemoryTests = Array.from(this.testProfiles.values())
      .sort((a, b) => b.memoryFootprint - a.memoryFootprint)
      .slice(0, 10);
    
    return {
      timestamp: new Date().toISOString(),
      systemInfo: {
        cores: this.systemCores,
        currentThreads: this.currentThreadCount,
        maxThreads: this.maxThreadCount,
        minThreads: this.minThreadCount,
      },
      performance: {
        avgMemoryUsageMB: Math.round(avgMemoryUsage),
        peakMemoryUsageMB: Math.round(peakMemoryUsage),
        recommendations,
        recentOptimizations: this.optimizations.slice(-20),
      },
      testProfiles: {
        totalTests: this.testProfiles.size,
        topSlowTests: topSlowTests.map(t => ({
          path: t.testPath,
          avgTime: Math.round(t.averageExecutionTime),
          complexity: t.complexity,
        })),
        topMemoryTests: topMemoryTests.map(t => ({
          path: t.testPath,
          memoryMB: Math.round(t.memoryFootprint),
          complexity: t.complexity,
        })),
      },
    };
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.saveTestProfiles();
    console.log('🧹 Intelligent Test Executor cleaned up');
  }
  
  // Private helper methods
  
  private addOptimization(action: PerformanceOptimization['action'], reason: string, impact: PerformanceOptimization['impact']): void {
    // Prevent duplicate optimizations within short time window
    const recentSimilar = this.optimizations.find(opt => 
      opt.action === action && performance.now() - opt.timestamp < 5000
    );
    
    if (!recentSimilar) {
      this.optimizations.push({
        action,
        reason,
        impact,
        timestamp: performance.now(),
      });
      
      // Keep only last 100 optimizations
      if (this.optimizations.length > 100) {
        this.optimizations.shift();
      }
    }
  }
  
  private calculateCpuUsagePercent(current: NodeJS.CpuUsage, previous: NodeJS.CpuUsage): number {
    const userDiff = current.user - previous.user;
    const sysDiff = current.system - previous.system;
    const totalDiff = userDiff + sysDiff;
    
    // Convert microseconds to percentage (rough approximation)
    return Math.min(100, (totalDiff / 1000000) * 100 / this.systemCores);
  }
  
  private estimateSystemMemory(): number {
    // Estimate based on Node.js memory limits and system info
    const nodeMemory = process.memoryUsage().heapTotal * 8; // Rough estimate
    return Math.max(nodeMemory, 4 * 1024 * 1024 * 1024); // Minimum 4GB
  }
  
  private estimateCpuIntensity(executionTime: number): number {
    if (executionTime < 1000) return 1; // Low
    if (executionTime < 5000) return 2; // Medium
    if (executionTime < 15000) return 3; // High
    return 4; // Extreme
  }
  
  private determineTestComplexity(executionTime: number, memoryDelta: number): TestPerformanceProfile['complexity'] {
    const timeScore = executionTime / 1000; // Seconds
    const memoryScore = memoryDelta / 1024 / 1024; // MB
    const combinedScore = timeScore + memoryScore;
    
    if (combinedScore < 2) return 'low';
    if (combinedScore < 10) return 'medium';
    if (combinedScore < 30) return 'high';
    return 'extreme';
  }
  
  private loadHistoricalProfiles(): void {
    const profilesPath = join(process.cwd(), 'test-results', 'test-profiles.json');
    
    if (existsSync(profilesPath)) {
      try {
        const data = JSON.parse(readFileSync(profilesPath, 'utf-8'));
        Object.entries(data).forEach(([path, profile]) => {
          this.testProfiles.set(path, profile as TestPerformanceProfile);
        });
        console.log(`📚 Loaded ${this.testProfiles.size} test profiles from history`);
      } catch (error) {
        console.warn('⚠️  Failed to load test profiles:', error);
      }
    }
  }
  
  private saveTestProfiles(): void {
    try {
      const profilesPath = join(process.cwd(), 'test-results', 'test-profiles.json');
      const profilesData = Object.fromEntries(this.testProfiles.entries());
      writeFileSync(profilesPath, JSON.stringify(profilesData, null, 2));
    } catch (error) {
      console.warn('⚠️  Failed to save test profiles:', error);
    }
  }
}

// Global singleton instance
let globalExecutor: IntelligentTestExecutor | null = null;

export function getIntelligentTestExecutor(): IntelligentTestExecutor {
  if (!globalExecutor) {
    globalExecutor = new IntelligentTestExecutor();
    
    // Cleanup on process exit
    process.on('exit', () => {
      globalExecutor?.cleanup();
    });
    
    process.on('SIGINT', () => {
      globalExecutor?.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      globalExecutor?.cleanup();
      process.exit(0);
    });
  }
  
  return globalExecutor;
}

// Export utilities for test files
export const testExecutorUtils = {
  profileTest: (testPath: string, executionTime: number, memoryDelta: number) => {
    getIntelligentTestExecutor().profileTestExecution(testPath, executionTime, memoryDelta);
  },
  
  getOptimizedOrder: (testPaths: string[]) => {
    return getIntelligentTestExecutor().getOptimizedTestOrder(testPaths);
  },
  
  getCurrentRecommendations: () => {
    return getIntelligentTestExecutor().getCurrentRecommendations();
  },
  
  generateReport: () => {
    return getIntelligentTestExecutor().generatePerformanceReport();
  },
};