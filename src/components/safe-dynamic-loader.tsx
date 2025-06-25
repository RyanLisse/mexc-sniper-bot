/**
 * Safe Dynamic Component Loader
 * 
 * Prevents client-side exceptions from failed dynamic imports by providing
 * comprehensive error handling and fallbacks for dashboard components.
 */

"use client";

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { ErrorBoundary } from "./error-boundary";
import { Skeleton } from "./ui/optimized-exports";

// Loading fallback components
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

// Safe lazy wrapper that handles import failures
function safeLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  fallbackComponent?: ComponentType<any>
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error) => {
      console.warn("Failed to load component:", error);
      // Return fallback or empty component
      return {
        default: fallbackComponent || (() => (
          <div className="p-4 text-center text-gray-500">
            Component failed to load
          </div>
        )) as T,
      };
    })
  );
}

// Safe wrapper component for lazy components
export function SafeLazyWrapper({
  children,
  fallback,
  errorFallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
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

// Safely loaded dashboard components with comprehensive error handling
export const MetricCard = safeLazy(
  () => import("./dashboard/metric-card").catch(() => 
    Promise.resolve({ 
      default: ({ title, value }: { title: string; value: string }) => (
        <div className="rounded-lg border p-4">
          <div className="font-medium">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      )
    })
  )
);

export const TradingChart = safeLazy(
  () => import("./dashboard/trading-chart").catch(() =>
    Promise.resolve({
      default: () => (
        <div className="rounded-lg border p-4 h-64 flex items-center justify-center">
          <div className="text-gray-500">Trading Chart</div>
        </div>
      )
    })
  )
);

export const CoinListingsBoard = safeLazy(
  () => import("./dashboard/coin-listings-board").catch(() =>
    Promise.resolve({
      default: () => (
        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-2">Coin Listings</h3>
          <div className="text-gray-500">Loading coin listings...</div>
        </div>
      )
    })
  )
);

export const OptimizedActivityFeed = safeLazy(
  () => import("./dashboard/optimized-activity-feed").catch(() =>
    Promise.resolve({
      default: () => (
        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-2">Activity Feed</h3>
          <div className="text-gray-500">No recent activity</div>
        </div>
      )
    })
  )
);

export const OptimizedTradingTargets = safeLazy(
  () => import("./dashboard/optimized-trading-targets").catch(() =>
    Promise.resolve({
      default: () => (
        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-2">Trading Targets</h3>
          <div className="text-gray-500">No active targets</div>
        </div>
      )
    })
  )
);

export const RecentTradesTable = safeLazy(
  () => import("./dashboard/recent-trades-table").catch(() =>
    Promise.resolve({
      default: () => (
        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-2">Recent Trades</h3>
          <TableSkeleton />
        </div>
      )
    })
  )
);

export const UpcomingCoinsSection = safeLazy(
  () => import("./dashboard/upcoming-coins-section").catch(() =>
    Promise.resolve({
      default: () => (
        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-2">Upcoming Coins</h3>
          <div className="text-gray-500">No upcoming listings</div>
        </div>
      )
    })
  )
);

export const OptimizedAccountBalance = safeLazy(
  () => import("./optimized-account-balance").catch(() =>
    Promise.resolve({
      default: () => (
        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-2">Account Balance</h3>
          <div className="text-2xl font-bold">$0.00</div>
        </div>
      )
    })
  )
);

// Wrapper components with safe loading
export function LazyDashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeLazyWrapper
      fallback={<CardSkeleton />}
      errorFallback={
        <div className="rounded-lg border border-red-200 p-4 text-red-600">
          Dashboard component failed to load
        </div>
      }
    >
      {children}
    </SafeLazyWrapper>
  );
}

export function LazyChartWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeLazyWrapper
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
    </SafeLazyWrapper>
  );
}

export function LazyCardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeLazyWrapper
      fallback={<CardSkeleton />}
      errorFallback={
        <div className="rounded-lg border border-amber-200 p-4 text-amber-600">
          Component temporarily unavailable
        </div>
      }
    >
      {children}
    </SafeLazyWrapper>
  );
}

export function LazyTableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SafeLazyWrapper
      fallback={<TableSkeleton />}
      errorFallback={
        <div className="rounded-lg border border-gray-200 p-4 text-gray-600">
          Table data temporarily unavailable
        </div>
      }
    >
      {children}
    </SafeLazyWrapper>
  );
}

// Safe preloading function with error handling
export async function preloadDashboardComponents() {
  const componentsToPreload = [
    () => import("./dashboard/metric-card"),
    () => import("./dashboard/trading-chart"),
    () => import("./dashboard/coin-listings-board"),
    () => import("./dashboard/optimized-activity-feed"),
    () => import("./dashboard/optimized-trading-targets"),
    () => import("./dashboard/recent-trades-table"),
    () => import("./dashboard/upcoming-coins-section"),
    () => import("./optimized-account-balance"),
  ];

  const results = await Promise.allSettled(
    componentsToPreload.map(loader => loader())
  );

  // Log any failed preloads for debugging
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`Failed to preload component ${index}:`, result.reason);
    }
  });

  // Return summary of preload results
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.info(`Preloaded ${successful}/${successful + failed} dashboard components`);
  
  return {
    successful,
    failed,
    total: successful + failed,
  };
}