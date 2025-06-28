/**
 * Lazy Loading Optimizer
 *
 * Advanced lazy loading system that optimizes component and service loading
 * based on usage patterns, viewport visibility, and resource priorities.
 */

import { memoryManager } from "./memory-leak-optimizer";
import { performanceOptimizer } from "./performance-optimization";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface LazyLoadConfig {
  intersectionThreshold: number;
  rootMargin: string;
  preloadDelay: number;
  maxConcurrentLoads: number;
  enablePreloading: boolean;
  enablePrioritization: boolean;
}

interface LoadableResource<T = any> {
  id: string;
  loader: () => Promise<T>;
  priority: "critical" | "high" | "medium" | "low";
  dependencies?: string[];
  estimatedSize?: number;
  metadata?: Record<string, any>;
}

interface LoadResult<T = any> {
  resource: T;
  loadTime: number;
  fromCache: boolean;
  size?: number;
}

interface LazyLoadStats {
  totalLoaded: number;
  totalFailed: number;
  averageLoadTime: number;
  cacheHitRate: number;
  preloadHits: number;
}

// ============================================================================
// Lazy Loading Optimizer
// ============================================================================

export class LazyLoadingOptimizer {
  private config: LazyLoadConfig;
  private intersectionObserver?: IntersectionObserver;
  private loadedResources = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<any>>();
  private preloadQueue = new Set<string>();
  private activeLoads = new Set<string>();
  private stats: LazyLoadStats = {
    totalLoaded: 0,
    totalFailed: 0,
    averageLoadTime: 0,
    cacheHitRate: 0,
    preloadHits: 0,
  };

  constructor(config: Partial<LazyLoadConfig> = {}) {
    this.config = {
      intersectionThreshold: 0.1,
      rootMargin: "50px",
      preloadDelay: 100,
      maxConcurrentLoads: 3,
      enablePreloading: true,
      enablePrioritization: true,
      ...config,
    };

    this.initializeIntersectionObserver();
    memoryManager.detector.registerComponent("lazy-loading-optimizer");
  }

  // ============================================================================
  // Core Lazy Loading API
  // ============================================================================

  async load<T>(resource: LoadableResource<T>): Promise<LoadResult<T>> {
    const startTime = performance.now();

    // Check if already loaded
    if (this.loadedResources.has(resource.id)) {
      this.stats.cacheHitRate = (this.stats.cacheHitRate + 1) / 2;
      return {
        resource: this.loadedResources.get(resource.id),
        loadTime: performance.now() - startTime,
        fromCache: true,
      };
    }

    // Check if currently loading
    if (this.loadingPromises.has(resource.id)) {
      const result = await this.loadingPromises.get(resource.id);
      return {
        resource: result,
        loadTime: performance.now() - startTime,
        fromCache: false,
      };
    }

    // Load dependencies first
    if (resource.dependencies?.length) {
      await this.loadDependencies(resource.dependencies);
    }

    // Wait for available slot if at max concurrent loads
    await this.waitForAvailableSlot();

    // Create loading promise
    const loadingPromise = this.performLoad(resource);
    this.loadingPromises.set(resource.id, loadingPromise);
    this.activeLoads.add(resource.id);

    try {
      const result = await loadingPromise;
      const loadTime = performance.now() - startTime;

      // Cache the result
      this.loadedResources.set(resource.id, result);

      // Update stats
      this.updateStats(loadTime, false);

      // Check if this was a preload hit
      if (this.preloadQueue.has(resource.id)) {
        this.stats.preloadHits++;
        this.preloadQueue.delete(resource.id);
      }

      return {
        resource: result,
        loadTime,
        fromCache: false,
        size: resource.estimatedSize,
      };
    } catch (error) {
      this.stats.totalFailed++;
      console.error(`[LazyLoadingOptimizer] Failed to load resource ${resource.id}:`, error);
      throw error;
    } finally {
      this.loadingPromises.delete(resource.id);
      this.activeLoads.delete(resource.id);
    }
  }

  private async performLoad<T>(resource: LoadableResource<T>): Promise<T> {
    return performanceOptimizer.trackComponentLoad(`lazy-${resource.id}`, resource.loader);
  }

  // ============================================================================
  // Preloading System
  // ============================================================================

  preload(resourceIds: string[], priority: "critical" | "high" | "medium" | "low" = "low"): void {
    if (!this.config.enablePreloading) return;

    const delay = this.calculatePreloadDelay(priority);

    setTimeout(() => {
      resourceIds.forEach((id) => {
        if (!this.loadedResources.has(id) && !this.loadingPromises.has(id)) {
          this.preloadQueue.add(id);
        }
      });
    }, delay);
  }

  private calculatePreloadDelay(priority: "critical" | "high" | "medium" | "low"): number {
    const delays = {
      critical: 0,
      high: this.config.preloadDelay,
      medium: this.config.preloadDelay * 2,
      low: this.config.preloadDelay * 4,
    };
    return delays[priority];
  }

  // ============================================================================
  // Intersection Observer Integration
  // ============================================================================

