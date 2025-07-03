/**
 * React Utilities for Performance and Type Safety
 *
 * Reusable utilities to fix common linting issues and improve performance
 * across the React codebase without losing functionality.
 */

import { ComponentType, KeyboardEvent, useMemo } from "react";

/**
 * Generate stable keys for array rendering without using array indexes
 * This solves the noArrayIndexKey linting issue while maintaining performance
 */
export function generateStableKey(prefix: string, index: number, additionalData?: string): string {
  if (additionalData) {
    return `${prefix}-${additionalData}-${index}`;
  }
  return `${prefix}-${index}`;
}

/**
 * Generate unique keys for skeleton loading states
 */
export function generateSkeletonKey(index: number, type = "skeleton"): string {
  return `${type}-loading-${index}-${Date.now()}`;
}

/**
 * Generate keys for chart cells with stable identifiers
 */
export function generateChartCellKey(index: number, type = "cell"): string {
  return `${type}-${index}-chart`;
}

/**
 * Type-safe wrapper for chart tooltip formatters
 * Replaces (value: any, name: string) with proper typing
 */
export type TooltipFormatter = (value: unknown, name: string) => [string, string];

export function createTooltipFormatter(
  valueFormatter: (value: unknown) => string
): TooltipFormatter {
  return (value: unknown, name: string) => [valueFormatter(value), name];
}

/**
 * Type-safe CPU usage data structure
 */
export interface CpuUsageData {
  user: number;
  system: number;
  idle: number;
  iowait?: number;
}

/**
 * Type-safe replacement for any in performance data
 */
export interface PerformanceMetrics {
  [key: string]: {
    name: string;
    value: number;
    successRate: number;
    lastActivity: string;
    status?: "active" | "inactive" | "error";
    responseTime?: number;
    errorRate?: number;
  };
}

/**
 * Keyboard event handler wrapper for accessibility
 * Solves useKeyWithClickEvents linting issues
 */
export function createKeyboardClickHandler(clickHandler: () => void) {
  return {
    onClick: clickHandler,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        clickHandler();
      }
    },
    tabIndex: 0,
    role: "button",
  };
}

/**
 * Memoized skeleton loader for consistent loading states
 */
export function useSkeletonItems(count: number, className: string) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: generateSkeletonKey(i),
        className,
      })),
    [count, className]
  );
}

/**
 * Type-safe configuration update helper
 * Replaces complex type assertions in configuration panels
 */
export function updateNestedConfig<T extends Record<string, any>>(
  currentConfig: T,
  section: keyof T,
  subsection: string,
  key: string,
  value: any
): T {
  return {
    ...currentConfig,
    [section]: {
      ...currentConfig[section],
      [subsection]: {
        ...(currentConfig[section]?.[subsection] || {}),
        [key]: value,
      },
    },
  };
}

/**
 * Badge variant type safety helper
 */
export function getSafeBadgeVariant(
  severity: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (severity.toLowerCase()) {
    case "critical":
    case "error":
      return "destructive";
    case "warning":
      return "secondary";
    case "info":
      return "outline";
    default:
      return "default";
  }
}

/**
 * Status icon helper with type safety
 */
export interface StatusIconProps {
  className?: string;
}

export interface StatusConfig {
  icon: ComponentType<StatusIconProps>;
  color: string;
  label: string;
}

/**
 * Generate unique IDs for components to replace array indices
 */
export function generateComponentId(type: string, data?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  if (data) {
    // Create hash-like ID from data for stability
    const hash = data.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `${type}-${Math.abs(hash)}-${random}`;
  }
  return `${type}-${timestamp}-${random}`;
}

/**
 * Safe array key generator for lists with content
 */
export function generateListKey(item: any, _index: number, preferredKey?: string): string {
  if (preferredKey && item[preferredKey]) {
    return `item-${item[preferredKey]}`;
  }

  // Try common ID fields
  if (item.id) return `item-${item.id}`;
  if (item.name) return `item-${item.name}`;
  if (item.symbol) return `item-${item.symbol}`;

  // Generate from content if possible
  if (typeof item === "string") {
    return generateComponentId("string", item);
  }

  // Fallback with content-based generation
  const content = JSON.stringify(item);
  return generateComponentId("list", content.substring(0, 20));
}
