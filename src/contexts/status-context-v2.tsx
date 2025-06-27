"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";

/**
 * React Query-based Status Management System
 *
 * This system replaces the reducer-based StatusContext with React Query
 * for better caching, error handling, and automatic refresh capabilities.
 * Uses the unified MEXC status endpoint for consistency.
 */

// Re-export all existing types for backward compatibility
export interface NetworkStatus {
  connected: boolean;
  lastChecked: string;
  error?: string;
}

export interface CredentialStatus {
  hasCredentials: boolean;
  isValid: boolean;
  source: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  lastValidated: string;
  error?: string;
  // Enhanced fields (optional for backward compatibility)
  isTestCredentials?: boolean;
  connectionHealth?: "excellent" | "good" | "fair" | "poor";
  metrics?: {
    totalChecks: number;
    successRate: number;
    averageLatency: number;
    consecutiveFailures: number;
    uptime: number;
  };
  alerts?: {
    count: number;
    latest?: string;
    severity: "none" | "info" | "warning" | "critical";
  };
}

export interface TradingStatus {
  canTrade: boolean;
  accountType?: string;
  balanceLoaded: boolean;
  lastUpdate: string;
  error?: string;
}

export interface SystemStatus {
  overall: "healthy" | "warning" | "error" | "unknown";
  components: Record<
    string,
    {
      status: "active" | "inactive" | "warning" | "error";
      message: string;
      lastChecked: string;
    }
  >;
  lastHealthCheck: string;
}

export interface WorkflowStatus {
  discoveryRunning: boolean;
  sniperActive: boolean;
  activeWorkflows: string[];
  systemStatus: "running" | "stopped" | "error";
  lastUpdate: string;
}

// Consolidated Status State
export interface ApplicationStatus {
  network: NetworkStatus;
  credentials: CredentialStatus;
  trading: TradingStatus;
  system: SystemStatus;
  workflows: WorkflowStatus;
  isLoading: boolean;
  lastGlobalUpdate: string;
  syncErrors: string[];
}

// Unified API Response Type (matches the route.ts)
interface UnifiedStatusResponse {
  connected: boolean;
  hasCredentials: boolean;
  credentialsValid: boolean;
  canTrade: boolean;
  credentialSource: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  isTestCredentials?: boolean;
  connectionHealth?: "excellent" | "good" | "fair" | "poor";
  responseTime?: number;
  overallStatus: "healthy" | "warning" | "error" | "loading";
  statusMessage: string;
  lastChecked: string;
  source: "enhanced" | "legacy" | "fallback";
  error?: string;
  recommendations: string[];
  nextSteps: string[];
}

// Query Keys
const STATUS_QUERY_KEYS = {
  unified: () => ["status", "unified"] as const,
  system: () => ["status", "system"] as const,
  workflows: () => ["status", "workflows"] as const,
} as const;

// Context Definition
interface StatusContextType {
  status: ApplicationStatus;
  refreshAll: () => Promise<void>;
  refreshNetwork: () => Promise<void>;
  refreshCredentials: () => Promise<void>;
  refreshTrading: () => Promise<void>;
  refreshSystem: () => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  clearErrors: () => void;
  getOverallStatus: () => "healthy" | "warning" | "error" | "loading";
  getStatusMessage: () => string;
  // React Query specific methods
  isLoading: boolean;
  error: Error | null;
  lastFetched: Date | null;
  isFetching: boolean;
}

const StatusContext = createContext<StatusContextType | null>(null);

// Status Provider Component
interface StatusProviderProps {
  children: React.ReactNode;
  autoRefreshInterval?: number;
  enableRealTimeUpdates?: boolean;
}

