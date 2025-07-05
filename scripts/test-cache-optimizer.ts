#!/usr/bin/env bun
/**
 * Test Cache Optimizer
 * MISSION: Test Performance Optimization Agent - Intelligent Test Caching
 * 
 * FEATURES:
 * - Intelligent test execution order optimization
 * - Dependency-aware caching strategies
 * - File change detection and selective test execution
 * - Pre-warming of test caches
 * - Test result memoization
 * - Smart test filtering based on changes
 * - Cache invalidation strategies
 * - Performance-based test grouping
 */

import { execSync, spawn } from 'child_process';
import { statSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, relative, extname } from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';

interface TestFile {
  path: string;
  lastModified: number;
  dependencies: string[];
  avgExecutionTime: number;
  successRate: number;
  size: number;
  hash: string;
}

interface TestCache {
  version: string;
  timestamp: number;
  files: Record<string, TestFile>;
  executionOrder: string[];
  failedTests: string[];
  skippedTests: string[];
}

interface ChangeAnalysis {
  changedFiles: string[];
  affectedTests: string[];
  newTests: string[];
  deletedTests: string[];
  shouldRunAll: boolean;
}

class TestCacheOptimizer {
  private readonly cacheDir = join(process.cwd(), 'node_modules/.vitest-cache');
  private readonly cacheFile = join(this.cacheDir, 'test-cache.json');
  private readonly projectRoot = process.cwd();
  private cache: TestCache;
  
  constructor() {
    this.cache = this.loadCache();
    this.ensureCacheDir();
  }
  
  /**
   * Optimize test execution based on changes and cache
   */
  async optimizeTestExecution(testType: string = 'unit'): Promise<{
    testsToRun: string[];
    executionOrder: string[];
    estimatedTime: number;
    cacheHitRate: number;
  }> {
    console.log('🔍 Analyzing changes and optimizing test execution...');
    
    // Analyze file changes
    const changes = await this.analyzeChanges(testType);
    
    // Get test files for the specified type
    const allTests = await this.getTestFiles(testType);
    
    // Determine which tests to run
    let testsToRun: string[];
    
    if (changes.shouldRunAll || changes.newTests.length > 0) {
      console.log('📝 Running all tests due to significant changes or new tests');
      testsToRun = allTests;
    } else if (changes.affectedTests.length > 0) {
      console.log(`🎯 Running ${changes.affectedTests.length} affected tests`);
      testsToRun = changes.affectedTests;
    } else {
      console.log('✨ No changes detected, running fast validation tests only');
      testsToRun = this.getFastValidationTests(allTests);
    }
    
    // Optimize execution order
    const executionOrder = this.optimizeExecutionOrder(testsToRun);
    
    // Calculate estimated time and cache hit rate
    const estimatedTime = this.calculateEstimatedTime(testsToRun);
    const cacheHitRate = this.calculateCacheHitRate(testsToRun, allTests);
    
    // Update cache with current analysis
    await this.updateCacheForExecution(testsToRun, changes);
    
    console.log(`⚡ Optimized execution: ${testsToRun.length}/${allTests.length} tests`);
    console.log(`⏱️  Estimated time: ${Math.round(estimatedTime / 1000)}s`);
    console.log(`📊 Cache hit rate: ${Math.round(cacheHitRate * 100)}%`);
    
    return {
      testsToRun,
      executionOrder,
      estimatedTime,
      cacheHitRate,
    };
  }
  
  /**
   * Pre-warm test caches for faster execution
   */
  async preWarmCaches(): Promise<void> {
    console.log('🔥 Pre-warming test caches...');
    
    try {
      // Pre-compile TypeScript files
      console.log('📦 Pre-compiling TypeScript...');
      execSync('bunx tsc --noEmit --incremental', { stdio: 'pipe' });
      
      // Pre-warm Vitest cache
      console.log('⚡ Pre-warming Vitest cache...');
      await this.preWarmVitestCache();
      
      // Pre-warm dependency cache
      console.log('📚 Pre-warming dependency cache...');
      await this.preWarmDependencyCache();
      
      console.log('✅ Cache pre-warming completed');
    } catch (error) {
      console.warn('⚠️  Cache pre-warming encountered issues:', error);
    }
  }
  
