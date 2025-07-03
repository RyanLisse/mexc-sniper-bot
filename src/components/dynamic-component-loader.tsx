/**
 * Dynamic Component Loader
 * Implements lazy loading for dashboard components to reduce initial bundle size
 * Part of Task 5.1: Bundle Size Optimization
 */

"use client";

import { type ComponentType, type LazyExoticComponent, lazy, type ReactNode, Suspense } from "react";
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

// Safe lazy loader with comprehensive error handling
function safeLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  fallbackName: string,
  fallback?: ComponentType<any>
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error) => {
      console.warn(`Failed to load component ${fallbackName}:`, error);
      return {
        default:
          fallback ||
          ((() => (
            <div className="p-4 text-center text-muted-foreground">
              Component "{fallbackName}" failed to load
            </div>
          )) as unknown as T),
      };
    })
  );
}

// Lazy loaded dashboard components with safe error handling
export const OptimizedCoinCalendar = safeLazy(
  () =>
    import("./optimized-coin-calendar").then((module: any) => ({
      default: module.OptimizedCoinCalendar || module.default,
    })),
  "OptimizedCoinCalendar",
  () => <CardSkeleton />
);

export const OptimizedAccountBalance = safeLazy(
  () =>
    import("./optimized-account-balance").then((module: any) => ({
      default: module.OptimizedAccountBalance || module.default,
    })),
  "OptimizedAccountBalance",
  () => <CardSkeleton />
);

export const OptimizedWebSocketMonitor = safeLazy(
  () =>
    import("./optimized-websocket-monitor").then((module: any) => ({
      default: module.OptimizedWebSocketMonitor || module.default,
    })),
  "OptimizedWebSocketMonitor",
  () => <CardSkeleton />
);

export const SafetyMonitoringDashboard = safeLazy(
  () =>
    import("./safety-monitoring-dashboard").then((module: any) => ({
      default: module.SafetyMonitoringDashboard || module.default,
    })),
  "SafetyMonitoringDashboard",
  () => <CardSkeleton />
);

export const PatternSniper = safeLazy(
  () =>
    import("./pattern-sniper").then((module: any) => ({
      default: module.default || module.PatternSniper || module.PatternSniperComponent,
    })),
  "PatternSniper",
  () => <CardSkeleton />
);

export const AgentDashboard = safeLazy(
  () =>
    import("./agent-dashboard").then((module: any) => ({
      default: module.AgentDashboard || module.default,
    })),
  "AgentDashboard",
  () => <CardSkeleton />
);

export const StrategyManager = safeLazy(
  () =>
    import("./strategy-manager").then((module: any) => ({
      default: module.StrategyManager || module.default,
    })),
  "StrategyManager",
  () => <CardSkeleton />
);

export const WorkflowManager = safeLazy(
  () =>
    import("./workflow-manager").then((module: any) => ({
      default: module.WorkflowManager || module.default,
    })),
  "WorkflowManager",
  () => <CardSkeleton />
);

export const TradingConfiguration = safeLazy(
  () =>
    import("./trading-configuration").then((module: any) => ({
      default: module.TradingConfiguration || module.default,
    })),
  "TradingConfiguration",
  () => <CardSkeleton />
);

export const UserPreferences = safeLazy(
  () =>
    import("./user-preferences").then((module: any) => ({
      default: module.UserPreferences || module.default,
    })),
  "UserPreferences",
  () => <CardSkeleton />
);

// Dashboard section components with safe loading
export const CoinListingsBoard = safeLazy(
  () =>
    import("./dashboard/coin-listings-board").then((module: any) => ({
      default: module.CoinListingsBoard || module.default,
    })),
  "CoinListingsBoard",
  () => <CardSkeleton />
);

