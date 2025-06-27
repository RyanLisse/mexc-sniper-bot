"use client";
import * as React from "react";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "../error-boundary";

export interface ChartConfig {
  [key: string]: { label?: string; color?: string };
}

// Safely lazy load Recharts ResponsiveContainer to reduce initial bundle size with error handling
const ResponsiveContainer = lazy(async () => {
  try {
    const module = await import("recharts");
    return { default: module.ResponsiveContainer };
  } catch (error) {
    console.warn("Failed to load Recharts ResponsiveContainer in chart.tsx:", error);
    // Return fallback component that renders safely with ResponsiveContainer-compatible interface
    const FallbackComponent = React.forwardRef<HTMLDivElement, { 
      children?: React.ReactNode; 
      className?: string;
      width?: string | number;
      height?: string | number;
    }>(
      ({ children, className }, ref) => (
        <div
          ref={ref}
          className={`w-full h-96 flex items-center justify-center border border-gray-200 rounded text-gray-500 ${className || ""}`}
        >
          Chart temporarily unavailable
          {children && <div style={{ display: "none" }}>{children}</div>}
        </div>
      )
    );
    FallbackComponent.displayName = "ChartFallback";
    return { default: FallbackComponent as any };
  }
});

export function ChartContainer({
  className,
  children,
}: {
  className?: string;
  config?: ChartConfig;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        <div className="w-full h-96 flex items-center justify-center border border-gray-200 rounded text-gray-500">
          Chart component temporarily unavailable
        </div>
      }
    >
      <Suspense fallback={<div className="w-full h-96 animate-pulse bg-gray-100 rounded" />}>
        <div className={`w-full h-96 ${className || ''}`}>
          {children}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function ChartTooltip(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{props.children}</div>;
}

export function ChartTooltipContent({
  children,
}: {
  children?: React.ReactNode;
  labelFormatter?: (value: unknown) => React.ReactNode;
  indicator?: string;
}): React.ReactElement | null {
  return <div>{children}</div>;
}
