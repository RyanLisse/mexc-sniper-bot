"use client";
import { forwardRef, HTMLAttributes, lazy, ReactElement, ReactNode, Suspense } from "react";
import { ErrorBoundary } from "../error-boundary";

export interface ChartConfig {
  [key: string]: { label?: string; color?: string };
}

// Safely lazy load Recharts ResponsiveContainer to reduce initial bundle size with error handling
const _ResponsiveContainer = lazy(async () => {
  try {
    const module = await import("recharts");
    return { default: module.ResponsiveContainer };
  } catch (error) {
    console.warn("Failed to load Recharts ResponsiveContainer in chart.tsx:", error);
    // Return fallback component that renders safely with ResponsiveContainer-compatible interface
    const FallbackComponent = forwardRef<
      HTMLDivElement,
      {
        children?: ReactNode;
        className?: string;
        width?: string | number;
        height?: string | number;
      }
    >(({ children, className }, ref) => (
      <div
        ref={ref}
        className={`w-full h-96 flex items-center justify-center border border-gray-200 rounded text-gray-500 ${className || ""}`}
      >
        Chart temporarily unavailable
        {children && <div style={{ display: "none" }}>{children}</div>}
      </div>
    ));
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
  children: ReactNode;
}): ReactElement {
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
        <div className={`w-full h-96 ${className || ""}`}>{children}</div>
      </Suspense>
    </ErrorBoundary>
  );
}

export function ChartTooltip(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{props.children}</div>;
}

export function ChartTooltipContent({
  children,
}: {
  children?: ReactNode;
  labelFormatter?: (value: unknown) => ReactNode;
  indicator?: string;
}): ReactElement | null {
  return <div>{children}</div>;
}