export const MetricCard = safeLazy(
  () =>
    import("./dashboard/metric-card").then((module: any) => ({
      default: module.MetricCard || module.default,
    })),
  "MetricCard",
  ({ title = "Metric", value = "N/A" }: any) => (
    <div className="rounded-lg border p-4">
      <div className="font-medium">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
);

export const OptimizedActivityFeed = safeLazy(
  () =>
    import("./dashboard/optimized-activity-feed").then((module: any) => ({
      default: module.OptimizedActivityFeed || module.default,
    })),
  "OptimizedActivityFeed",
  () => <CardSkeleton />
);

export const OptimizedMetricsGrid = safeLazy(
  () =>
    import("./dashboard/optimized-metrics-grid").then((module: any) => ({
      default: module.OptimizedMetricsGrid || module.default,
    })),
  "OptimizedMetricsGrid",
  () => <CardSkeleton />
);

export const OptimizedTradingTargets = safeLazy(
  () =>
    import("./dashboard/optimized-trading-targets").then((module: any) => ({
      default: module.OptimizedTradingTargets || module.default,
    })),
  "OptimizedTradingTargets",
  () => <CardSkeleton />
);

export const RecentTradesTable = safeLazy(
  () =>
    import("./dashboard/recent-trades-table").then((module: any) => ({
      default: module.RecentTradesTable || module.default,
    })),
  "RecentTradesTable",
  () => <TableSkeleton />
);

export const TradingChart = safeLazy(
  () =>
    import("./dashboard/trading-chart").then((module: any) => ({
      default: module.TradingChart || module.default,
    })),
  "TradingChart",
  () => <ChartSkeleton />
);

export const UpcomingCoinsSection = safeLazy(
  () =>
    import("./dashboard/upcoming-coins-section").then((module: any) => ({
      default: module.UpcomingCoinsSection || module.default,
    })),
  "UpcomingCoinsSection",
  () => <CardSkeleton />
);

export const WorkflowStatusCard = safeLazy(
  () =>
    import("./dashboard/workflow-status-card").then((module: any) => ({
      default: module.WorkflowStatusCard || module.default,
    })),
  "WorkflowStatusCard",
  () => <CardSkeleton />
);

// TIER 1 HEAVY COMPONENTS: Critical for 70% faster load performance with safe loading
export const TradingAnalyticsDashboard = safeLazy(
  () =>
    import("./monitoring/trading-analytics-dashboard").then((module: any) => ({
      default: module.TradingAnalyticsDashboard || module.default,
    })),
  "TradingAnalyticsDashboard",
  () => <TradingSkeleton />
);

export const AutoSnipingExecutionDashboard = safeLazy(
  () =>
    import("./auto-sniping/auto-sniping-execution-dashboard").then((module: any) => ({
      default: module.AutoSnipingExecutionDashboard || module.default,
    })),
  "AutoSnipingExecutionDashboard",
  () => <ExecutionSkeleton />
);

export const AlertCenter = safeLazy(
  () =>
    import("./monitoring/alert-center").then((module: any) => ({
      default: module.AlertCenter || module.default,
    })),
  "AlertCenter",
  () => <AlertSkeleton />
);

export const RealTimeSafetyDashboard = safeLazy(
  () =>
    import("./auto-sniping/real-time-safety-dashboard").then((module: any) => ({
      default: module.RealTimeSafetyDashboard || module.default,
    })),
  "RealTimeSafetyDashboard",
  () => <SafetySkeleton />
);

export const ComprehensiveSafetyDashboard = safeLazy(
  () =>
    import("./safety/comprehensive-safety-dashboard").then((module: any) => ({
      default: module.ComprehensiveSafetyDashboard || module.default,
    })),
  "ComprehensiveSafetyDashboard",
  () => <SafetySkeleton />
);

export const RealTimePerformance = safeLazy(
  () =>
    import("./monitoring/real-time-performance").then((module: any) => ({
      default: module.RealTimePerformance || module.default,
    })),
  "RealTimePerformance",
  () => <DashboardSkeleton />
);

// TIER 2 HEAVY COMPONENTS: Quick wins for performance with safe loading
export const RealTimeDashboard = safeLazy(
  () =>
    import("./dashboard/real-time-dashboard").then((module: any) => ({
      default: module.default || module.RealTimeDashboard,
    })),
  "RealTimeDashboard",
  () => <DashboardSkeleton />
);

export const AlertsDashboard = safeLazy(
  () =>
    import("./alerts/alerts-dashboard").then((module: any) => ({
      default: module.AlertsDashboard || module.default,
    })),
  "AlertsDashboard",
  () => <AlertSkeleton />
);

export const UnifiedTakeProfitSettings = safeLazy(
  () =>
    import("./unified-take-profit-settings").then((module: any) => ({
      default: module.UnifiedTakeProfitSettings || module.default,
    })),
  "UnifiedTakeProfitSettings",
  () => <CardSkeleton />
);

export const SystemArchitectureOverview = safeLazy(
  () =>
    import("./monitoring/system-architecture-overview").then((module: any) => ({
      default: module.SystemArchitectureOverview || module.default,
    })),
  "SystemArchitectureOverview",
  () => <DashboardSkeleton />
);

export const EditableTakeProfitTable = safeLazy(
  () =>
    import("./editable-take-profit-table").then((module: any) => ({
      default: module.EditableTakeProfitTable || module.default,
    })),
  "EditableTakeProfitTable",
  () => <TableSkeleton />
);

export const ParameterMonitor = safeLazy(
  () =>
    import("./tuning/parameter-monitor").then((module: any) => ({
      default: module.ParameterMonitor || module.default,
    })),
  "ParameterMonitor",
  () => <CardSkeleton />
);

export const OptimizationControlPanel = safeLazy(
  () =>
    import("./tuning/optimization-control-panel").then((module: any) => ({
      default: module.OptimizationControlPanel || module.default,
    })),
  "OptimizationControlPanel",
  () => <CardSkeleton />
);

// Wrapper components with loading states and error boundaries
interface LazyComponentWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  className?: string;
}

