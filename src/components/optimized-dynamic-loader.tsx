/**
 * Optimized Dynamic Component Loader
 *
 * Enhanced version of safe dynamic loader with comprehensive performance optimization,
 * intelligent preloading, and bundle size monitoring.
 */

"use client";

import { type ComponentType, type LazyExoticComponent, lazy, Suspense, useEffect } from "react";
import { ErrorBoundary } from "./error-boundary";
import { Skeleton } from "./ui/optimized-exports";
import { PerformanceUtils } from "../lib/performance-optimization";

// Loading fallback components optimized for performance
const ComponentSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`space-y-3 ${className}`}>
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
  </div>
);

const CardSkeleton = () => (
  <div className="rounded-lg border p-4 space-y-3">
    <Skeleton className="h-6 w-1/3" />
    <ComponentSkeleton />
  </div>
);

const TableSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-8 w-full" />
    <Skeleton className="h-6 w-full" />
    <Skeleton className="h-6 w-full" />
    <Skeleton className="h-6 w-full" />
  </div>
);

// Enhanced lazy wrapper with performance tracking
function createOptimizedLazy<T extends ComponentType<any>>(
  componentName: string,
  factory: () => Promise<{ default: T }>,
  fallbackComponent?: ComponentType<any>,
  priority: 'critical' | 'high' | 'medium' | 'low' = 'medium'
): LazyExoticComponent<T> {
  return lazy(() =>
    PerformanceUtils.trackComponentLoad(componentName, factory).catch((error) => {
      console.warn(`Failed to load ${componentName}:`, error);
      // Return performance-optimized fallback
      return {
        default:
          fallbackComponent ||
          ((() => (
            <div className="p-4 text-center text-gray-500 rounded-lg border">
              {componentName} temporarily unavailable
            </div>
          )) as T),
      };
    })
  );
}

// Performance-optimized component exports with intelligent preloading
export const MetricCard = createOptimizedLazy(
  'MetricCard',
  () => import("./dashboard/metric-card").then(module => ({ default: module.MetricCard })),
  ({ title, value }: { title: string; value: string }) => (
    <div className="rounded-lg border p-4">
      <div className="font-medium">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  ),
  'critical'
);

export const TradingChart = createOptimizedLazy(
  'TradingChart',
  () => import("./dashboard/trading-chart"),
  () => (
    <div className="rounded-lg border p-4 h-64 flex items-center justify-center">
      <div className="text-gray-500">Trading Chart</div>
    </div>
  ),
  'high'
);

export const CoinListingsBoard = createOptimizedLazy(
  'CoinListingsBoard',
  () => import("./dashboard/coin-listings-board").then(module => ({ default: module.CoinListingsBoard })),
  () => (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-2">Coin Listings</h3>
      <div className="text-gray-500">Loading coin listings...</div>
    </div>
  ),
  'high'
);

export const OptimizedActivityFeed = createOptimizedLazy(
  'OptimizedActivityFeed',
  () => import("./dashboard/optimized-activity-feed").then(module => ({ default: module.OptimizedActivityFeed })),
  () => (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-2">Activity Feed</h3>
      <div className="text-gray-500">No recent activity</div>
    </div>
  ),
  'medium'
);

export const OptimizedTradingTargets = createOptimizedLazy(
  'OptimizedTradingTargets',
  () => import("./dashboard/optimized-trading-targets").then(module => ({ default: module.OptimizedTradingTargets })),
  () => (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-2">Trading Targets</h3>
      <div className="text-gray-500">No active targets</div>
    </div>
  ),
  'medium'
);

export const RecentTradesTable = createOptimizedLazy(
  'RecentTradesTable',
  () => import("./dashboard/recent-trades-table").then(module => ({ default: module.RecentTradesTable })),
  () => (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-2">Recent Trades</h3>
      <TableSkeleton />
    </div>
  ),
  'low'
);

export const UpcomingCoinsSection = createOptimizedLazy(
  'UpcomingCoinsSection',
  () => import("./dashboard/upcoming-coins-section").then(module => ({ default: module.UpcomingCoinsSection })),
  () => (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-2">Upcoming Coins</h3>
      <div className="text-gray-500">No upcoming listings</div>
    </div>
  ),
  'low'
);

export const OptimizedAccountBalance = createOptimizedLazy(
  'OptimizedAccountBalance',
  () => import("./optimized-account-balance").then(module => ({ default: module.OptimizedAccountBalance })),
  () => (
    <div className="rounded-lg border p-4">
      <h3 className="font-medium mb-2">Account Balance</h3>
      <div className="text-2xl font-bold">$0.00</div>
    </div>
  ),
  'critical'
);

