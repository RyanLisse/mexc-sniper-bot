"use client";
import type * as React from "react";
import { ResponsiveContainer } from "recharts";

export interface ChartConfig {
  [key: string]: { label?: string; color?: string };
}

export function ChartContainer({
  className,
  children,
}: {
  className?: string;
  config?: ChartConfig;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ResponsiveContainer className={className}>
      {children as React.ReactElement}
    </ResponsiveContainer>
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
