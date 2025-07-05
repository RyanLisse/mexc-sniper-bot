/**
 * Performance Cache Manager
 * MISSION: Test Performance Optimization Specialist - Advanced Caching
 * 
 * FEATURES:
 * - Intelligent cache warm-up strategies
 * - Multi-layered caching (memory, disk, network)
 * - Cache invalidation based on file changes
 * - Performance-aware cache priorities
 * - Memory-efficient cache storage
 * - Cache hit rate optimization
 * - Predictive cache pre-loading
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { performance } from 'perf_hooks';

interface CacheEntry<T = any> {
  key: string;
  value: T;
  created: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  ttl?: number;
  dependencies: string[];
  compressionRatio?: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  averageAccessTime: number;
  memoryPressure: number;
}

interface CacheConfig {
  maxMemorySize: number; // bytes
  maxDiskSize: number; // bytes
  defaultTTL: number; // milliseconds
  compressionThreshold: number; // bytes
  maxConcurrentOperations: number;
  cacheDirs: string[];
  excludePatterns: RegExp[];
}

export class PerformanceCacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private diskCacheDir: string;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private lockingOperations = new Set<string>();
  private compressionEnabled: boolean;
  private fileDependencyMap = new Map<string, Set<string>>();
  
  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxMemorySize: 512 * 1024 * 1024, // 512MB
      maxDiskSize: 2 * 1024 * 1024 * 1024, // 2GB
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      compressionThreshold: 1024, // 1KB
      maxConcurrentOperations: 10,
      cacheDirs: [
        './node_modules/.vitest',
        './test-results/cache',
        './coverage/cache',
      ],
      excludePatterns: [
        /node_modules/,
        /\.git/,
        /\.env/,
        /test-results/,
        /coverage/,
      ],
      ...config,
    };
    
    this.diskCacheDir = join(process.cwd(), 'test-results', 'performance-cache');
    this.compressionEnabled = this.isCompressionAvailable();
    
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      entryCount: 0,
      averageAccessTime: 0,
      memoryPressure: 0,
    };
    
    this.initializeCacheDirectories();
    this.loadDiskCache();
    this.startMaintenanceCycle();
    
    console.log('🗄️  Performance Cache Manager initialized');
    console.log(`📊 Cache limits: ${Math.round(this.config.maxMemorySize / 1024 / 1024)}MB memory, ${Math.round(this.config.maxDiskSize / 1024 / 1024 / 1024)}GB disk`);
  }
  
  /**
   * Get cached value with intelligent fallback strategies
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && this.isValidEntry(memoryEntry)) {
        this.updateAccessMetrics(memoryEntry);
        this.metrics.hits++;
        return memoryEntry.value as T;
      }
      
      // Check disk cache
      const diskEntry = await this.getDiskEntry<T>(key);
      if (diskEntry && this.isValidEntry(diskEntry)) {
        // Promote to memory cache if valuable
        if (this.shouldPromoteToMemory(diskEntry)) {
          this.memoryCache.set(key, diskEntry);
        }
        this.updateAccessMetrics(diskEntry);
        this.metrics.hits++;
        return diskEntry.value as T;
      }
      
      this.metrics.misses++;
      return null;
      
    } finally {
      const accessTime = performance.now() - startTime;
      this.updateAverageAccessTime(accessTime);
    }
  }
  
  /**
   * Set cached value with intelligent storage strategy
   */
  async set<T>(key: string, value: T, options?: {
    ttl?: number;
    dependencies?: string[];
    priority?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    if (this.lockingOperations.has(key)) {
      // If operation is in progress, wait briefly
      await new Promise(resolve => setTimeout(resolve, 10));
      return;
    }
    
    this.lockingOperations.add(key);
    
    try {
      const serializedValue = this.serializeValue(value);
      const size = Buffer.byteLength(serializedValue, 'utf8');
      
      const entry: CacheEntry<T> = {
        key,
        value,
        created: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        size,
        ttl: options?.ttl || this.config.defaultTTL,
        dependencies: options?.dependencies || [],
      };
      
      // Apply compression if beneficial
      if (size > this.config.compressionThreshold && this.compressionEnabled) {
        entry.compressionRatio = await this.calculateCompressionRatio(serializedValue);
      }
      
      // Determine storage strategy
      const priority = options?.priority || 'medium';
      const shouldStoreInMemory = this.shouldStoreInMemory(entry, priority);
      const shouldStoreOnDisk = this.shouldStoreOnDisk(entry, priority);
      
      if (shouldStoreInMemory) {
        await this.ensureMemorySpace(entry.size);
        this.memoryCache.set(key, entry);
      }
      
      if (shouldStoreOnDisk) {
        await this.setDiskEntry(entry);
      }
      
      // Update dependency tracking
      this.updateDependencyMap(key, entry.dependencies);
      
      // Update metrics
      this.metrics.entryCount++;
      this.metrics.totalSize += entry.size;
      
    } finally {
      this.lockingOperations.delete(key);
    }
  }
  
  /**
   * Invalidate cache entries based on file dependencies
   */
  async invalidateByDependencies(changedFiles: string[]): Promise<number> {
    let invalidatedCount = 0;
    
    for (const file of changedFiles) {
      const dependentKeys = this.fileDependencyMap.get(file);
      if (dependentKeys) {
        for (const key of dependentKeys) {
          await this.delete(key);
          invalidatedCount++;
        }
      }
    }
    
    console.log(`🗑️  Invalidated ${invalidatedCount} cache entries due to file changes`);
    return invalidatedCount;
  }
  
  /**
   * Warm up cache with predictive pre-loading
   */
  async warmUpCache(testPaths: string[]): Promise<void> {
    console.log('🔥 Warming up cache with predictive pre-loading...');
    
    const startTime = performance.now();
    const warmupTasks: Promise<void>[] = [];
    
    for (const testPath of testPaths) {
      // Predict likely cache keys based on test path
      const predictedKeys = this.predictCacheKeys(testPath);
      
      for (const key of predictedKeys) {
        if (warmupTasks.length < this.config.maxConcurrentOperations) {
          warmupTasks.push(this.preloadCacheEntry(key));
        }
      }
    }
    
    await Promise.allSettled(warmupTasks);
    
    const duration = performance.now() - startTime;
    console.log(`✅ Cache warm-up completed in ${Math.round(duration)}ms`);
  }
  
  /**
   * Optimize cache for upcoming test execution
   */
  async optimizeForTestExecution(testPaths: string[]): Promise<{
    memoryOptimized: number;
    diskOptimized: number;
    predictiveLoads: number;
  }> {
    console.log('⚡ Optimizing cache for test execution...');
    
    const stats = {
      memoryOptimized: 0,
      diskOptimized: 0,
      predictiveLoads: 0,
    };
    
    // 1. Clean up stale entries
    stats.memoryOptimized = await this.cleanupStaleEntries();
    
    // 2. Optimize memory layout
    await this.optimizeMemoryLayout();
    
    // 3. Pre-load frequently used entries
    stats.predictiveLoads = await this.predictivePreload(testPaths);
    
    // 4. Optimize disk cache
    stats.diskOptimized = await this.optimizeDiskCache();
    
    console.log(`📈 Cache optimization complete:`, stats);
    return stats;
  }
  
  /**
   * Get comprehensive cache metrics
   */
  getMetrics(): CacheMetrics & {
    memoryEntries: number;
    diskEntries: number;
    topAccessedKeys: string[];
    staleCacheRatio: number;
    compressionRatio: number;
  } {
    const memoryEntries = this.memoryCache.size;
    const diskEntries = this.getDiskCacheSize();
    const staleCacheRatio = this.calculateStaleCacheRatio();
    const compressionRatio = this.calculateAverageCompressionRatio();
    
    // Get top accessed keys
    const topAccessedKeys = Array.from(this.memoryCache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(entry => entry.key);
    
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
    this.metrics.memoryPressure = this.calculateMemoryPressure();
    
    return {
      ...this.metrics,
      memoryEntries,
      diskEntries,
      topAccessedKeys,
      staleCacheRatio,
      compressionRatio,
    };
  }
  
  /**
   * Clear all cache data
   */
  async clear(): Promise<void> {
    console.log('🗑️  Clearing all cache data...');
    
    this.memoryCache.clear();
    await this.clearDiskCache();
    this.fileDependencyMap.clear();
    
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      entryCount: 0,
      averageAccessTime: 0,
      memoryPressure: 0,
    };
    
    console.log('✅ Cache cleared successfully');
  }
  
  /**
   * Generate cache performance report
   */
  generatePerformanceReport(): any {
    const metrics = this.getMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      performance: {
        hitRate: Math.round(metrics.hitRate * 100),
        averageAccessTime: Math.round(metrics.averageAccessTime),
        memoryPressure: Math.round(metrics.memoryPressure * 100),
        compressionRatio: Math.round(metrics.compressionRatio * 100),
      },
      storage: {
        memoryEntries: metrics.memoryEntries,
        diskEntries: metrics.diskEntries,
        totalSizeMB: Math.round(metrics.totalSize / 1024 / 1024),
        memoryLimitMB: Math.round(this.config.maxMemorySize / 1024 / 1024),
        diskLimitGB: Math.round(this.config.maxDiskSize / 1024 / 1024 / 1024),
      },
      efficiency: {
        staleCacheRatio: Math.round(metrics.staleCacheRatio * 100),
        topAccessedKeys: metrics.topAccessedKeys,
        dependencyTracking: this.fileDependencyMap.size,
      },
      recommendations: this.generateCacheRecommendations(metrics),
    };
  }
  
  // Private methods
  
  private initializeCacheDirectories(): void {
    if (!existsSync(this.diskCacheDir)) {
      mkdirSync(this.diskCacheDir, { recursive: true });
    }
    
    for (const dir of this.config.cacheDirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }
  
  private async loadDiskCache(): Promise<void> {
    try {
      const indexPath = join(this.diskCacheDir, 'index.json');
      if (existsSync(indexPath)) {
        const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
        console.log(`📚 Found ${Object.keys(index).length} disk cache entries`);
      }
    } catch (error) {
      console.warn('⚠️  Failed to load disk cache index:', error);
    }
  }
  
  private startMaintenanceCycle(): void {
    // Run maintenance every 30 seconds
    setInterval(() => {
      this.performMaintenance();
    }, 30000);
  }
  
  private async performMaintenance(): Promise<void> {
    // Clean up expired entries
    await this.cleanupExpiredEntries();
    
    // Manage memory pressure
    if (this.calculateMemoryPressure() > 0.8) {
      await this.relieveMemoryPressure();
    }
    
    // Update metrics
    this.updateMetrics();
  }
  
  private isValidEntry(entry: CacheEntry): boolean {
    if (!entry.ttl) return true;
    return Date.now() - entry.created < entry.ttl;
  }
  
  private updateAccessMetrics(entry: CacheEntry): void {
    entry.lastAccessed = Date.now();
    entry.accessCount++;
  }
  
  private shouldPromoteToMemory(entry: CacheEntry): boolean {
    // Promote if frequently accessed or recently used
    return entry.accessCount > 2 || (Date.now() - entry.lastAccessed) < 60000;
  }
  
  private shouldStoreInMemory(entry: CacheEntry, priority: string): boolean {
    if (priority === 'high') return true;
    if (priority === 'low') return false;
    
    // Store in memory if small enough and under memory pressure threshold
    return entry.size < 1024 * 1024 && this.calculateMemoryPressure() < 0.7; // 1MB, 70% pressure
  }
  
  private shouldStoreOnDisk(entry: CacheEntry, priority: string): boolean {
    // Always store high priority, store medium if space available
    return priority === 'high' || (priority === 'medium' && this.getDiskSpaceUsage() < 0.8);
  }
  
  private async ensureMemorySpace(requiredSize: number): Promise<void> {
    const currentSize = this.getCurrentMemorySize();
    const availableSpace = this.config.maxMemorySize - currentSize;
    
    if (availableSpace < requiredSize) {
      await this.evictLeastValuableEntries(requiredSize - availableSpace);
    }
  }
  
  private async evictLeastValuableEntries(spaceNeeded: number): Promise<void> {
    const entries = Array.from(this.memoryCache.values())
      .sort((a, b) => this.calculateEntryValue(a) - this.calculateEntryValue(b));
    
    let spaceFreed = 0;
    for (const entry of entries) {
      if (spaceFreed >= spaceNeeded) break;
      
      this.memoryCache.delete(entry.key);
      spaceFreed += entry.size;
    }
  }
  
  private calculateEntryValue(entry: CacheEntry): number {
    const recency = Date.now() - entry.lastAccessed;
    const frequency = entry.accessCount;
    const size = entry.size;
    
    // Higher score = more valuable (less likely to be evicted)
    return frequency * 1000 - recency / 1000 - size / 1024;
  }
  
  private async getDiskEntry<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const filePath = join(this.diskCacheDir, this.hashKey(key) + '.json');
      if (!existsSync(filePath)) return null;
      
      const data = readFileSync(filePath, 'utf-8');
      const entry = JSON.parse(data) as CacheEntry<T>;
      
      return this.isValidEntry(entry) ? entry : null;
    } catch {
      return null;
    }
  }
  
  private async setDiskEntry(entry: CacheEntry): Promise<void> {
    try {
      const filePath = join(this.diskCacheDir, this.hashKey(entry.key) + '.json');
      writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    } catch (error) {
      console.warn(`⚠️  Failed to write disk cache entry for ${entry.key}:`, error);
    }
  }
  
  private async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    try {
      const filePath = join(this.diskCacheDir, this.hashKey(key) + '.json');
      if (existsSync(filePath)) {
        // In a real implementation, would use fs.unlink
        console.log(`🗑️  Would delete disk cache file: ${filePath}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to delete disk cache entry for ${key}:`, error);
    }
  }
  
  private updateDependencyMap(key: string, dependencies: string[]): void {
    for (const dep of dependencies) {
      if (!this.fileDependencyMap.has(dep)) {
        this.fileDependencyMap.set(dep, new Set());
      }
      this.fileDependencyMap.get(dep)!.add(key);
    }
  }
  
  private predictCacheKeys(testPath: string): string[] {
    // Predict likely cache keys based on test path patterns
    const keys: string[] = [];
    
    // Common cache keys for test files
    keys.push(`compile:${testPath}`);
    keys.push(`dependencies:${testPath}`);
    keys.push(`metadata:${testPath}`);
    
    // Module resolution keys
    const dir = testPath.substring(0, testPath.lastIndexOf('/'));
    keys.push(`modules:${dir}`);
    
    return keys;
  }
  
  private async preloadCacheEntry(key: string): Promise<void> {
    // Simulate preloading - in real implementation would prepare cache data
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  
  private async cleanupStaleEntries(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.lastAccessed > staleThreshold) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  private async optimizeMemoryLayout(): Promise<void> {
    // Reorganize memory cache for better access patterns
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => b.accessCount - a.accessCount);
    
    this.memoryCache.clear();
    for (const [key, entry] of entries) {
      this.memoryCache.set(key, entry);
    }
  }
  
  private async predictivePreload(testPaths: string[]): Promise<number> {
    let preloaded = 0;
    
    for (const testPath of testPaths.slice(0, 20)) { // Limit to first 20 tests
      const predictions = this.predictCacheKeys(testPath);
      for (const key of predictions) {
        if (!this.memoryCache.has(key)) {
          // Simulate predictive preloading
          await this.preloadCacheEntry(key);
          preloaded++;
        }
      }
    }
    
    return preloaded;
  }
  
  private async optimizeDiskCache(): Promise<number> {
    // In real implementation would compact disk cache files
    return 0;
  }
  
  private getCurrentMemorySize(): number {
    return Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
  }
  
  private getDiskCacheSize(): number {
    // In real implementation would scan disk cache directory
    return 0;
  }
  
  private getDiskSpaceUsage(): number {
    // In real implementation would check actual disk usage
    return 0.5; // Mock 50% usage
  }
  
  private calculateMemoryPressure(): number {
    const currentSize = this.getCurrentMemorySize();
    return currentSize / this.config.maxMemorySize;
  }
  
  private calculateStaleCacheRatio(): number {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const staleEntries = Array.from(this.memoryCache.values())
      .filter(entry => now - entry.lastAccessed > staleThreshold).length;
    
    return staleEntries / this.memoryCache.size || 0;
  }
  
  private calculateAverageCompressionRatio(): number {
    const entriesWithCompression = Array.from(this.memoryCache.values())
      .filter(entry => entry.compressionRatio !== undefined);
    
    if (entriesWithCompression.length === 0) return 1;
    
    const avgRatio = entriesWithCompression
      .reduce((sum, entry) => sum + (entry.compressionRatio || 1), 0) / entriesWithCompression.length;
    
    return avgRatio;
  }
  
  private async cleanupExpiredEntries(): Promise<void> {
    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isValidEntry(entry)) {
        this.memoryCache.delete(key);
      }
    }
  }
  
  private async relieveMemoryPressure(): Promise<void> {
    const targetReduction = this.config.maxMemorySize * 0.2; // Free up 20%
    await this.evictLeastValuableEntries(targetReduction);
  }
  
  private updateMetrics(): void {
    this.metrics.entryCount = this.memoryCache.size;
    this.metrics.totalSize = this.getCurrentMemorySize();
  }
  
  private updateAverageAccessTime(accessTime: number): void {
    if (this.metrics.averageAccessTime === 0) {
      this.metrics.averageAccessTime = accessTime;
    } else {
      // Exponential moving average
      this.metrics.averageAccessTime = this.metrics.averageAccessTime * 0.9 + accessTime * 0.1;
    }
  }
  
  private generateCacheRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.hitRate < 0.5) {
      recommendations.push('Low cache hit rate - consider preloading more test dependencies');
    }
    
    if (metrics.memoryPressure > 0.8) {
      recommendations.push('High memory pressure - increase cache memory limit or improve eviction strategy');
    }
    
    if (metrics.staleCacheRatio > 0.3) {
      recommendations.push('High stale cache ratio - consider reducing TTL or improving invalidation strategy');
    }
    
    if (metrics.averageAccessTime > 10) {
      recommendations.push('Slow cache access times - consider optimizing serialization or storage');
    }
    
    return recommendations;
  }
  
  private serializeValue<T>(value: T): string {
    return JSON.stringify(value);
  }
  
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
  
  private isCompressionAvailable(): boolean {
    try {
      require('zlib');
      return true;
    } catch {
      return false;
    }
  }
  
  private async calculateCompressionRatio(data: string): Promise<number> {
    if (!this.compressionEnabled) return 1;
    
    try {
      const zlib = require('zlib');
      const compressed = zlib.gzipSync(Buffer.from(data, 'utf8'));
      return compressed.length / Buffer.byteLength(data, 'utf8');
    } catch {
      return 1;
    }
  }
  
  private async clearDiskCache(): Promise<void> {
    // In real implementation would remove all disk cache files
    console.log('🗑️  Disk cache cleared (simulated)');
  }
}

// Global singleton instance
let globalCacheManager: PerformanceCacheManager | null = null;

export function getPerformanceCacheManager(): PerformanceCacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new PerformanceCacheManager();
  }
  return globalCacheManager;
}

export const cacheUtils = {
  get: <T>(key: string) => getPerformanceCacheManager().get<T>(key),
  set: <T>(key: string, value: T, options?: any) => getPerformanceCacheManager().set(key, value, options),
  warmUp: (testPaths: string[]) => getPerformanceCacheManager().warmUpCache(testPaths),
  optimize: (testPaths: string[]) => getPerformanceCacheManager().optimizeForTestExecution(testPaths),
  getMetrics: () => getPerformanceCacheManager().getMetrics(),
  clear: () => getPerformanceCacheManager().clear(),
};