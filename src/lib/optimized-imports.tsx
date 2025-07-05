/**
 * OPTIMIZED IMPORTS MANAGER
 * 
 * PERFORMANCE OPTIMIZATION: Dynamic loading and tree-shaking for heavy components
 * Addresses Agent 6's finding of inefficient import statements and large bundle sizes
 */

import React, { lazy, ComponentType, ReactElement } from 'react';
import dynamic from 'next/dynamic';

/**
 * PERFORMANCE: Lazy loading configuration for heavy components
 */
interface LazyLoadConfig {
  loading?: ComponentType;
  error?: ComponentType<{ error: Error; retry: () => void }>;
  timeout?: number;
  ssr?: boolean;
}

/**
 * CRITICAL: Optimized component loader with performance monitoring
 */
export function createOptimizedLoader<P = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  config: LazyLoadConfig = {}
): ComponentType<P> {
  return dynamic(importFn, {
    loading: config.loading || (() => <div>Loading...</div>),
    ssr: config.ssr ?? false, // Disable SSR by default for performance
  });
}

/**
 * PERFORMANCE: Tree-shakable imports for UI components
 */
export const OptimizedUIComponents = {
  // Heavy dashboard components - load only when needed
  TradingDashboard: createOptimizedLoader(
    () => import('@/src/components/dashboard/simplified-trading-dashboard'),
    { timeout: 5000 }
  ),
  
  MonitoringDashboard: createOptimizedLoader(
    () => import('@/src/components/monitoring/production-monitoring-dashboard'),
    { timeout: 5000 }
  ),

  PerformanceDashboard: createOptimizedLoader(
    () => import('@/src/components/dashboard/performance-monitoring-dashboard'),
    { timeout: 5000 }
  ),

  SafetyDashboard: createOptimizedLoader(
    () => import('@/src/components/safety/comprehensive-safety-dashboard'),
    { timeout: 5000 }
  ),

  // Heavy chart components
  TradingChart: createOptimizedLoader(
    () => import('@/src/components/dashboard/trading-chart'),
    { timeout: 3000 }
  ),

  // Heavy table components
  RecentTradesTable: createOptimizedLoader(
    () => import('@/src/components/dashboard/recent-trades-table'),
    { timeout: 3000 }
  ),

  // Agent dashboard
  AgentsDashboard: createOptimizedLoader(
    () => import('@/src/components/optimized-agents-dashboard'),
    { timeout: 5000 }
  ),

  // Auto-sniping components
  AutoSnipingDashboard: createOptimizedLoader(
    () => import('@/src/components/auto-sniping/enhanced-auto-sniping-dashboard'),
    { timeout: 5000 }
  ),

  // Tuning components
  ParameterOptimizationDashboard: createOptimizedLoader(
    () => import('@/src/components/tuning/parameter-optimization-dashboard'),
    { timeout: 5000 }
  ),
};

/**
 * PERFORMANCE: Optimized utility imports with tree-shaking
 */
export const OptimizedUtils = {
  // Date utilities - only import what's needed
  formatDate: () => import('date-fns/format').then(m => m.format),
  formatDistanceToNow: () => import('date-fns/formatDistanceToNow').then(m => m.formatDistanceToNow),
  parseISO: () => import('date-fns/parseISO').then(m => m.parseISO),
  
  // Lodash utilities - tree-shakable imports
  debounce: () => import('lodash/debounce').then(m => m.default),
  throttle: () => import('lodash/throttle').then(m => m.default),
  merge: () => import('lodash/merge').then(m => m.default),
  
  // Crypto utilities
  randomUUID: () => import('crypto').then(m => m.randomUUID),
};

/**
 * PERFORMANCE: Optimized service imports
 */
export const OptimizedServices = {
  // Heavy trading services
  tradingService: () => import('@/src/services/trading/consolidated/core-trading/core-trading-service'),
  patternDetection: () => import('@/src/core/pattern-detection/pattern-detection-core-enhanced'),
  
  // Calendar services
  calendarService: () => import('@/src/services/data/modules/calendar-listings.service'),
  
  // Agent services
  simulationAgent: () => import('@/src/mexc-agents/simulation-agent'),
  patternAgent: () => import('@/src/mexc-agents/pattern-discovery-agent'),
  
  // Performance monitoring
  performanceMonitor: () => import('@/src/lib/real-time-performance-monitor'),
};

/**
 * CRITICAL: Bundle size optimization utilities
 */
export class BundleOptimizer {
  private static loadedModules = new Set<string>();
  
  /**
   * PERFORMANCE: Track module loading for optimization
   */
  static trackModuleLoad(moduleName: string): void {
    this.loadedModules.add(moduleName);
    
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[BundleOptimizer] Loaded module: ${moduleName}`);
    }
  }

  /**
   * PERFORMANCE: Get bundle loading statistics
   */
  static getLoadingStats() {
    return {
      totalModulesLoaded: this.loadedModules.size,
      loadedModules: Array.from(this.loadedModules),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * PERFORMANCE: Preload critical components
   */
  static async preloadCritical(): Promise<void> {
    if (typeof window !== 'undefined') {
      // Only preload on client-side
      const criticalImports = [
        import('@/src/components/dashboard/simplified-trading-dashboard'),
        import('@/src/lib/real-time-performance-monitor'),
      ];

      try {
        await Promise.all(criticalImports);
        this.trackModuleLoad('critical-components');
      } catch (error) {
        console.warn('[BundleOptimizer] Failed to preload critical components:', error);
      }
    }
  }
}

/**
 * PERFORMANCE: Create optimized service proxy
 */
export function createServiceProxy<T>(
  serviceName: string,
  importFn: () => Promise<{ default: new (...args: any[]) => T } | T>
): T {
  let serviceInstance: T | null = null;
  let loadingPromise: Promise<T> | null = null;

  const serviceProxy = new Proxy({} as T, {
    get(target, prop: keyof T) {
      // If service is already loaded, use it directly
      if (serviceInstance) {
        const value = serviceInstance[prop];
        if (typeof value === 'function') {
          return (value as Function).bind(serviceInstance);
        }
        return value;
      }

      // If loading is in progress, wait for it
      if (loadingPromise) {
        return (...args: any[]) => {
          return loadingPromise!.then((service) => {
            const method = service[prop];
            if (typeof method === 'function') {
              return (method as Function).apply(service, args);
            }
            return method;
          });
        };
      }

      // Start loading the service
      loadingPromise = importFn().then((imported) => {
        let service: T;
        
        if (typeof imported === 'function') {
          // Constructor function
          service = new (imported as any)();
        } else if (imported.default && typeof imported.default === 'function') {
          // Default export constructor
          service = new imported.default();
        } else if (imported.default) {
          // Default export instance
          service = imported.default;
        } else {
          // Direct export
          service = imported as T;
        }

        serviceInstance = service;
        BundleOptimizer.trackModuleLoad(serviceName);
        return service;
      });

      // Return a function that waits for loading to complete
      return (...args: any[]) => {
        return loadingPromise!.then((service) => {
          const method = service[prop];
          if (typeof method === 'function') {
            return (method as Function).apply(service, args);
          }
          return method;
        });
      };
    }
  });

  return serviceProxy;
}

/**
 * PERFORMANCE: Optimized re-export utilities
 */
export { BundleOptimizer };

// Initialize bundle optimization on module load
if (typeof window !== 'undefined') {
  // Client-side initialization
  BundleOptimizer.preloadCritical();
}