export function StatusProvider({
  children,
  autoRefreshInterval = 30000,
  enableRealTimeUpdates = true,
}: StatusProviderProps) {
  const queryClient = useQueryClient();

  // Unified Status Query - Primary data source
  const {
    data: unifiedData,
    error: unifiedError,
    isLoading: unifiedIsLoading,
    isFetching: unifiedIsFetching,
    dataUpdatedAt: unifiedLastFetched,
  } = useQuery({
    queryKey: STATUS_QUERY_KEYS.unified(),
    queryFn: async (): Promise<UnifiedStatusResponse> => {
      const response = await fetch("/api/mexc/unified-status");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch unified status");
      }

      return result.data;
    },
    staleTime: 15000, // 15 seconds
    refetchInterval: enableRealTimeUpdates ? autoRefreshInterval : false,
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => {
      // More aggressive retry for network issues
      if (error.message.includes("fetch")) {
        return failureCount < 2;
      }
      return failureCount < 1;
    },
  });

  // System Validation Query - For system status details
  const {
    data: systemData,
    error: systemError,
    isLoading: systemIsLoading,
  } = useQuery({
    queryKey: STATUS_QUERY_KEYS.system(),
    queryFn: async () => {
      const response = await fetch("/api/system/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quick_health_check" }),
      });
      const result = await response.json();
      return result.success ? result.data : null;
    },
    staleTime: 30000, // 30 seconds for system checks
    refetchInterval: enableRealTimeUpdates ? autoRefreshInterval * 2 : false,
    retry: 1,
  });

  // Workflow Status Query - For workflow information
  const {
    data: workflowData,
    error: workflowError,
    isLoading: workflowIsLoading,
  } = useQuery({
    queryKey: STATUS_QUERY_KEYS.workflows(),
    queryFn: async () => {
      const response = await fetch("/api/workflow-status");
      const result = await response.json();
      return result.success ? result.data : null;
    },
    staleTime: 20000, // 20 seconds for workflows
    refetchInterval: enableRealTimeUpdates ? autoRefreshInterval : false,
    retry: 1,
  });

  // Force Refresh Mutation
  const refreshMutation = useMutation({
    mutationFn: async ({ forceRefresh = true }: { forceRefresh?: boolean } = {}) => {
      const response = await fetch("/api/mexc/unified-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to refresh status");
      }

      return result.data;
    },
    onSuccess: () => {
      // Invalidate all status queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });

  // Transform unified data to ApplicationStatus format
  const status: ApplicationStatus = useMemo(() => {
    if (!unifiedData) {
      return {
        network: {
          connected: false,
          lastChecked: new Date().toISOString(),
          error: unifiedError?.message || "Loading network status...",
        },
        credentials: {
          hasCredentials: false,
          isValid: false,
          source: "none",
          hasUserCredentials: false,
          hasEnvironmentCredentials: false,
          lastValidated: new Date().toISOString(),
          error: "Loading credential status...",
        },
        trading: {
          canTrade: false,
          balanceLoaded: false,
          lastUpdate: new Date().toISOString(),
          error: "Loading trading status...",
        },
        system: {
          overall: "unknown",
          components: {},
          lastHealthCheck: new Date().toISOString(),
        },
        workflows: {
          discoveryRunning: false,
          sniperActive: false,
          activeWorkflows: [],
          systemStatus: "stopped",
          lastUpdate: new Date().toISOString(),
        },
        isLoading: true,
        lastGlobalUpdate: new Date().toISOString(),
        syncErrors: unifiedError ? [unifiedError.message] : [],
      };
    }

    // Enhanced system status from system validation
    const systemStatus: SystemStatus = {
      overall: systemData?.overall || "unknown",
      components: systemData?.components || {},
      lastHealthCheck: systemData?.timestamp || new Date().toISOString(),
    };

    // Enhanced workflow status
    const workflowStatus: WorkflowStatus = {
      discoveryRunning: workflowData?.discoveryRunning || false,
      sniperActive: workflowData?.sniperActive || false,
      activeWorkflows: workflowData?.activeWorkflows || [],
      systemStatus: workflowData?.systemStatus || "stopped",
      lastUpdate: workflowData?.lastUpdate || new Date().toISOString(),
    };

    return {
      network: {
        connected: unifiedData.connected,
        lastChecked: unifiedData.lastChecked,
        error: unifiedData.connected ? undefined : unifiedData.error,
      },
      credentials: {
        hasCredentials: unifiedData.hasCredentials,
        isValid: unifiedData.credentialsValid,
        source: unifiedData.credentialSource,
        hasUserCredentials: unifiedData.hasUserCredentials,
        hasEnvironmentCredentials: unifiedData.hasEnvironmentCredentials,
        lastValidated: unifiedData.lastChecked,
        error: unifiedData.credentialsValid ? undefined : unifiedData.error,
        isTestCredentials: unifiedData.isTestCredentials,
        connectionHealth: unifiedData.connectionHealth,
      },
      trading: {
        canTrade: unifiedData.canTrade,
        balanceLoaded: unifiedData.credentialsValid && unifiedData.connected,
        lastUpdate: unifiedData.lastChecked,
        error: unifiedData.canTrade ? undefined : "Trading not available",
      },
      system: systemStatus,
      workflows: workflowStatus,
      isLoading: unifiedIsLoading || systemIsLoading || workflowIsLoading,
      lastGlobalUpdate: unifiedData.lastChecked,
      syncErrors: [
        ...(unifiedError ? [unifiedError.message] : []),
        ...(systemError ? [systemError.message] : []),
        ...(workflowError ? [workflowError.message] : []),
      ],
    };
  }, [
    unifiedData,
    unifiedError,
    systemData,
    systemError,
    workflowData,
    workflowError,
    unifiedIsLoading,
    systemIsLoading,
    workflowIsLoading,
  ]);

  // Refresh Functions using React Query invalidation
  const refreshAll = useCallback(async () => {
    await refreshMutation.mutateAsync({});
  }, [refreshMutation]);

  const refreshNetwork = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEYS.unified() });
  }, [queryClient]);

  const refreshCredentials = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEYS.unified() });
  }, [queryClient]);

  const refreshTrading = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEYS.unified() });
  }, [queryClient]);

  const refreshSystem = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEYS.system() });
  }, [queryClient]);

  const refreshWorkflows = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEYS.workflows() });
  }, [queryClient]);

  const clearErrors = useCallback(() => {
    // Clear React Query errors
    queryClient.removeQueries({
      queryKey: ["status"],
      type: "all",
    });

    // Reset error boundary if needed
    queryClient.resetQueries({ queryKey: STATUS_QUERY_KEYS.unified() });
  }, [queryClient]);

  const getOverallStatus = useCallback((): "healthy" | "warning" | "error" | "loading" => {
    if (status.isLoading) return "loading";

    // Use unified status logic for consistency
    if (!status.network.connected) return "error";
    if (status.syncErrors.length > 0) return "error";
    if (status.system.overall === "error") return "error";

    // Unified credential status evaluation
    if (!status.credentials.hasCredentials) return "warning";
    if (status.credentials.isTestCredentials) return "warning";
    if (!status.credentials.isValid) return "error";

    // Enhanced health evaluation
    if (status.credentials.connectionHealth === "poor") return "error";
    if (status.credentials.alerts?.severity === "critical") return "error";
    if (
      status.credentials.metrics?.consecutiveFailures &&
      status.credentials.metrics.consecutiveFailures > 5
    ) {
      return "error";
    }

    if (status.system.overall === "warning") return "warning";
    if (status.credentials.connectionHealth === "fair") return "warning";
    if (status.credentials.alerts?.severity === "warning") return "warning";

    return "healthy";
  }, [status]);

  const getStatusMessage = useCallback((): string => {
    if (status.isLoading) return "Checking system status...";

    // Use the unified status message if available
    if (unifiedData?.statusMessage) {
      return unifiedData.statusMessage;
    }

    // Fallback to original logic
    if (!status.network.connected) return "Network connection unavailable";
    if (status.syncErrors.length > 0) return `System errors detected (${status.syncErrors.length})`;

    // Unified credential status messages
    if (!status.credentials.hasCredentials) return "API credentials not configured";
    if (status.credentials.isTestCredentials)
      return "Demo mode active with test credentials - configure real MEXC API credentials for live trading";
    if (!status.credentials.isValid) return "API credentials invalid";

    // Enhanced health status
    if (status.credentials.connectionHealth === "poor") return "Poor connection quality detected";
    if (status.credentials.alerts?.severity === "critical") return "Critical alerts detected";
    if (
      status.credentials.metrics?.consecutiveFailures &&
      status.credentials.metrics.consecutiveFailures > 5
    ) {
      return "Multiple connection failures detected";
    }

    if (status.system.overall === "error") return "System components have errors";
    if (status.system.overall === "warning") return "System components have warnings";

    return "All systems operational";
  }, [status, unifiedData]);

  const contextValue: StatusContextType = {
    status,
    refreshAll,
    refreshNetwork,
    refreshCredentials,
    refreshTrading,
    refreshSystem,
    refreshWorkflows,
    clearErrors,
    getOverallStatus,
    getStatusMessage,
    // React Query specific
    isLoading: unifiedIsLoading || refreshMutation.isPending,
    error: unifiedError || refreshMutation.error || null,
    lastFetched: unifiedLastFetched ? new Date(unifiedLastFetched) : null,
    isFetching: unifiedIsFetching,
  };

  return <StatusContext.Provider value={contextValue}>{children}</StatusContext.Provider>;
}

// Hook to use Status Context
export function useStatus() {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatus must be used within a StatusProvider");
  }
  return context;
}

// Specific Status Hooks for Backward Compatibility
export function useNetworkStatus() {
  const { status } = useStatus();
  return status.network;
}

export function useCredentialStatus() {
  const { status } = useStatus();
  return status.credentials;
}

export function useTradingStatus() {
  const { status } = useStatus();
  return status.trading;
}

export function useSystemStatus() {
  const { status } = useStatus();
  return status.system;
}

export function useWorkflowStatus() {
  const { status } = useStatus();
  return status.workflows;
}

// Legacy compatibility hooks
export function useMexcConnectivityStatus() {
  const { status } = useStatus();
  return {
    data: status.network.connected,
    isConnected: status.network.connected,
    hasCredentials: status.credentials.hasCredentials,
    isValid: status.credentials.isValid,
  };
}

// React Query-specific hooks for advanced usage
export function useStatusRefresh() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["status"] });
  }, [queryClient]);
}

export function useStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ forceRefresh = true }: { forceRefresh?: boolean } = {}) => {
      const response = await fetch("/api/mexc/unified-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to refresh status");
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });
}
