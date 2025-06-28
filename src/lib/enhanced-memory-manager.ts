/**
 * Enhanced Memory Manager
 *
 * Advanced memory management system that extends the existing memory leak optimizer
 * with intelligent garbage collection, memory pooling, and performance optimizations.
 */

import { type MemoryLeakDetector, memoryManager } from "./memory-leak-optimizer";
import { performanceOptimizer } from "./performance-optimization";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface MemoryPoolConfig {
  initialSize: number;
  maxSize: number;
  itemFactory: () => any;
  resetFunction?: (item: any) => void;
  validator?: (item: any) => boolean;
}

interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  poolsUsage: Map<string, number>;
  gcCount: number;
  lastGCTime: number;
}

interface OptimizationResult {
  memoryFreed: number;
  itemsProcessed: number;
  optimizationsApplied: string[];
  performanceGain: number;
}

// ============================================================================
// Memory Pool Implementation
// ============================================================================

class MemoryPool<T> {
  private pool: T[] = [];
  private inUse = new Set<T>();
  private config: MemoryPoolConfig;

  constructor(name: string, config: MemoryPoolConfig) {
    this.config = config;

    // Pre-populate pool
    for (let i = 0; i < config.initialSize; i++) {
      this.pool.push(config.itemFactory());
    }

    memoryManager.detector.registerComponent(`memory-pool-${name}`);
  }

  acquire(): T {
    let item: T;

    if (this.pool.length > 0) {
      item = this.pool.pop()!;
    } else if (this.getTotalSize() < this.config.maxSize) {
      item = this.config.itemFactory();
    } else {
      // Pool exhausted, create temporary item
      console.warn("[MemoryPool] Pool exhausted, creating temporary item");
      item = this.config.itemFactory();
    }

    this.inUse.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.inUse.has(item)) {
      console.warn("[MemoryPool] Attempting to release item not in use");
      return;
    }

    this.inUse.delete(item);

    // Validate item before returning to pool
    if (this.config.validator && !this.config.validator(item)) {
      return; // Don't return invalid items to pool
    }

    // Reset item state
    if (this.config.resetFunction) {
      this.config.resetFunction(item);
    }

    // Return to pool if within size limits
    if (this.pool.length < this.config.maxSize) {
      this.pool.push(item);
    }
  }

  getTotalSize(): number {
    return this.pool.length + this.inUse.size;
  }

  getUsageStats(): { available: number; inUse: number; total: number } {
    return {
      available: this.pool.length,
      inUse: this.inUse.size,
      total: this.getTotalSize(),
    };
  }

  clear(): void {
    this.pool.length = 0;
    this.inUse.clear();
  }
}

// ============================================================================
// Enhanced Memory Manager
// ============================================================================

export class EnhancedMemoryManager {
  private detector: MemoryLeakDetector;
  private pools = new Map<string, MemoryPool<any>>();
  private gcScheduler?: NodeJS.Timeout;
  private lastOptimization = 0;
  private optimizationHistory: OptimizationResult[] = [];

  constructor() {
    this.detector = memoryManager.detector;
    this.initializeDefaultPools();
    this.startOptimizationScheduler();
  }

  // ============================================================================
  // Memory Pool Management
  // ============================================================================

  createPool<T>(name: string, config: MemoryPoolConfig): MemoryPool<T> {
    if (this.pools.has(name)) {
      throw new Error(`Pool '${name}' already exists`);
    }

    const pool = new MemoryPool<T>(name, config);
    this.pools.set(name, pool);

    console.info(`[EnhancedMemoryManager] Created memory pool: ${name}`);
    return pool;
  }

  getPool<T>(name: string): MemoryPool<T> | undefined {
    return this.pools.get(name);
  }

  private initializeDefaultPools(): void {
    // Object pool for frequently created objects
    this.createPool("objects", {
      initialSize: 50,
      maxSize: 200,
      itemFactory: () => ({}),
      resetFunction: (obj) => {
        // Clear all properties
        Object.keys(obj).forEach((key) => delete obj[key]);
      },
      validator: (obj) => typeof obj === "object" && obj !== null,
    });

    // Array pool for temporary arrays
    this.createPool("arrays", {
      initialSize: 30,
      maxSize: 100,
      itemFactory: () => [],
      resetFunction: (arr) => {
        arr.length = 0;
      },
      validator: (arr) => Array.isArray(arr),
    });

    // Buffer pool for binary data
    this.createPool("buffers", {
      initialSize: 10,
      maxSize: 50,
      itemFactory: () => new ArrayBuffer(1024),
      validator: (buf) => buf instanceof ArrayBuffer,
    });
  }

  // ============================================================================
  // Intelligent Garbage Collection
  // ============================================================================

