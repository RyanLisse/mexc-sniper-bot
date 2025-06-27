/**
 * Safe Dynamic Wrapper Component
 *
 * A reusable wrapper that provides comprehensive error handling for dynamic imports
 * with Suspense boundaries and error boundaries. This ensures that dynamic component
 * failures don't crash parent components.
 */

"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "./error-boundary";
import { Skeleton } from "./ui/optimized-exports";

interface SafeDynamicWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  className?: string;
  height?: string;
  componentName?: string;
}

// Default fallback components
const ComponentSkeleton = ({ className = "" }: { className?: string }) => (
  <div className={`space-y-3 ${className}`}>
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
  </div>
);

const ChartSkeleton = ({ height = "h-[300px]" }: { height?: string }) => (
  <div
    className={`w-full ${height} animate-pulse bg-gray-100 rounded flex items-center justify-center`}
  >
    <div className="text-gray-500">Loading chart...</div>
  </div>
);

/**
 * Safe wrapper for any dynamic component with Suspense and Error boundaries
 */
export function SafeDynamicWrapper({
  children,
  fallback,
  errorFallback,
  className = "",
  height,
  componentName = "Component",
}: SafeDynamicWrapperProps) {
  const defaultErrorFallback = (
    <div
      className={`w-full ${height || "h-auto"} flex items-center justify-center border border-amber-200 rounded text-amber-600 p-4`}
    >
      {componentName} temporarily unavailable
    </div>
  );

  const defaultFallback = height ? (
    <ChartSkeleton height={height} />
  ) : (
    <ComponentSkeleton className={className} />
  );

  return (
    <ErrorBoundary level="component" fallback={errorFallback || defaultErrorFallback}>
      <Suspense fallback={fallback || defaultFallback}>
        <div className={className}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Specialized wrapper for chart components
 */
export function SafeChartWrapper({
  children,
  fallback,
  errorFallback,
  className = "",
  height = "h-[300px]",
  chartName = "Chart",
}: SafeDynamicWrapperProps & { chartName?: string }) {
  const chartErrorFallback = (
    <div
      className={`w-full ${height} flex items-center justify-center border border-blue-200 rounded text-blue-600`}
    >
      {chartName} temporarily unavailable
    </div>
  );

  const chartLoadingFallback = (
    <div
      className={`w-full ${height} animate-pulse bg-gray-100 rounded flex items-center justify-center`}
    >
      <div className="text-gray-500">Loading {chartName.toLowerCase()}...</div>
    </div>
  );

  return (
    <SafeDynamicWrapper
      fallback={fallback || chartLoadingFallback}
      errorFallback={errorFallback || chartErrorFallback}
      className={className}
      height={height}
      componentName={chartName}
    >
      {children}
    </SafeDynamicWrapper>
  );
}

/**
 * Specialized wrapper for card components
 */
export function SafeCardWrapper({
  children,
  fallback,
  errorFallback,
  className = "",
  cardName = "Card",
}: SafeDynamicWrapperProps & { cardName?: string }) {
  const cardErrorFallback = (
    <div className="rounded-lg border border-amber-200 p-4 text-amber-600">
      {cardName} component temporarily unavailable
    </div>
  );

  const cardLoadingFallback = (
    <div className="rounded-lg border p-4 space-y-3">
      <Skeleton className="h-6 w-1/3" />
      <ComponentSkeleton />
    </div>
  );

  return (
    <SafeDynamicWrapper
      fallback={fallback || cardLoadingFallback}
      errorFallback={errorFallback || cardErrorFallback}
      className={className}
      componentName={cardName}
    >
      {children}
    </SafeDynamicWrapper>
  );
}

/**
 * Specialized wrapper for table components
 */
export function SafeTableWrapper({
  children,
  fallback,
  errorFallback,
  className = "",
  tableName = "Table",
}: SafeDynamicWrapperProps & { tableName?: string }) {
  const tableErrorFallback = (
    <div className="rounded-lg border border-gray-200 p-4 text-gray-600">
      {tableName} data temporarily unavailable
    </div>
  );

  const tableLoadingFallback = (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
    </div>
  );

  return (
    <SafeDynamicWrapper
      fallback={fallback || tableLoadingFallback}
      errorFallback={errorFallback || tableErrorFallback}
      className={className}
      componentName={tableName}
    >
      {children}
    </SafeDynamicWrapper>
  );
}

export default SafeDynamicWrapper;