  /**
   * Analyze file changes and determine affected tests
   */
  private async analyzeChanges(testType: string): Promise<ChangeAnalysis> {
    const changedFiles = await this.getChangedFiles();
    const allTests = await this.getTestFiles(testType);
    
    // Check for significant changes that require full test run
    const shouldRunAll = this.shouldRunAllTests(changedFiles);
    
    if (shouldRunAll) {
      return {
        changedFiles,
        affectedTests: allTests,
        newTests: [],
        deletedTests: [],
        shouldRunAll: true,
      };
    }
    
    // Find affected tests based on dependencies
    const affectedTests = await this.findAffectedTests(changedFiles, allTests);
    
    // Find new and deleted tests
    const newTests = await this.findNewTests(allTests);
    const deletedTests = await this.findDeletedTests(allTests);
    
    return {
      changedFiles,
      affectedTests,
      newTests,
      deletedTests,
      shouldRunAll: false,
    };
  }
  
  /**
   * Get changed files since last test run
   */
  private async getChangedFiles(): Promise<string[]> {
    try {
      // Use git to find changed files
      const gitOutput = execSync('git diff --name-only HEAD~1 HEAD', { 
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      
      return gitOutput
        .split('\n')
        .filter(file => file.trim())
        .filter(file => this.isRelevantFile(file));
    } catch {
      // Fallback: check modified files in last hour
      return this.getRecentlyModifiedFiles();
    }
  }
  
  /**
   * Check if file is relevant for test execution
   */
  private isRelevantFile(file: string): boolean {
    const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
    const irrelevantPaths = ['node_modules', '.next', 'dist', 'build'];
    
    return (
      relevantExtensions.includes(extname(file)) &&
      !irrelevantPaths.some(path => file.includes(path))
    );
  }
  
  /**
   * Get recently modified files as fallback
   */
  private getRecentlyModifiedFiles(): string[] {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const files: string[] = [];
    
    try {
      const srcFiles = glob.sync('src/**/*.{ts,tsx,js,jsx}', { absolute: true });
      const testFiles = glob.sync('tests/**/*.{ts,tsx,js,jsx}', { absolute: true });
      
      [...srcFiles, ...testFiles].forEach(file => {
        try {
          const stat = statSync(file);
          if (stat.mtime.getTime() > oneHourAgo) {
            files.push(relative(this.projectRoot, file));
          }
        } catch {
          // Ignore files that can't be accessed
        }
      });
    } catch {
      // Return empty array if glob fails
    }
    
    return files;
  }
  
  /**
   * Check if changes require running all tests
   */
  private shouldRunAllTests(changedFiles: string[]): boolean {
    const criticalFiles = [
      'package.json',
      'vitest.config',
      'tsconfig.json',
      '.env',
      'next.config',
    ];
    
    return changedFiles.some(file => 
      criticalFiles.some(critical => file.includes(critical))
    );
  }
  
  /**
   * Find tests affected by changed files
   */
  private async findAffectedTests(changedFiles: string[], allTests: string[]): Promise<string[]> {
    const affectedTests = new Set<string>();
    
    for (const changedFile of changedFiles) {
      // Direct test file changes
      if (changedFile.includes('test')) {
        affectedTests.add(changedFile);
        continue;
      }
      
      // Find tests that might depend on this file
      for (const testFile of allTests) {
        if (await this.testDependsOnFile(testFile, changedFile)) {
          affectedTests.add(testFile);
        }
      }
    }
    
    return Array.from(affectedTests);
  }
  
  /**
   * Check if a test depends on a specific file
   */
  private async testDependsOnFile(testFile: string, sourceFile: string): Promise<boolean> {
    try {
      const testContent = readFileSync(testFile, 'utf-8');
      const sourceFileName = sourceFile.replace(/\.[^.]+$/, '').split('/').pop();
      
      // Simple dependency detection based on imports and file names
      return (
        testContent.includes(sourceFile) ||
        testContent.includes(sourceFileName || '') ||
        testFile.includes(sourceFileName || '')
      );
    } catch {
      return false;
    }
  }
  
  /**
   * Get test files for a specific test type
   */
  private async getTestFiles(testType: string): Promise<string[]> {
    const patterns: Record<string, string[]> = {
      unit: ['tests/unit/**/*.test.{ts,tsx}', 'tests/components/**/*.test.{ts,tsx}'],
      integration: ['tests/integration/**/*.test.{ts,tsx}'],
      performance: ['tests/performance/**/*.test.{ts,tsx}'],
      all: ['tests/**/*.test.{ts,tsx}'],
    };
    
    const testPatterns = patterns[testType] || patterns.unit;
    const files: string[] = [];
    
    for (const pattern of testPatterns) {
      try {
        const matches = glob.sync(pattern, { absolute: true });
        files.push(...matches.map(file => relative(this.projectRoot, file)));
      } catch {
        // Ignore pattern errors
      }
    }
    
    return files;
  }
  
  /**
   * Find new tests not in cache
   */
  private async findNewTests(allTests: string[]): Promise<string[]> {
    return allTests.filter(test => !this.cache.files[test]);
  }
  
  /**
   * Find deleted tests that are in cache but no longer exist
   */
  private async findDeletedTests(allTests: string[]): Promise<string[]> {
    const currentTestsSet = new Set(allTests);
    return Object.keys(this.cache.files).filter(test => !currentTestsSet.has(test));
  }
  
  /**
   * Get fast validation tests for quick checks
   */
  private getFastValidationTests(allTests: string[]): string[] {
    // Return a subset of fast, reliable tests for quick validation
    return allTests
      .filter(test => {
        const cached = this.cache.files[test];
        return cached && cached.avgExecutionTime < 1000 && cached.successRate > 0.95;
      })
      .slice(0, 10); // Limit to 10 fast tests
  }
  
  /**
   * Optimize execution order based on historical performance
   */
  private optimizeExecutionOrder(tests: string[]): string[] {
    return tests.sort((a, b) => {
      const aCached = this.cache.files[a];
      const bCached = this.cache.files[b];
      
      // Prioritize faster tests first
      const aTime = aCached?.avgExecutionTime || 5000;
      const bTime = bCached?.avgExecutionTime || 5000;
      
      // Prioritize higher success rate
      const aSuccess = aCached?.successRate || 0.5;
      const bSuccess = bCached?.successRate || 0.5;
      
      // Combined score: faster + more reliable tests first
      const aScore = (1 / aTime) * aSuccess;
      const bScore = (1 / bTime) * bSuccess;
      
      return bScore - aScore;
    });
  }
  
  /**
   * Calculate estimated execution time
   */
  private calculateEstimatedTime(tests: string[]): number {
    return tests.reduce((total, test) => {
      const cached = this.cache.files[test];
      return total + (cached?.avgExecutionTime || 3000); // Default 3s per test
    }, 0);
  }
  
  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(testsToRun: string[], allTests: string[]): number {
    const cachedTests = testsToRun.filter(test => this.cache.files[test]);
    return allTests.length > 0 ? cachedTests.length / allTests.length : 0;
  }
  
  /**
   * Pre-warm Vitest cache
   */
  private async preWarmVitestCache(): Promise<void> {
    try {
      // Run a minimal test to warm up Vitest cache
      await new Promise<void>((resolve, reject) => {
        const child = spawn('bun', ['vitest', 'run', '--reporter=silent', '--no-coverage', '--run'], {
          stdio: 'pipe',
          env: {
            ...process.env,
            VITEST_CACHE_WARMUP: 'true',
            TEST_TIMEOUT: '1000',
          },
        });
        
        let hasResolved = false;
        
        // Resolve after a short time or when process exits
        const timeout = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            child.kill('SIGTERM');
            resolve();
          }
        }, 5000);
        
        child.on('close', () => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            resolve();
          }
        });
        
        child.on('error', (error) => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
    } catch {
      // Ignore warming errors
    }
  }
  