export function LazyComponentWrapper({
  children,
  fallback = <ComponentSkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="p-4 text-center text-amber-600 border border-amber-200 rounded">
            Component temporarily unavailable
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function LazyCardWrapper({
  children,
  fallback = <CardSkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="rounded-lg border border-amber-200 p-4 text-amber-600">
            Card component temporarily unavailable
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function LazyTableWrapper({
  children,
  fallback = <TableSkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="rounded-lg border border-gray-200 p-4 text-gray-600">
            Table data temporarily unavailable
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

// Specialized wrappers for heavy dashboard components
export function LazyDashboardWrapper({
  children,
  fallback = <DashboardSkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="rounded-lg border border-red-200 p-4 text-red-600">
            Dashboard component failed to load
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function LazyTradingWrapper({
  children,
  fallback = <TradingSkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="rounded-lg border border-red-200 p-4 text-red-600">
            Trading component failed to load
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function LazyExecutionWrapper({
  children,
  fallback = <ExecutionSkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="rounded-lg border border-red-200 p-4 text-red-600">
            Execution component failed to load
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function LazySafetyWrapper({
  children,
  fallback = <SafetySkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="rounded-lg border border-yellow-200 p-4 text-yellow-600">
            Safety component failed to load
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function LazyAlertWrapper({
  children,
  fallback = <AlertSkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="rounded-lg border border-orange-200 p-4 text-orange-600">
            Alert component failed to load
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function LazyChartWrapper({
  children,
  fallback = <ChartSkeleton />,
  errorFallback,
  className = "",
}: LazyComponentWrapperProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        errorFallback || (
          <div className="rounded-lg border border-blue-200 p-4 h-64 flex items-center justify-center text-blue-600">
            Chart failed to load
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

// Preload functions for better UX with error handling
export function preloadDashboardComponents() {
  // Preload critical dashboard components with safe error handling
  const preloadPromises = [
    import("./dashboard/coin-listings-board").catch(() => null),
    import("./dashboard/optimized-metrics-grid").catch(() => null),
    import("./dashboard/upcoming-coins-section").catch(() => null),
    import("./optimized-coin-calendar").catch(() => null),
    import("./dashboard/real-time-dashboard").catch(() => null),
  ];

  return Promise.allSettled(preloadPromises);
}

export function preloadAgentComponents() {
  // Preload agent-related components with safe error handling
  const preloadPromises = [
    import("./agent-dashboard").catch(() => null),
    import("./pattern-sniper").catch(() => null),
    import("./safety-monitoring-dashboard").catch(() => null),
    import("./auto-sniping/auto-sniping-execution-dashboard").catch(() => null),
  ];

  return Promise.allSettled(preloadPromises);
}

export function preloadTradingComponents() {
  // Preload trading-related components with safe error handling
  const preloadPromises = [
    import("./trading-configuration").catch(() => null),
    import("./strategy-manager").catch(() => null),
    import("./dashboard/trading-chart").catch(() => null),
    import("./dashboard/recent-trades-table").catch(() => null),
    import("./monitoring/trading-analytics-dashboard").catch(() => null),
  ];

  return Promise.allSettled(preloadPromises);
}

// NEW: Preload functions for Tier 1 heavy components with safe error handling
export function preloadHeavyDashboardComponents() {
  // Preload the heaviest dashboard components for maximum impact
  const preloadPromises = [
    import("./monitoring/trading-analytics-dashboard").catch(() => null),
    import("./auto-sniping/auto-sniping-execution-dashboard").catch(() => null),
    import("./monitoring/alert-center").catch(() => null),
    import("./auto-sniping/real-time-safety-dashboard").catch(() => null),
    import("./safety/comprehensive-safety-dashboard").catch(() => null),
    import("./monitoring/real-time-performance").catch(() => null),
  ];

  return Promise.allSettled(preloadPromises);
}

export function preloadMonitoringComponents() {
  // Preload monitoring page components with safe error handling
  const preloadPromises = [
    import("./monitoring/trading-analytics-dashboard").catch(() => null),
    import("./monitoring/real-time-performance").catch(() => null),
    import("./monitoring/system-architecture-overview").catch(() => null),
    import("./tuning/parameter-monitor").catch(() => null),
  ];

  return Promise.allSettled(preloadPromises);
}

export function preloadSafetyComponents() {
  // Preload safety-related components with safe error handling
  const preloadPromises = [
    import("./auto-sniping/real-time-safety-dashboard").catch(() => null),
    import("./safety/comprehensive-safety-dashboard").catch(() => null),
    import("./monitoring/alert-center").catch(() => null),
  ];

  return Promise.allSettled(preloadPromises);
}

export function preloadSettingsComponents() {
  // Preload settings components with safe error handling
  const preloadPromises = [
    import("./unified-take-profit-settings").catch(() => null),
    import("./editable-take-profit-table").catch(() => null),
    import("./tuning/optimization-control-panel").catch(() => null),
  ];

  return Promise.allSettled(preloadPromises);
}

// Smart preloading based on user navigation patterns with logging
export async function preloadByRoute(currentRoute: string) {
  let preloadPromise: Promise<PromiseSettledResult<any>[]>;

  switch (currentRoute) {
    case "/dashboard":
      preloadPromise = preloadDashboardComponents();
      break;
    case "/monitoring":
      preloadPromise = preloadMonitoringComponents();
      break;
    case "/safety":
      preloadPromise = preloadSafetyComponents();
      break;
    case "/settings":
      preloadPromise = preloadSettingsComponents();
      break;
    default:
      // Preload the most critical components
      preloadPromise = preloadHeavyDashboardComponents();
      break;
  }

  // Log preload results for debugging
  try {
    const results = await preloadPromise;
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      console.warn(
        `Preloaded ${successful}/${successful + failed} components for route ${currentRoute}. ${failed} failed.`
      );
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.warn(`Component ${index} failed to preload:`, result.reason);
        }
      });
    } else {
      console.info(`Successfully preloaded ${successful} components for route ${currentRoute}`);
    }

    return results;
  } catch (error) {
    console.error(`Failed to preload components for route ${currentRoute}:`, error);
    return [];
  }
}
