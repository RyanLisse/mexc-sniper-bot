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

// Specialized skeletons for heavy dashboard components
const DashboardSkeleton = () => (
  <div className="grid gap-4 p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <Skeleton className="h-6 w-1/4" />
        <TableSkeleton />
      </div>
    </div>
  </div>
);

const ChartSkeleton = () => (
  <div className="rounded-lg border p-4 space-y-3">
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-64 w-full" />
    <div className="flex justify-between">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-16" />
    </div>
  </div>
);

const TradingSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-1/4" />
      <Skeleton className="h-8 w-32" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <ChartSkeleton />
    <TableSkeleton />
  </div>
);

const ExecutionSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartSkeleton />
      <TableSkeleton />
    </div>
  </div>
);

const SafetySkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <ChartSkeleton />
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  </div>
);

const AlertSkeleton = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-8 w-24" />
    </div>
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => i).map((skeletonId) => (
        <div key={`loading-skeleton-${skeletonId}`} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
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

// TIER 1 HEAVY COMPONENTS: Critical for 70% faster load performance
export const TradingAnalyticsDashboard = lazy(() =>
  import("./monitoring/trading-analytics-dashboard").then((module) => ({
    default: module.TradingAnalyticsDashboard,
  }))
);

export const AutoSnipingExecutionDashboard = lazy(() =>
  import("./auto-sniping/auto-sniping-execution-dashboard").then((module) => ({
    default: module.AutoSnipingExecutionDashboard,
  }))
);

export const AlertCenter = lazy(() =>
  import("./monitoring/alert-center").then((module) => ({
    default: module.AlertCenter,
  }))
);

export const RealTimeSafetyDashboard = lazy(() =>
  import("./auto-sniping/real-time-safety-dashboard").then((module) => ({
    default: module.RealTimeSafetyDashboard,
  }))
);

export const ComprehensiveSafetyDashboard = lazy(() =>
  import("./safety/comprehensive-safety-dashboard").then((module) => ({
    default: module.ComprehensiveSafetyDashboard,
  }))
);

export const RealTimePerformance = lazy(() =>
  import("./monitoring/real-time-performance").then((module) => ({
    default: module.RealTimePerformance,
  }))
);

// TIER 2 HEAVY COMPONENTS: Quick wins for performance
export const RealTimeDashboard = lazy(() => import("./dashboard/real-time-dashboard"));

export const AlertsDashboard = lazy(() =>
  import("./alerts/alerts-dashboard").then((module) => ({
    default: module.AlertsDashboard,
  }))
);

export const UnifiedTakeProfitSettings = lazy(() =>
  import("./unified-take-profit-settings").then((module) => ({
    default: module.UnifiedTakeProfitSettings,
  }))
);

export const SystemArchitectureOverview = lazy(() =>
  import("./monitoring/system-architecture-overview").then((module) => ({
    default: module.SystemArchitectureOverview,
  }))
);

export const EditableTakeProfitTable = lazy(() =>
  import("./editable-take-profit-table").then((module) => ({
    default: module.EditableTakeProfitTable,
  }))
);

export const ParameterMonitor = lazy(() =>
  import("./tuning/parameter-monitor").then((module) => ({
    default: module.ParameterMonitor,
  }))
);

export const OptimizationControlPanel = lazy(() =>
  import("./tuning/optimization-control-panel").then((module) => ({
    default: module.OptimizationControlPanel,
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

// Specialized wrappers for heavy dashboard components
export function LazyDashboardWrapper({
  children,
  fallback = <DashboardSkeleton />,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

export function LazyTradingWrapper({
  children,
  fallback = <TradingSkeleton />,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

export function LazyExecutionWrapper({
  children,
  fallback = <ExecutionSkeleton />,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

export function LazySafetyWrapper({
  children,
  fallback = <SafetySkeleton />,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

export function LazyAlertWrapper({
  children,
  fallback = <AlertSkeleton />,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <Suspense fallback={fallback}>
      <div className={className}>{children}</div>
    </Suspense>
  );
}

export function LazyChartWrapper({
  children,
  fallback = <ChartSkeleton />,
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
    import("./dashboard/real-time-dashboard"),
  ];

  return Promise.all(preloadPromises);
}

export function preloadAgentComponents() {
  // Preload agent-related components
  const preloadPromises = [
    import("./agent-dashboard"),
    import("./pattern-sniper"),
    import("./safety-monitoring-dashboard"),
    import("./auto-sniping/auto-sniping-execution-dashboard"),
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
    import("./monitoring/trading-analytics-dashboard"),
  ];

  return Promise.all(preloadPromises);
}

// NEW: Preload functions for Tier 1 heavy components
export function preloadHeavyDashboardComponents() {
  // Preload the heaviest dashboard components for maximum impact
  const preloadPromises = [
    import("./monitoring/trading-analytics-dashboard"),
    import("./auto-sniping/auto-sniping-execution-dashboard"),
    import("./monitoring/alert-center"),
    import("./auto-sniping/real-time-safety-dashboard"),
    import("./safety/comprehensive-safety-dashboard"),
    import("./monitoring/real-time-performance"),
  ];

  return Promise.all(preloadPromises);
}

export function preloadMonitoringComponents() {
  // Preload monitoring page components
  const preloadPromises = [
    import("./monitoring/trading-analytics-dashboard"),
    import("./monitoring/real-time-performance"),
    import("./monitoring/system-architecture-overview"),
    import("./tuning/parameter-monitor"),
  ];

  return Promise.all(preloadPromises);
}

export function preloadSafetyComponents() {
  // Preload safety-related components
  const preloadPromises = [
    import("./auto-sniping/real-time-safety-dashboard"),
    import("./safety/comprehensive-safety-dashboard"),
    import("./monitoring/alert-center"),
  ];

  return Promise.all(preloadPromises);
}

export function preloadSettingsComponents() {
  // Preload settings components
  const preloadPromises = [
    import("./unified-take-profit-settings"),
    import("./editable-take-profit-table"),
    import("./tuning/optimization-control-panel"),
  ];

  return Promise.all(preloadPromises);
}

// Smart preloading based on user navigation patterns
export function preloadByRoute(currentRoute: string) {
  switch (currentRoute) {
    case "/dashboard":
      return preloadDashboardComponents();
    case "/monitoring":
      return preloadMonitoringComponents();
    case "/safety":
      return preloadSafetyComponents();
    case "/settings":
      return preloadSettingsComponents();
    default:
      // Preload the most critical components
      return preloadHeavyDashboardComponents();
  }
}
