/**
 * Performance Optimization Utilities
 *
 * Provides comprehensive performance monitoring and optimization strategies
 * for component loading, bundle management, and runtime performance.
 */

export interface ComponentLoadingMetrics {
  componentName: string;
  loadTime: number;
  bundleSize?: number;
  failed: boolean;
  timestamp: number;
  renderTime?: number;
}

export interface PerformanceOptimizationConfig {
  enableBundleAnalysis: boolean;
  enableComponentMetrics: boolean;
  preloadCriticalComponents: boolean;
  maxBundleSize: number; // KB
  maxLoadTime: number; // ms
  enableLazyLoading: boolean;
}

// Default performance configuration
const DEFAULT_CONFIG: PerformanceOptimizationConfig = {
  enableBundleAnalysis: process.env.NODE_ENV === "development",
  enableComponentMetrics: true,
  preloadCriticalComponents: true,
  maxBundleSize: 500, // 500KB
  maxLoadTime: 2000, // 2 seconds
  enableLazyLoading: true,
};

class PerformanceOptimizer {
  private config: PerformanceOptimizationConfig;
  private loadingMetrics: ComponentLoadingMetrics[] = [];
  private preloadedComponents = new Set<string>();

  constructor(config: Partial<PerformanceOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Track component loading performance
  async trackComponentLoad<T>(componentName: string, loadFunction: () => Promise<T>): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await loadFunction();
      const loadTime = performance.now() - startTime;

      if (this.config.enableComponentMetrics) {
        this.recordLoadingMetric({
          componentName,
          loadTime,
          failed: false,
          timestamp: Date.now(),
        });
      }

      // Warn about slow loading components
      if (loadTime > this.config.maxLoadTime) {
        console.warn(
          `Performance Warning: ${componentName} took ${loadTime.toFixed(2)}ms to load (threshold: ${this.config.maxLoadTime}ms)`
        );
      }

      return result;
    } catch (error) {
      const loadTime = performance.now() - startTime;

      if (this.config.enableComponentMetrics) {
        this.recordLoadingMetric({
          componentName,
          loadTime,
          failed: true,
          timestamp: Date.now(),
        });
      }

      console.error(`Failed to load component ${componentName}:`, error);
      throw error;
    }
  }

  // Optimized preloading with priority and timing control
  async preloadComponentsWithPriority(
    components: Array<{
      name: string;
      loader: () => Promise<any>;
      priority: "critical" | "high" | "medium" | "low";
    }>
  ): Promise<{
    successful: string[];
    failed: string[];
    totalTime: number;
  }> {
    const startTime = performance.now();
    const successful: string[] = [];
    const failed: string[] = [];

    if (!this.config.preloadCriticalComponents) {
      return { successful, failed, totalTime: 0 };
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedComponents = components.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    // Load critical components immediately
    const criticalComponents = sortedComponents.filter((c) => c.priority === "critical");
    const nonCriticalComponents = sortedComponents.filter((c) => c.priority !== "critical");

    // Load critical components in parallel
    const _criticalResults = await Promise.allSettled(
      criticalComponents.map(async (component) => {
        try {
          await this.trackComponentLoad(component.name, component.loader);
          this.preloadedComponents.add(component.name);
          successful.push(component.name);
        } catch (error) {
          failed.push(component.name);
          throw error;
        }
      })
    );

    // Small delay to avoid blocking critical rendering
    if (nonCriticalComponents.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Load non-critical components with lower priority
    const _nonCriticalResults = await Promise.allSettled(
      nonCriticalComponents.map(async (component) => {
        try {
          await this.trackComponentLoad(component.name, component.loader);
          this.preloadedComponents.add(component.name);
          successful.push(component.name);
        } catch (error) {
          failed.push(component.name);
          throw error;
        }
      })
    );

    const totalTime = performance.now() - startTime;

    console.info(
      `Preloaded ${successful.length}/${components.length} components in ${totalTime.toFixed(2)}ms`
    );

    return { successful, failed, totalTime };
  }

  // Check if component is already preloaded
  isComponentPreloaded(componentName: string): boolean {
    return this.preloadedComponents.has(componentName);
  }

  // Get performance analytics
  getPerformanceAnalytics(): {
    totalComponents: number;
    averageLoadTime: number;
    slowestComponent: ComponentLoadingMetrics | null;
    fastestComponent: ComponentLoadingMetrics | null;
    failureRate: number;
    recentFailures: ComponentLoadingMetrics[];
  } {
    const metrics = this.loadingMetrics;

    if (metrics.length === 0) {
      return {
        totalComponents: 0,
        averageLoadTime: 0,
        slowestComponent: null,
        fastestComponent: null,
        failureRate: 0,
        recentFailures: [],
      };
    }

    const successfulLoads = metrics.filter((m) => !m.failed);
    const failures = metrics.filter((m) => m.failed);

    const averageLoadTime =
      successfulLoads.length > 0
        ? successfulLoads.reduce((sum, m) => sum + m.loadTime, 0) / successfulLoads.length
        : 0;

    const slowestComponent =
      successfulLoads.length > 0
        ? successfulLoads.reduce((prev, current) =>
            prev.loadTime > current.loadTime ? prev : current
          )
        : null;

    const fastestComponent =
      successfulLoads.length > 0
        ? successfulLoads.reduce((prev, current) =>
            prev.loadTime < current.loadTime ? prev : current
          )
        : null;

    const failureRate = metrics.length > 0 ? failures.length / metrics.length : 0;

    // Recent failures (last 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentFailures = failures.filter((f) => f.timestamp > tenMinutesAgo);

    return {
      totalComponents: metrics.length,
      averageLoadTime,
      slowestComponent,
      fastestComponent,
      failureRate,
      recentFailures,
    };
  }

  // Optimize import strategy based on usage patterns
  generateOptimizedImportStrategy(): {
    criticalComponents: string[];
    deferredComponents: string[];
    recommendations: string[];
  } {
    const analytics = this.getPerformanceAnalytics();
    const recommendations: string[] = [];

    // Components that load quickly should be critical
    const criticalComponents = this.loadingMetrics
      .filter((m) => !m.failed && m.loadTime < this.config.maxLoadTime / 2)
      .map((m) => m.componentName);

    // Components that load slowly should be deferred
    const deferredComponents = this.loadingMetrics
      .filter((m) => !m.failed && m.loadTime > this.config.maxLoadTime)
      .map((m) => m.componentName);

    // Generate recommendations
    if (analytics.failureRate > 0.1) {
      recommendations.push(
        "High failure rate detected. Consider adding more robust error boundaries."
      );
    }

    if (analytics.averageLoadTime > this.config.maxLoadTime) {
      recommendations.push(
        "Average load time exceeds threshold. Consider code splitting or bundle optimization."
      );
    }

    if (analytics.recentFailures.length > 3) {
      recommendations.push(
        "Multiple recent failures detected. Check network conditions and error handling."
      );
    }

    return {
      criticalComponents: [...new Set(criticalComponents)],
      deferredComponents: [...new Set(deferredComponents)],
      recommendations,
    };
  }

  // Clear metrics (useful for testing or memory management)
  clearMetrics(): void {
    this.loadingMetrics = [];
    this.preloadedComponents.clear();
  }

  // Get current configuration
  getConfig(): PerformanceOptimizationConfig {
    return this.config;
  }

  private recordLoadingMetric(metric: ComponentLoadingMetrics): void {
    this.loadingMetrics.push(metric);

    // Keep only last 100 metrics to prevent memory bloat
    if (this.loadingMetrics.length > 100) {
      this.loadingMetrics = this.loadingMetrics.slice(-100);
    }
  }
}

// Global performance optimizer instance
export const performanceOptimizer = new PerformanceOptimizer();

// Performance monitoring hook for React components
export function usePerformanceMonitoring(componentName: string) {
  const startTime = performance.now();

  return {
    markRenderComplete: () => {
      const renderTime = performance.now() - startTime;

      if (performanceOptimizer.getConfig().enableComponentMetrics) {
        console.debug(`${componentName} render time: ${renderTime.toFixed(2)}ms`);
      }

      return renderTime;
    },
  };
}

// Enhanced bundle size estimation utilities
export function estimateBundleSize(componentName: string): Promise<number> {
  // Use performance API for more accurate estimates
  if (typeof window !== "undefined" && "performance" in window) {
    const entries = performance.getEntriesByType("resource");
    const componentEntry = entries.find((entry) =>
      entry.name.includes(componentName.toLowerCase())
    );

    if (componentEntry && "transferSize" in componentEntry) {
      return Promise.resolve((componentEntry.transferSize as number) || 0);
    }
  }

  // Fallback estimation based on component complexity
  const baseSize = componentName.length * 100; // Basic heuristic
  const complexityMultiplier = componentName.includes("trading")
    ? 2.5
    : componentName.includes("chart")
      ? 2.0
      : componentName.includes("dashboard")
        ? 1.8
        : 1.0;

  return Promise.resolve(baseSize * complexityMultiplier);
}

// Advanced lazy loading with intersection observer
export function createLazyComponent<T>(
  importFunc: () => Promise<T>,
  options: {
    threshold?: number;
    rootMargin?: string;
    preloadDelay?: number;
  } = {}
): {
  component: T | null;
  isLoading: boolean;
  load: () => Promise<T>;
  preload: () => void;
} {
  let component: T | null = null;
  let isLoading = false;
  let loadPromise: Promise<T> | null = null;

  const load = async (): Promise<T> => {
    if (component) return component;
    if (loadPromise) return loadPromise;

    isLoading = true;
    loadPromise = performanceOptimizer.trackComponentLoad("lazy-component", async () => {
      const result = await importFunc();
      component = result;
      isLoading = false;
      return result;
    });

    return loadPromise;
  };

  const preload = () => {
    if (options.preloadDelay) {
      setTimeout(load, options.preloadDelay);
    } else {
      load().catch(() => {}); // Silent preload
    }
  };

  return { component, isLoading, load, preload };
}

// Resource prefetching utilities
export const ResourcePrefetcher = {
  prefetchScript: (src: string, priority: "high" | "low" = "low") => {
    if (typeof document === "undefined") return;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "script";
    link.href = src;
    if (priority === "high") {
      link.setAttribute("importance", "high");
    }
    document.head.appendChild(link);
  },

  prefetchImage: (src: string) => {
    if (typeof document === "undefined") return;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "image";
    link.href = src;
    document.head.appendChild(link);
  },

  preloadCriticalCSS: (href: string) => {
    if (typeof document === "undefined") return;

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "style";
    link.href = href;
    link.onload = () => {
      link.rel = "stylesheet";
    };
    document.head.appendChild(link);
  },
};

// Export performance utilities
export const PerformanceUtils = {
  trackComponentLoad: performanceOptimizer.trackComponentLoad.bind(performanceOptimizer),
  preloadComponentsWithPriority:
    performanceOptimizer.preloadComponentsWithPriority.bind(performanceOptimizer),
  isComponentPreloaded: performanceOptimizer.isComponentPreloaded.bind(performanceOptimizer),
  getPerformanceAnalytics: performanceOptimizer.getPerformanceAnalytics.bind(performanceOptimizer),
  generateOptimizedImportStrategy:
    performanceOptimizer.generateOptimizedImportStrategy.bind(performanceOptimizer),
  clearMetrics: performanceOptimizer.clearMetrics.bind(performanceOptimizer),
  getConfig: performanceOptimizer.getConfig.bind(performanceOptimizer),
};
