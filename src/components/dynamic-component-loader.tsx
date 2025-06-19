/**
 * Dynamic Component Loader
 * Implements lazy loading for dashboard components to reduce initial bundle size
 * Part of Task 5.1: Bundle Size Optimization
 */

"use client";

import { Suspense, lazy } from "react";
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

// Lazy loaded dashboard components
export const OptimizedCoinCalendar = lazy(() =>
  import("./optimized-coin-calendar").then((module) => ({
    default: module.OptimizedCoinCalendar,
  }))
);

export const OptimizedAccountBalance = lazy(() =>
  import("./optimized-account-balance").then((module) => ({
    default: module.OptimizedAccountBalance,
  }))
);

export const OptimizedWebSocketMonitor = lazy(() =>
  import("./optimized-websocket-monitor").then((module) => ({
    default: module.OptimizedWebSocketMonitor,
  }))
);

export const SafetyMonitoringDashboard = lazy(() =>
  import("./safety-monitoring-dashboard").then((module) => ({
    default: module.SafetyMonitoringDashboard,
  }))
);

export const PatternSniper = lazy(() =>
  import("./pattern-sniper").then((module) => ({
    default: module.default || module.PatternSniperComponent,
  }))
);

export const AgentDashboard = lazy(() =>
  import("./agent-dashboard").then((module) => ({
    default: module.AgentDashboard,
  }))
);

export const StrategyManager = lazy(() =>
  import("./strategy-manager").then((module) => ({
    default: module.StrategyManager,
  }))
);

export const WorkflowManager = lazy(() =>
  import("./workflow-manager").then((module) => ({
    default: module.WorkflowManager,
  }))
);

export const TradingConfiguration = lazy(() =>
  import("./trading-configuration").then((module) => ({
    default: module.TradingConfiguration,
  }))
);

export const UserPreferences = lazy(() =>
  import("./user-preferences").then((module) => ({
    default: module.UserPreferences,
  }))
);

// Dashboard section components
export const CoinListingsBoard = lazy(() =>
  import("./dashboard/coin-listings-board").then((module) => ({
    default: module.CoinListingsBoard,
  }))
);

export const MetricCard = lazy(() =>
  import("./dashboard/metric-card").then((module) => ({
    default: module.MetricCard,
  }))
);

export const OptimizedActivityFeed = lazy(() =>
  import("./dashboard/optimized-activity-feed").then((module) => ({
    default: module.OptimizedActivityFeed,
  }))
);

export const OptimizedMetricsGrid = lazy(() =>
  import("./dashboard/optimized-metrics-grid").then((module) => ({
    default: module.OptimizedMetricsGrid,
  }))
);

export const OptimizedTradingTargets = lazy(() =>
  import("./dashboard/optimized-trading-targets").then((module) => ({
    default: module.OptimizedTradingTargets,
  }))
);

export const RecentTradesTable = lazy(() =>
  import("./dashboard/recent-trades-table").then((module) => ({
    default: module.RecentTradesTable,
  }))
);

export const TradingChart = lazy(() =>
  import("./dashboard/trading-chart").then((module) => ({
    default: module.TradingChart,
  }))
);

export const UpcomingCoinsSection = lazy(() =>
  import("./dashboard/upcoming-coins-section").then((module) => ({
    default: module.UpcomingCoinsSection,
  }))
);

export const WorkflowStatusCard = lazy(() =>
  import("./dashboard/workflow-status-card").then((module) => ({
    default: module.WorkflowStatusCard,
  }))
);

// Wrapper components with loading states
interface LazyComponentWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function LazyComponentWrapper({
  children,
  fallback = <ComponentSkeleton />,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

export function LazyCardWrapper({
  children,
  fallback = <CardSkeleton />,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

export function LazyTableWrapper({
  children,
  fallback = <TableSkeleton />,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

// Preload functions for better UX
export function preloadDashboardComponents() {
  // Preload critical dashboard components
  const preloadPromises = [
    import("./dashboard/coin-listings-board"),
    import("./dashboard/optimized-metrics-grid"),
    import("./dashboard/upcoming-coins-section"),
    import("./optimized-coin-calendar"),
  ];

  return Promise.all(preloadPromises);
}

export function preloadAgentComponents() {
  // Preload agent-related components
  const preloadPromises = [
    import("./agent-dashboard"),
    import("./pattern-sniper"),
    import("./safety-monitoring-dashboard"),
  ];

  return Promise.all(preloadPromises);
}

export function preloadTradingComponents() {
  // Preload trading-related components
  const preloadPromises = [
    import("./trading-configuration"),
    import("./strategy-manager"),
    import("./dashboard/trading-chart"),
    import("./dashboard/recent-trades-table"),
  ];

  return Promise.all(preloadPromises);
}