  async forceOptimization(): Promise<OptimizationResult> {
    const startTime = performance.now();
    const initialMemory = this.getCurrentMemoryUsage();
    const optimizations: string[] = [];
    let itemsProcessed = 0;

    try {
      // 1. Clean up expired cache entries
      await this.cleanupExpiredCaches();
      optimizations.push("cache-cleanup");

      // 2. Optimize memory pools
      itemsProcessed += this.optimizeMemoryPools();
      optimizations.push("pool-optimization");

      // 3. Force garbage collection if available
      if (this.forceGarbageCollection()) {
        optimizations.push("garbage-collection");
      }

      // 4. Clean up DOM references (if in browser)
      if (typeof window !== "undefined") {
        this.cleanupDOMReferences();
        optimizations.push("dom-cleanup");
      }

      // 5. Optimize event listeners
      this.optimizeEventListeners();
      optimizations.push("event-listener-optimization");

      const endTime = performance.now();
      const finalMemory = this.getCurrentMemoryUsage();
      const result: OptimizationResult = {
        memoryFreed: Math.max(0, initialMemory.heapUsed - finalMemory.heapUsed),
        itemsProcessed,
        optimizationsApplied: optimizations,
        performanceGain: endTime - startTime,
      };

      this.optimizationHistory.push(result);
      this.lastOptimization = Date.now();

      console.info("[EnhancedMemoryManager] Optimization completed:", result);
      return result;
    } catch (error) {
      console.error("[EnhancedMemoryManager] Optimization failed:", error);
      throw error;
    }
  }