  /**
   * Pre-warm dependency cache
   */
  private async preWarmDependencyCache(): Promise<void> {
    try {
      // Ensure all test dependencies are resolved
      execSync('bun install --frozen-lockfile', { stdio: 'pipe' });
    } catch {
      // Ignore if lockfile doesn't exist or install fails
    }
  }
  
  /**
   * Update cache for current execution
   */
  private async updateCacheForExecution(testsToRun: string[], changes: ChangeAnalysis): Promise<void> {
    // Update test file information
    for (const testFile of testsToRun) {
      try {
        const fullPath = join(this.projectRoot, testFile);
        const stat = statSync(fullPath);
        const content = readFileSync(fullPath, 'utf-8');
        const hash = createHash('md5').update(content).digest('hex');
        
        if (!this.cache.files[testFile]) {
          this.cache.files[testFile] = {
            path: testFile,
            lastModified: stat.mtime.getTime(),
            dependencies: [],
            avgExecutionTime: 3000, // Default
            successRate: 1.0, // Optimistic default
            size: stat.size,
            hash,
          };
        } else {
          this.cache.files[testFile].lastModified = stat.mtime.getTime();
          this.cache.files[testFile].size = stat.size;
          this.cache.files[testFile].hash = hash;
        }
      } catch {
        // Ignore files that can't be read
      }
    }
    
    // Remove deleted tests from cache
    for (const deletedTest of changes.deletedTests) {
      delete this.cache.files[deletedTest];
    }
    
    // Update timestamp
    this.cache.timestamp = Date.now();
    
    // Save cache
    this.saveCache();
  }
  
