"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ======================
// Types
// ======================

export interface CacheWarmingStrategy {
  name: string;
  enabled: boolean;
  priority: "high" | "medium" | "low";
  frequency: number;
  lastRun: string | null;
  nextRun: string | null;
  status: "active" | "disabled" | "pending" | "overdue";
}

export interface CacheWarmingMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecution: string | null;
  successRate: number;
}

export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  averageResponseTime: number;
  cacheSize: number;
  memoryUsage: number;
  evictions: number;
  errors: number;
  trends: {
    hitRateChange: number;
    responseTimeChange: number;
    requestVolumeChange: number;
  };
}

export interface CacheConnectionStatus {
  redis: {
    connected: boolean;
    status: "healthy" | "disconnected" | "error";
    message: string;
    lastCheck: string;
  };
  valkey: {
    connected: boolean;
    status: "healthy" | "disconnected" | "error";
    message: string;
    lastCheck: string;
  };
  gracefulDegradation: {
    enabled: boolean;
    fallbackMode: boolean;
    message: string;
  };
}

export interface CacheMetricsData {
  warming: {
    isActive: boolean;
    strategies: CacheWarmingStrategy[];
    metrics: CacheWarmingMetrics;
  };
  performance: CachePerformanceMetrics;
  connection: CacheConnectionStatus;
  lastUpdated: string;
}

// ======================
// Query Keys
// ======================

const cacheQueryKeys = {
  all: ["cache"] as const,
  metrics: () => [...cacheQueryKeys.all, "metrics"] as const,
  warming: () => [...cacheQueryKeys.all, "warming"] as const,
  strategies: () => [...cacheQueryKeys.all, "strategies"] as const,
};

// ======================
// Hooks
// ======================

/**
 * Hook to get comprehensive cache metrics
 */
export function useCacheMetrics() {
  return useQuery({
    queryKey: cacheQueryKeys.metrics(),
    queryFn: async (): Promise<CacheMetricsData> => {
      const response = await fetch("/api/cache-warming/status");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch cache metrics");
      }

      return result.data;
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to get cache warming strategies
 */
export function useCacheWarmingStrategies() {
  return useQuery({
    queryKey: cacheQueryKeys.strategies(),
    queryFn: async () => {
      const response = await fetch("/api/cache-warming/trigger");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch cache warming strategies");
      }

      return result.data;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
    retry: 2,
  });
}

/**
 * Hook to trigger cache warming strategies
 */
export function useCacheWarmingTrigger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      strategy,
      strategies,
      force = false,
    }: {
      strategy?: string;
      strategies?: string[];
      force?: boolean;
    }) => {
      const response = await fetch("/api/cache-warming/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ strategy, strategies, force }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to trigger cache warming");
      }

      return result.data;
    },
    onSuccess: () => {
      // Invalidate and refetch cache metrics after successful trigger
      queryClient.invalidateQueries({ queryKey: cacheQueryKeys.all });
    },
  });
}

/**
 * Hook to get cache performance summary
 */
export function useCachePerformance() {
  const { data, isLoading, error } = useCacheMetrics();

  const performanceSummary = data
    ? {
        hitRate: data.performance.hitRate,
        isHealthy: data.performance.hitRate >= 70, // 70% hit rate threshold
        responseTime: data.performance.averageResponseTime,
        isFast: data.performance.averageResponseTime <= 100, // 100ms threshold
        totalRequests: data.performance.totalRequests,
        cacheSize: data.performance.cacheSize,
        memoryUsage: data.performance.memoryUsage,
        trends: data.performance.trends,
        connectionStatus: data.connection,
        isConnected: data.connection.redis.connected || data.connection.valkey.connected,
        fallbackMode: data.connection.gracefulDegradation.fallbackMode,
      }
    : null;

  return {
    data: performanceSummary,
    isLoading,
    error,
  };
}

/**
 * Hook to get cache connection status
 */
export function useCacheConnection() {
  const { data, isLoading, error } = useCacheMetrics();

  return {
    data: data?.connection,
    isLoading,
    error,
    isRedisConnected: data?.connection?.redis?.connected || false,
    isValkeyConnected: data?.connection?.valkey?.connected || false,
    isAnyConnected:
      data?.connection?.redis?.connected || data?.connection?.valkey?.connected || false,
    fallbackMode: data?.connection?.gracefulDegradation?.fallbackMode || false,
  };
}

// ======================
// Utility Functions
// ======================

/**
 * Get cache performance status color
 */
export function getCachePerformanceColor(hitRate: number) {
  if (hitRate >= 90) return "green";
  if (hitRate >= 70) return "yellow";
  return "red";
}

/**
 * Get cache warming strategy status color
 */
export function getCacheStrategyStatusColor(status: CacheWarmingStrategy["status"]) {
  switch (status) {
    case "active":
      return "green";
    case "pending":
      return "blue";
    case "overdue":
      return "orange";
    case "disabled":
      return "gray";
    default:
      return "gray";
  }
}

/**
 * Format cache size for display
 */
export function formatCacheSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format execution time for display
 */
export function formatExecutionTime(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