// Enhanced wrapper components with performance monitoring
export function OptimizedLazyWrapper({
  children,
  fallback,
  errorFallback,
  componentName,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  componentName?: string;
}) {
  return (
    <ErrorBoundary 
      level="component" 
      fallback={errorFallback || <CardSkeleton />}
    >
      <Suspense fallback={fallback || <ComponentSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Performance-optimized preloading with intelligent prioritization
export async function preloadOptimizedDashboardComponents() {
  const components = [
    {
      name: 'MetricCard',
      loader: () => import("./dashboard/metric-card"),
      priority: 'critical' as const,
    },
    {
      name: 'OptimizedAccountBalance', 
      loader: () => import("./optimized-account-balance"),
      priority: 'critical' as const,
    },
    {
      name: 'TradingChart',
      loader: () => import("./dashboard/trading-chart"),
      priority: 'high' as const,
    },
    {
      name: 'CoinListingsBoard',
      loader: () => import("./dashboard/coin-listings-board"),
      priority: 'high' as const,
    },
    {
      name: 'OptimizedActivityFeed',
      loader: () => import("./dashboard/optimized-activity-feed"),
      priority: 'medium' as const,
    },
    {
      name: 'OptimizedTradingTargets',
      loader: () => import("./dashboard/optimized-trading-targets"),
      priority: 'medium' as const,
    },
    {
      name: 'RecentTradesTable',
      loader: () => import("./dashboard/recent-trades-table"),
      priority: 'low' as const,
    },
    {
      name: 'UpcomingCoinsSection',
      loader: () => import("./dashboard/upcoming-coins-section"),
      priority: 'low' as const,
    },
  ];

  const result = await PerformanceUtils.preloadComponentsWithPriority(components);
  
  // Log performance analytics after preloading
  const analytics = PerformanceUtils.getPerformanceAnalytics();
  const strategy = PerformanceUtils.generateOptimizedImportStrategy();
  
  console.info('Dashboard Components Preload Complete:', {
    result,
    analytics: {
      totalComponents: analytics.totalComponents,
      averageLoadTime: `${analytics.averageLoadTime.toFixed(2)}ms`,
      failureRate: `${(analytics.failureRate * 100).toFixed(1)}%`,
    },
    optimizationStrategy: strategy,
  });

  return {
    ...result,
    analytics,
    optimizationStrategy: strategy,
  };
}

// Performance monitoring hook for components
export function useComponentPerformanceMonitoring(componentName: string) {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const renderTime = performance.now() - startTime;
      if (renderTime > 100) { // Log slow renders
        console.debug(`${componentName} had slow render: ${renderTime.toFixed(2)}ms`);
      }
    };
  }, [componentName]);
}

// Bundle size monitoring utility
export function useBundleOptimization() {
  const checkBundlePerformance = () => {
    const analytics = PerformanceUtils.getPerformanceAnalytics();
    const strategy = PerformanceUtils.generateOptimizedImportStrategy();
    
    return {
      shouldPreloadCritical: analytics.averageLoadTime > 1000,
      shouldDeferNonCritical: analytics.averageLoadTime > 2000,
      criticalComponents: strategy.criticalComponents,
      deferredComponents: strategy.deferredComponents,
      recommendations: strategy.recommendations,
    };
  };

  return {
    checkBundlePerformance,
    analytics: PerformanceUtils.getPerformanceAnalytics(),
  };
}

// Export optimized wrappers for backward compatibility
export function LazyDashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <OptimizedLazyWrapper
      componentName="DashboardWrapper"
      fallback={<CardSkeleton />}
      errorFallback={
        <div className="rounded-lg border border-red-200 p-4 text-red-600">
          Dashboard component failed to load
        </div>
      }
    >
      {children}
    </OptimizedLazyWrapper>
  );
}

export function LazyChartWrapper({ children }: { children: React.ReactNode }) {
  return (
    <OptimizedLazyWrapper
      componentName="ChartWrapper"
      fallback={
        <div className="rounded-lg border p-4 h-64 flex items-center justify-center">
          <div className="animate-pulse">Loading chart...</div>
        </div>
      }
      errorFallback={
        <div className="rounded-lg border border-red-200 p-4 h-64 flex items-center justify-center text-red-600">
          Chart failed to load
        </div>
      }
    >
      {children}
    </OptimizedLazyWrapper>
  );
}