/**
 * Enhanced Connectivity Hook
 *
 * React hook for managing enhanced MEXC connectivity with real-time monitoring,
 * health metrics, and circuit breaker status. Provides a comprehensive interface
 * for credential validation and connection management.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface EnhancedConnectivityData {
  // Core Status
  connected: boolean;
  hasCredentials: boolean;
  credentialsValid: boolean;
  canAuthenticate: boolean;
  isTestCredentials: boolean;

  // Credential Source Info
  credentialSource: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;

  // Connection Health
  connectionHealth: "excellent" | "good" | "fair" | "poor";
  connectionQuality: {
    score: number;
    status: string;
    reasons: string[];
    recommendations: string[];
  };

  // Performance Metrics
  metrics: {
    totalChecks: number;
    successRate: number;
    averageLatency: number;
    consecutiveFailures: number;
    uptime: number;
    responseTime?: number;
  };

  // Circuit Breaker Status
  circuitBreaker: {
    isOpen: boolean;
    failures: number;
    nextAttemptTime?: string;
    reason?: string;
  };

  // Alerts and Issues
  alerts: {
    count: number;
    latest?: string;
    severity: "none" | "info" | "warning" | "critical";
    recent: Array<{
      type: string;
      severity: string;
      message: string;
      timestamp: string;
    }>;
  };

  // Recommendations
  recommendedActions: string[];

  // Status Details
  error?: string;
  message: string;
  status:
    | "fully_connected"
    | "credentials_invalid"
    | "test_credentials"
    | "no_credentials"
    | "network_error"
    | "error";
  timestamp: string;
  lastChecked: string;
  nextCheckIn: number;

  // Trends and Analysis
  trends: {
    period: string;
    healthTrend: "improving" | "stable" | "degrading";
    averageUptime: number;
    statusChanges: number;
    mostCommonIssue?: string;
  };

  // System Status
  monitoring: {
    isActive: boolean;
    intervalMs: number;
    totalStatusUpdates: number;
  };
}

export interface ConnectivityHookOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableBackgroundRefresh?: boolean;
  staleTime?: number;
  retryCount?: number;
  onStatusChange?: (status: EnhancedConnectivityData) => void;
  onAlert?: (alert: { type: string; severity: string; message: string }) => void;
}

export interface ConnectivityActions {
  refresh: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  resetCircuitBreaker: () => Promise<void>;
  testCredentials: (credentials?: { apiKey: string; secretKey: string }) => Promise<any>;
}

export interface ConnectivityAnalysis {
  overallHealth: "excellent" | "good" | "fair" | "poor" | "critical";
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];
  needsAttention: boolean;
  canTrade: boolean;
  nextAction?: string;
}

// ============================================================================
// Enhanced Connectivity Hook
// ============================================================================

export function useEnhancedConnectivity(options: ConnectivityHookOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 60000, // 1 minute
    enableBackgroundRefresh = true,
    staleTime = 30000, // 30 seconds
    retryCount = 3,
    onStatusChange,
    onAlert,
  } = options;

  const queryClient = useQueryClient();
  const previousStatusRef = useRef<EnhancedConnectivityData | null>(null);

  // Main connectivity query
  const {
    data: connectivity,
    isLoading,
    error,
    refetch,
    isFetching,
    isError,
    dataUpdatedAt,
  } = useQuery<EnhancedConnectivityData>({
    queryKey: ["mexc", "enhanced-connectivity"],
    queryFn: async () => {
      const response = await fetch("/api/mexc/enhanced-connectivity");
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      const result = await response.json();
      return result.data;
    },
    staleTime,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: enableBackgroundRefresh,
    retry: retryCount,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    networkMode: "online",
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const result = await refetch();
      if (!result.data) {
        throw new Error("Failed to refresh connectivity data");
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mexc"] });
    },
  });

  // Force refresh mutation
  const forceRefreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/mexc/enhanced-connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      await refetch();
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mexc"] });
    },
  });

  // Reset circuit breaker mutation
  const resetCircuitBreakerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/mexc/enhanced-connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetCircuitBreaker: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await refetch();
      return response.json();
    },
  });

  // Test credentials mutation
  const testCredentialsMutation = useMutation({
    mutationFn: async (credentials?: { apiKey: string; secretKey: string }) => {
      const response = await fetch("/api/mexc/enhanced-connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testCredentials: true,
          ...(credentials && { credentials }),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    },
  });

  // Status change detection
  useEffect(() => {
    if (connectivity && onStatusChange) {
      const previousStatus = previousStatusRef.current;

      if (previousStatus && hasStatusChanged(previousStatus, connectivity)) {
        onStatusChange(connectivity);
      }

      previousStatusRef.current = connectivity;
    }
  }, [connectivity, onStatusChange]);

  // Alert detection
  useEffect(() => {
    if (connectivity && onAlert && connectivity.alerts.count > 0) {
      const latestAlert = connectivity.alerts.recent[0];
      if (latestAlert && latestAlert.severity !== "none") {
        onAlert(latestAlert);
      }
    }
  }, [connectivity, onAlert]);

  // Actions
  const actions: ConnectivityActions = {
    refresh: useCallback(async () => {
      try {
        await refreshMutation.mutateAsync();
      } catch (error) {
        console.error("Failed to refresh connectivity:", error);
        throw error;
      }
    }, [refreshMutation]),

    forceRefresh: useCallback(async () => {
      try {
        await forceRefreshMutation.mutateAsync();
      } catch (error) {
        console.error("Failed to force refresh connectivity:", error);
        throw error;
      }
    }, [forceRefreshMutation]),

    resetCircuitBreaker: useCallback(async () => {
      try {
        await resetCircuitBreakerMutation.mutateAsync();
      } catch (error) {
        console.error("Failed to reset circuit breaker:", error);
        throw error;
      }
    }, [resetCircuitBreakerMutation]),

    testCredentials: useCallback(
      async (credentials?: { apiKey: string; secretKey: string }) => {
        try {
          return await testCredentialsMutation.mutateAsync(credentials);
        } catch (error) {
          console.error("Failed to test credentials:", error);
          throw error;
        }
      },
      [testCredentialsMutation]
    ),
  };

  // Analysis
  const analysis: ConnectivityAnalysis | null = connectivity
    ? analyzeConnectivity(connectivity)
    : null;

  // Status helpers
  const isRefreshing = refreshMutation.isPending || forceRefreshMutation.isPending;
  const isHealthy = connectivity
    ? connectivity.connectionHealth === "excellent" || connectivity.connectionHealth === "good"
    : false;
  const hasCriticalIssues = connectivity ? analysis?.criticalIssues.length > 0 : true;
  const needsImmedateAttention = connectivity
    ? connectivity.circuitBreaker.isOpen ||
      connectivity.alerts.severity === "critical" ||
      connectivity.metrics.consecutiveFailures > 5
    : true;

  return {
    // Data
    connectivity,
    analysis,

    // Loading states
    isLoading,
    isFetching,
    isRefreshing,
    isError,
    error,

    // Status helpers
    isHealthy,
    hasCriticalIssues,
    needsImmedateAttention,

    // Actions
    ...actions,

    // Mutation states
    isResettingCircuitBreaker: resetCircuitBreakerMutation.isPending,
    isTestingCredentials: testCredentialsMutation.isPending,

    // Metadata
    lastUpdated: dataUpdatedAt,
    nextRefresh: connectivity?.lastChecked
      ? new Date(new Date(connectivity.lastChecked).getTime() + refreshInterval)
      : null,
  };
}

// ============================================================================
// Analysis Functions
// ============================================================================

function analyzeConnectivity(connectivity: EnhancedConnectivityData): ConnectivityAnalysis {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check for critical issues
  if (!connectivity.hasCredentials) {
    criticalIssues.push("No API credentials configured");
    recommendations.push("Configure MEXC API credentials");
  } else if (connectivity.isTestCredentials) {
    criticalIssues.push("Using test/placeholder credentials");
    recommendations.push("Replace with real MEXC API credentials");
  } else if (!connectivity.credentialsValid) {
    criticalIssues.push("API credentials are invalid");
    recommendations.push("Verify credentials and check IP allowlist");
  }

  if (connectivity.circuitBreaker.isOpen) {
    criticalIssues.push("Circuit breaker is open");
    recommendations.push("Reset circuit breaker and investigate failures");
  }

  if (connectivity.metrics.consecutiveFailures > 5) {
    criticalIssues.push("Multiple consecutive connection failures");
    recommendations.push("Check network connectivity and API status");
  }

  // Check for warnings
  if (connectivity.connectionHealth === "poor") {
    warnings.push("Poor connection quality");
    recommendations.push("Monitor network performance");
  }

  if (connectivity.metrics.successRate < 0.9) {
    warnings.push(`Low success rate: ${(connectivity.metrics.successRate * 100).toFixed(1)}%`);
    recommendations.push("Investigate connection stability");
  }

  if (connectivity.metrics.averageLatency > 2000) {
    warnings.push("High average latency");
    recommendations.push("Optimize network configuration");
  }

  if (connectivity.alerts.severity === "warning" || connectivity.alerts.severity === "critical") {
    warnings.push(`Active ${connectivity.alerts.severity} alerts`);
  }

  // Determine overall health
  let overallHealth: ConnectivityAnalysis["overallHealth"] = "excellent";

  if (criticalIssues.length > 0) {
    overallHealth = "critical";
  } else if (warnings.length > 3) {
    overallHealth = "poor";
  } else if (warnings.length > 1) {
    overallHealth = "fair";
  } else if (warnings.length > 0) {
    overallHealth = "good";
  }

  // Determine if can trade
  const canTrade =
    connectivity.hasCredentials &&
    connectivity.credentialsValid &&
    !connectivity.isTestCredentials &&
    !connectivity.circuitBreaker.isOpen &&
    connectivity.connectionHealth !== "poor";

  // Determine next action
  let nextAction: string | undefined;
  if (criticalIssues.length > 0) {
    nextAction = recommendations[0];
  } else if (warnings.length > 0) {
    nextAction = "Monitor system health";
  }

  return {
    overallHealth,
    criticalIssues,
    warnings,
    recommendations: [...new Set(recommendations)], // Remove duplicates
    needsAttention: criticalIssues.length > 0 || warnings.length > 2,
    canTrade,
    nextAction,
  };
}

function hasStatusChanged(
  previous: EnhancedConnectivityData,
  current: EnhancedConnectivityData
): boolean {
  return (
    previous.hasCredentials !== current.hasCredentials ||
    previous.credentialsValid !== current.credentialsValid ||
    previous.canAuthenticate !== current.canAuthenticate ||
    previous.connectionHealth !== current.connectionHealth ||
    previous.isTestCredentials !== current.isTestCredentials ||
    previous.circuitBreaker.isOpen !== current.circuitBreaker.isOpen ||
    previous.status !== current.status
  );
}

// ============================================================================
// Legacy Compatibility Hooks
// ============================================================================

/**
 * Legacy hook for backward compatibility with existing code
 */