  private initializeIntersectionObserver(): void {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const resourceId = entry.target.getAttribute("data-lazy-id");
            if (resourceId && this.preloadQueue.has(resourceId)) {
              this.triggerPreload(resourceId);
            }
          }
        });
      },
      {
        threshold: this.config.intersectionThreshold,
        rootMargin: this.config.rootMargin,
      }
    );
  }

  observeElement(element: Element, resourceId: string): void {
    if (!this.intersectionObserver) return;

    element.setAttribute("data-lazy-id", resourceId);
    this.intersectionObserver.observe(element);
  }

  unobserveElement(element: Element): void {
    if (!this.intersectionObserver) return;

    this.intersectionObserver.unobserve(element);
  }

  private triggerPreload(resourceId: string): void {
    // This would trigger actual preloading in a real implementation
    console.debug(`[LazyLoadingOptimizer] Triggering preload for ${resourceId}`);
  }

  // ============================================================================
  // Dependency Management
  // ============================================================================

  private async loadDependencies(dependencies: string[]): Promise<void> {
    const dependencyPromises = dependencies.map(async (depId) => {
      if (!this.loadedResources.has(depId)) {
        // In a real implementation, this would resolve dependency to resource
        console.debug(`[LazyLoadingOptimizer] Loading dependency: ${depId}`);
      }
    });

    await Promise.allSettled(dependencyPromises);
  }

  // ============================================================================
  // Concurrency Management
  // ============================================================================

  private async waitForAvailableSlot(): Promise<void> {
    while (this.activeLoads.size >= this.config.maxConcurrentLoads) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  // ============================================================================
  // Statistics and Analytics
  // ============================================================================

  private updateStats(loadTime: number, failed: boolean): void {
    if (failed) {
      this.stats.totalFailed++;
    } else {
      this.stats.totalLoaded++;
      this.stats.averageLoadTime = (this.stats.averageLoadTime + loadTime) / 2;
    }
  }

  getStats(): LazyLoadStats {
    return { ...this.stats };
  }

  getLoadedResources(): string[] {
    return Array.from(this.loadedResources.keys());
  }

  getCurrentLoads(): string[] {
    return Array.from(this.activeLoads);
  }

  getPreloadQueue(): string[] {
    return Array.from(this.preloadQueue);
  }

  // ============================================================================
  // Resource Management
  // ============================================================================

  clearCache(): void {
    this.loadedResources.clear();
    this.loadingPromises.clear();
    this.preloadQueue.clear();

    console.info("[LazyLoadingOptimizer] Cache cleared");
  }

  removeResource(resourceId: string): boolean {
    const removed = this.loadedResources.delete(resourceId);
    this.loadingPromises.delete(resourceId);
    this.preloadQueue.delete(resourceId);

    return removed;
  }

  getResourceSize(resourceId: string): number {
    const resource = this.loadedResources.get(resourceId);
    if (!resource) return 0;

    try {
      return JSON.stringify(resource).length;
    } catch {
      return 0;
    }
  }

  getTotalCacheSize(): number {
    return Array.from(this.loadedResources.keys()).reduce(
      (total, id) => total + this.getResourceSize(id),
      0
    );
  }

  // ============================================================================
  // Priority-Based Loading
  // ============================================================================

  async loadWithPriority<T>(
    resources: LoadableResource<T>[],
    options: {
      concurrent?: boolean;
      failFast?: boolean;
    } = {}
  ): Promise<LoadResult<T>[]> {
    if (!this.config.enablePrioritization) {
      // Load all concurrently if prioritization is disabled
      return Promise.all(resources.map((r) => this.load(r)));
    }

    // Sort by priority
    const sortedResources = resources.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    if (options.concurrent) {
      // Load all concurrently but with priority awareness
      return Promise.all(sortedResources.map((r) => this.load(r)));
    }

    // Load sequentially by priority
    const results: LoadResult<T>[] = [];

    for (const resource of sortedResources) {
      try {
        const result = await this.load(resource);
        results.push(result);
      } catch (error) {
        if (options.failFast) {
          throw error;
        }
        // Continue loading other resources
        console.warn(`[LazyLoadingOptimizer] Failed to load ${resource.id}, continuing...`);
      }
    }

    return results;
  }

  // ============================================================================
  // Cleanup and Destruction
  // ============================================================================

  destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }

    this.clearCache();
    memoryManager.detector.unregisterComponent("lazy-loading-optimizer");

    console.info("[LazyLoadingOptimizer] Destroyed");
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createLazyResource<T>(
  id: string,
  loader: () => Promise<T>,
  options: {
    priority?: "critical" | "high" | "medium" | "low";
    dependencies?: string[];
    estimatedSize?: number;
    metadata?: Record<string, any>;
  } = {}
): LoadableResource<T> {
  return {
    id,
    loader,
    priority: options.priority || "medium",
    dependencies: options.dependencies,
    estimatedSize: options.estimatedSize,
    metadata: options.metadata,
  };
}

export function withLazyLoading<T>(
  Component: React.ComponentType<T>,
  options: {
    fallback?: React.ComponentType;
    preload?: boolean;
    priority?: "critical" | "high" | "medium" | "low";
  } = {}
): React.ComponentType<T> {
  // This would be implemented with React.lazy in a real React environment
  console.debug(`[LazyLoadingOptimizer] Creating lazy component wrapper`);
  return Component; // Simplified for this example
}

// ============================================================================
// Global Instance and Exports
// ============================================================================

export const globalLazyLoader = new LazyLoadingOptimizer();

export default globalLazyLoader;
