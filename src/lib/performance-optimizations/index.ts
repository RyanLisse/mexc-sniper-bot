/**
 * Performance Optimizations Index
 *
 * Centralized exports for all performance optimization modules
 * Agent 13/15 - Performance Optimizer Implementation
 */

// Bundle optimization
export {
  BundleOptimizationService,
  bundleOptimizer,
} from "../bundle-optimization-service";
// Cache utilities
export {
  CacheManager,
  globalCacheManager,
  LRUCache,
} from "../cache";
// Cache optimization
export {
  getPerformanceCacheOptimizer,
  PerformanceCacheOptimizer,
} from "../cache/performance-cache-optimizer";

// Memory management
export {
  createOptimizedArray,
  createOptimizedObject,
  EnhancedMemoryManager,
  enhancedMemoryManager,
  withMemoryOptimization,
} from "../enhanced-memory-manager";
// Lazy loading optimization
export {
  createLazyResource,
  globalLazyLoader,
  LazyLoadingOptimizer,
  withLazyLoading,
} from "../lazy-loading-optimizer";

// Existing memory leak optimizer
export {
  createMemoryOptimizedEventListener,
  createMemoryOptimizedInterval,
  createMemoryOptimizedState,
  createMemoryOptimizedTimeout,
  createMemoryOptimizedWebSocket,
  MemoryLeakDetector,
  memoryManager,
} from "../memory-leak-optimizer";
// Core performance optimization
export {
  type ComponentLoadingMetrics,
  createLazyComponent,
  estimateBundleSize,
  type PerformanceOptimizationConfig,
  PerformanceUtils,
  performanceOptimizer,
  ResourcePrefetcher,
  usePerformanceMonitoring,
} from "../performance-optimization";

// Import instances for internal use
import { bundleOptimizer } from "../bundle-optimization-service";
import { globalCacheManager } from "../cache";
import { getPerformanceCacheOptimizer } from "../cache/performance-cache-optimizer";
import { enhancedMemoryManager } from "../enhanced-memory-manager";
import { globalLazyLoader } from "../lazy-loading-optimizer";
import { memoryManager } from "../memory-leak-optimizer";
import { performanceOptimizer } from "../performance-optimization";

// ============================================================================
// Integrated Performance Optimizer
// ============================================================================

/**
 * Main performance optimization coordinator that manages all optimization systems
 */
export class IntegratedPerformanceOptimizer {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.info("[IntegratedPerformanceOptimizer] Initializing performance optimizations...");

      // 1. Initialize memory management
      enhancedMemoryManager.getCurrentMemoryUsage();

      // 2. Initialize cache optimization
      const cacheOptimizer = getPerformanceCacheOptimizer(globalCacheManager);
      await cacheOptimizer.warmupCache(["api:mexc:*", "pattern:*"]);

      // 3. Initialize bundle optimization
      await bundleOptimizer.optimizeApplication();

      // 4. Initialize lazy loading
      globalLazyLoader.preload(["trading-components", "chart-components"], "high");

      // 5. Start memory monitoring
      memoryManager.startMonitoring();

      this.initialized = true;
      console.info("[IntegratedPerformanceOptimizer] All optimizations initialized successfully");
    } catch (error) {
      console.error("[IntegratedPerformanceOptimizer] Initialization failed:", error);
      throw error;
    }
  }

  async forceOptimization(): Promise<void> {
    console.info("[IntegratedPerformanceOptimizer] Running comprehensive optimization...");

    const optimizations = await Promise.allSettled([
      enhancedMemoryManager.forceOptimization(),
      bundleOptimizer.optimizeApplication(),
      performanceOptimizer.clearMetrics(),
    ]);

    const successful = optimizations.filter((r) => r.status === "fulfilled").length;
    console.info(
      `[IntegratedPerformanceOptimizer] Completed ${successful}/${optimizations.length} optimizations`
    );
  }

  getOverallStats(): {
    memory: any;
    cache: any;
    bundle: any;
    lazyLoading: any;
  } {
    return {
      memory: enhancedMemoryManager.getCurrentMemoryUsage(),
      cache: getPerformanceCacheOptimizer(globalCacheManager).getCacheStats(),
      bundle: bundleOptimizer.analyzeBundlePerformance(),
      lazyLoading: globalLazyLoader.getStats(),
    };
  }

  async destroy(): Promise<void> {
    enhancedMemoryManager.destroy();
    bundleOptimizer.destroy();
    globalLazyLoader.destroy();
    memoryManager.stopMonitoring();

    this.initialized = false;
    console.info("[IntegratedPerformanceOptimizer] All optimizations destroyed");
  }
}

// Global integrated optimizer instance
export const integratedOptimizer = new IntegratedPerformanceOptimizer();

// Auto-initialize in production
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  integratedOptimizer.initialize().catch((error) => {
    console.warn("[IntegratedPerformanceOptimizer] Auto-initialization failed:", error);
  });
}

export default integratedOptimizer;