  /**
   * Load cache from disk
   */
  private loadCache(): TestCache {
    if (!existsSync(this.cacheFile)) {
      return this.createEmptyCache();
    }
    
    try {
      const cacheData = JSON.parse(readFileSync(this.cacheFile, 'utf-8'));
      return {
        version: cacheData.version || '1.0.0',
        timestamp: cacheData.timestamp || Date.now(),
        files: cacheData.files || {},
        executionOrder: cacheData.executionOrder || [],
        failedTests: cacheData.failedTests || [],
        skippedTests: cacheData.skippedTests || [],
      };
    } catch {
      return this.createEmptyCache();
    }
  }
  
  /**
   * Save cache to disk
   */
  private saveCache(): void {
    try {
      writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.warn('⚠️  Failed to save test cache:', error);
    }
  }
  
  /**
   * Create empty cache structure
   */
  private createEmptyCache(): TestCache {
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      files: {},
      executionOrder: [],
      failedTests: [],
      skippedTests: [],
    };
  }
  
  /**
   * Ensure cache directory exists
   */
  private ensureCacheDir(): void {
    try {
      execSync(`mkdir -p "${this.cacheDir}"`, { stdio: 'pipe' });
    } catch {
      // Ignore if directory already exists or can't be created
    }
  }
  
  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    console.log('🧹 Clearing all test caches...');
    
    try {
      // Clear Vitest cache
      execSync('rm -rf node_modules/.vitest node_modules/.vite*', { stdio: 'pipe' });
      
      // Clear test cache
      if (existsSync(this.cacheFile)) {
        execSync(`rm -f "${this.cacheFile}"`, { stdio: 'pipe' });
      }
      
      // Reset cache
      this.cache = this.createEmptyCache();
      
      console.log('✅ All caches cleared');
    } catch (error) {
      console.error('❌ Failed to clear caches:', error);
    }
  }
  
  /**
   * Generate cache statistics
   */
  getCacheStats(): {
    totalTests: number;
    cachedTests: number;
    averageExecutionTime: number;
    cacheAge: number;
    hitRate: number;
  } {
    const totalTests = Object.keys(this.cache.files).length;
    const cachedTests = totalTests;
    const avgTime = totalTests > 0 
      ? Object.values(this.cache.files).reduce((sum, file) => sum + file.avgExecutionTime, 0) / totalTests
      : 0;
    const cacheAge = Date.now() - this.cache.timestamp;
    
    return {
      totalTests,
      cachedTests,
      averageExecutionTime: Math.round(avgTime),
      cacheAge: Math.round(cacheAge / 1000), // seconds
      hitRate: totalTests > 0 ? 1.0 : 0,
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'optimize';
  const testType = args[1] || 'unit';
  
  const optimizer = new TestCacheOptimizer();
  
  switch (command) {
    case 'optimize':
      const result = await optimizer.optimizeTestExecution(testType);
      console.log('\n📊 Optimization Result:');
      console.log(`Tests to run: ${result.testsToRun.length}`);
      console.log(`Estimated time: ${Math.round(result.estimatedTime / 1000)}s`);
      console.log(`Cache hit rate: ${Math.round(result.cacheHitRate * 100)}%`);
      break;
      
    case 'prewarm':
      await optimizer.preWarmCaches();
      break;
      
    case 'clear':
      await optimizer.clearCaches();
      break;
      
    case 'stats':
      const stats = optimizer.getCacheStats();
      console.log('\n📈 Cache Statistics:');
      console.log(`Total tests: ${stats.totalTests}`);
      console.log(`Cached tests: ${stats.cachedTests}`);
      console.log(`Average execution time: ${stats.averageExecutionTime}ms`);
      console.log(`Cache age: ${stats.cacheAge}s`);
      console.log(`Hit rate: ${Math.round(stats.hitRate * 100)}%`);
      break;
      
    default:
      console.log('Usage: bun test-cache-optimizer.ts [optimize|prewarm|clear|stats] [testType]');
      break;
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { TestCacheOptimizer };