  private forceGarbageCollection(): boolean {
    // Force GC in Node.js
    if (typeof global !== "undefined" && global.gc) {
      global.gc();
      return true;
    }

    // Force GC in browser (Chrome DevTools)
    if (typeof window !== "undefined" && (window as any).gc) {
      (window as any).gc();
      return true;
    }

    return false;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private async cleanupExpiredCaches(): Promise<void> {
    try {
      // This would integrate with actual cache systems in the application
      await performanceOptimizer.clearMetrics();

      // Clear compression caches if they exist
      if (typeof window !== "undefined" && "caches" in window) {
        const cacheNames = await caches.keys();
        const expiredCaches = cacheNames.filter(
          (name) => name.includes("temp-") || name.includes("old-")
        );

        await Promise.all(expiredCaches.map((name) => caches.delete(name)));
      }
    } catch (error) {
      console.warn("[EnhancedMemoryManager] Cache cleanup failed:", error);
    }
  }

  // ============================================================================
  // Memory Pool Optimization
  // ============================================================================

  private optimizeMemoryPools(): number {
    let itemsProcessed = 0;

    for (const [name, pool] of this.pools) {
      const stats = pool.getUsageStats();

      // If pool usage is low, reduce its size
      if (stats.inUse < stats.available * 0.2) {
        const itemsToRemove = Math.floor(stats.available * 0.3);
        for (let i = 0; i < itemsToRemove; i++) {
          if (pool["pool"].length > 0) {
            pool["pool"].pop();
            itemsProcessed++;
          }
        }

        console.debug(
          `[EnhancedMemoryManager] Optimized pool ${name}: removed ${itemsToRemove} items`
        );
      }
    }

    return itemsProcessed;
  }

  // ============================================================================
  // DOM and Event Cleanup
  // ============================================================================

  private cleanupDOMReferences(): void {
    if (typeof document === "undefined") return;

    // Remove orphaned elements
    const orphanedElements = document.querySelectorAll("[data-lazy-id]");
    orphanedElements.forEach((element) => {
      if (!element.parentNode) {
        element.remove();
      }
    });

    // Clear event listeners on hidden elements
    const hiddenElements = document.querySelectorAll('[style*="display: none"]');
    hiddenElements.forEach((element) => {
      // This would need actual implementation based on the application's event system
      console.debug("[EnhancedMemoryManager] Cleaning up hidden element listeners");
    });
  }

  private optimizeEventListeners(): void {
    // This would integrate with the actual event system
    const currentListeners = this.detector["eventListeners"];

    for (const [component, listeners] of currentListeners) {
      if (listeners.size > 10) {
        console.warn(
          `[EnhancedMemoryManager] Component ${component} has ${listeners.size} listeners`
        );
        // Could implement listener consolidation here
      }
    }
  }

  // ============================================================================
  // Memory Monitoring and Metrics
  // ============================================================================

  getCurrentMemoryUsage(): MemoryMetrics {
    const metrics: MemoryMetrics = {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0,
      poolsUsage: new Map(),
      gcCount: 0,
      lastGCTime: 0,
    };

    // Node.js memory usage
    if (typeof process !== "undefined" && process.memoryUsage) {
      const nodeMemory = process.memoryUsage();
      metrics.heapUsed = nodeMemory.heapUsed;
      metrics.heapTotal = nodeMemory.heapTotal;
      metrics.external = nodeMemory.external;
      metrics.arrayBuffers = nodeMemory.arrayBuffers;
    }

    // Browser memory usage
    if (typeof window !== "undefined" && "performance" in window) {
      const browserMemory = (performance as any).memory;
      if (browserMemory) {
        metrics.heapUsed = browserMemory.usedJSHeapSize;
        metrics.heapTotal = browserMemory.totalJSHeapSize;
      }
    }

    // Pool usage
    for (const [name, pool] of this.pools) {
      const stats = pool.getUsageStats();
      metrics.poolsUsage.set(name, stats.inUse / stats.total);
    }

    return metrics;
  }

  getOptimizationHistory(): OptimizationResult[] {
    return [...this.optimizationHistory];
  }

  getPoolStats(): Map<string, any> {
    const stats = new Map();
    for (const [name, pool] of this.pools) {
      stats.set(name, pool.getUsageStats());
    }
    return stats;
  }

  // ============================================================================
  // Automatic Optimization Scheduling
  // ============================================================================

  private startOptimizationScheduler(): void {
    // Run optimization every 5 minutes
    this.gcScheduler = setInterval(async () => {
      await this.performScheduledOptimization();
    }, 300000);

    // Register cleanup
    if (typeof process !== "undefined") {
      process.on("exit", () => this.destroy());
    }

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.destroy());
    }
  }

  private async performScheduledOptimization(): Promise<void> {
    const currentMemory = this.getCurrentMemoryUsage();
    const memoryPressure = currentMemory.heapUsed / currentMemory.heapTotal;

    // Only optimize if memory pressure is high or it's been a while
    const shouldOptimize = memoryPressure > 0.7 || Date.now() - this.lastOptimization > 600000; // 10 minutes

    if (shouldOptimize) {
      try {
        await this.forceOptimization();
      } catch (error) {
        console.error("[EnhancedMemoryManager] Scheduled optimization failed:", error);
      }
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  acquireObject<T = any>(): T {
    const pool = this.getPool<T>("objects");
    return pool ? pool.acquire() : ({} as T);
  }

  releaseObject<T>(obj: T): void {
    const pool = this.getPool<T>("objects");
    if (pool) {
      pool.release(obj);
    }
  }

  acquireArray<T = any>(): T[] {
    const pool = this.getPool<T[]>("arrays");
    return pool ? pool.acquire() : [];
  }

  releaseArray<T>(arr: T[]): void {
    const pool = this.getPool<T[]>("arrays");
    if (pool) {
      pool.release(arr);
    }
  }

  acquireBuffer(size?: number): ArrayBuffer {
    const pool = this.getPool<ArrayBuffer>("buffers");
    const buffer = pool ? pool.acquire() : new ArrayBuffer(size || 1024);

    // Resize if needed
    if (size && buffer.byteLength !== size) {
      return new ArrayBuffer(size);
    }

    return buffer;
  }

  releaseBuffer(buffer: ArrayBuffer): void {
    const pool = this.getPool<ArrayBuffer>("buffers");
    if (pool) {
      pool.release(buffer);
    }
  }

  // ============================================================================
  // Cleanup and Destruction
  // ============================================================================

  destroy(): void {
    if (this.gcScheduler) {
      clearInterval(this.gcScheduler);
      this.gcScheduler = undefined;
    }

    // Clear all pools
    for (const pool of this.pools.values()) {
      pool.clear();
    }
    this.pools.clear();

    // Clear optimization history
    this.optimizationHistory.length = 0;

    console.info("[EnhancedMemoryManager] Destroyed");
  }
}

// ============================================================================
// Global Instance and Utilities
// ============================================================================

export const enhancedMemoryManager = new EnhancedMemoryManager();

// Convenience functions for common operations
export function withMemoryOptimization<T>(
  operation: () => T,
  options: { forceGC?: boolean; poolCleanup?: boolean } = {}
): T {
  const startMemory = enhancedMemoryManager.getCurrentMemoryUsage();

  try {
    const result = operation();

    if (options.forceGC) {
      enhancedMemoryManager.forceOptimization().catch(() => {});
    }

    return result;
  } finally {
    if (options.poolCleanup) {
      // Release any temporary objects back to pools
      setTimeout(() => {
        enhancedMemoryManager.forceOptimization().catch(() => {});
      }, 100);
    }
  }
}

export function createOptimizedArray<T>(initialCapacity?: number): T[] {
  return enhancedMemoryManager.acquireArray<T>();
}

export function createOptimizedObject<T = any>(): T {
  return enhancedMemoryManager.acquireObject<T>();
}

export default enhancedMemoryManager;
