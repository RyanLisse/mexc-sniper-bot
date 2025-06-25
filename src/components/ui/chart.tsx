"use client";
import type * as React from "react";
import { lazy, Suspense } from "react";

export interface ChartConfig {
  [key: string]: { label?: string; color?: string };
}

// Lazy load Recharts ResponsiveContainer to reduce initial bundle size
const ResponsiveContainer = lazy(() =>
  import("recharts").then((module) => ({
    default: module.ResponsiveContainer,
  }))
);

export function ChartContainer({
  className,
  children,
}: {
  className?: string;
  config?: ChartConfig;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Suspense fallback={<div className="w-full h-96 animate-pulse bg-gray-100 rounded" />}>
      <ResponsiveContainer className={className}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </Suspense>
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