export function useMexcConnectivityEnhanced() {
  const { connectivity, isLoading, error, refresh } = useEnhancedConnectivity();

  return {
    data: connectivity?.connected || false,
    isConnected: connectivity?.connected || false,
    hasCredentials: connectivity?.hasCredentials || false,
    isValid: connectivity?.credentialsValid || false,
    isLoading,
    error,
    refetch: refresh,
  };
}

/**
 * Health-focused hook for monitoring dashboards
 */
export function useConnectivityHealth() {
  const { connectivity, analysis, isHealthy, hasCriticalIssues } = useEnhancedConnectivity({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds for health monitoring
  });

  return {
    health: connectivity?.connectionHealth || "poor",
    score: connectivity?.connectionQuality.score || 0,
    metrics: connectivity?.metrics,
    alerts: connectivity?.alerts,
    isHealthy,
    hasCriticalIssues,
    recommendations: analysis?.recommendations || [],
    trends: connectivity?.trends,
  };
}

/**
 * Trading-focused hook for trading interfaces
 */
export function useTradingConnectivity() {
  const { connectivity, analysis, actions } = useEnhancedConnectivity();

  return {
    canTrade: analysis?.canTrade || false,
    isReady: connectivity?.status === "fully_connected",
    blockingIssues: analysis?.criticalIssues || [],
    credentialSource: connectivity?.credentialSource || "none",
    isTestMode: connectivity?.isTestCredentials || false,
    ...actions,
  };
}
