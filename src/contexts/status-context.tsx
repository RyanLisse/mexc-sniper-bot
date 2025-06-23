"use client";

import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from "react";

/**
 * Centralized Status Management System
 *
 * This system provides a single source of truth for all status information
 * across the application, eliminating contradictory status messages.
 */

// Unified Status Types
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

// Status Actions
type StatusAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "UPDATE_NETWORK"; payload: Partial<NetworkStatus> }
  | { type: "UPDATE_CREDENTIALS"; payload: Partial<CredentialStatus> }
  | { type: "UPDATE_TRADING"; payload: Partial<TradingStatus> }
  | { type: "UPDATE_SYSTEM"; payload: Partial<SystemStatus> }
  | { type: "UPDATE_WORKFLOWS"; payload: Partial<WorkflowStatus> }
  | { type: "SYNC_ERROR"; payload: string }
  | { type: "CLEAR_ERRORS" }
  | { type: "FULL_UPDATE"; payload: Partial<ApplicationStatus> };

// Initial State
const initialState: ApplicationStatus = {
  network: {
    connected: false,
    lastChecked: new Date().toISOString(),
  },
  credentials: {
    hasCredentials: false,
    isValid: false,
    source: "none",
    hasUserCredentials: false,
    hasEnvironmentCredentials: false,
    lastValidated: new Date().toISOString(),
  },
  trading: {
    canTrade: false,
    balanceLoaded: false,
    lastUpdate: new Date().toISOString(),
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
  isLoading: false,
  lastGlobalUpdate: new Date().toISOString(),
  syncErrors: [],
};

// Status Reducer
function statusReducer(state: ApplicationStatus, action: StatusAction): ApplicationStatus {
  const now = new Date().toISOString();

  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "UPDATE_NETWORK":
      return {
        ...state,
        network: { ...state.network, ...action.payload, lastChecked: now },
        lastGlobalUpdate: now,
      };

    case "UPDATE_CREDENTIALS":
      return {
        ...state,
        credentials: { ...state.credentials, ...action.payload, lastValidated: now },
        lastGlobalUpdate: now,
      };

    case "UPDATE_TRADING":
      return {
        ...state,
        trading: { ...state.trading, ...action.payload, lastUpdate: now },
        lastGlobalUpdate: now,
      };

    case "UPDATE_SYSTEM":
      return {
        ...state,
        system: { ...state.system, ...action.payload, lastHealthCheck: now },
        lastGlobalUpdate: now,
      };

    case "UPDATE_WORKFLOWS":
      return {
        ...state,
        workflows: { ...state.workflows, ...action.payload, lastUpdate: now },
        lastGlobalUpdate: now,
      };

    case "SYNC_ERROR":
      return {
        ...state,
        syncErrors: [...state.syncErrors.slice(-4), action.payload], // Keep last 5 errors
        lastGlobalUpdate: now,
      };

    case "CLEAR_ERRORS":
      return { ...state, syncErrors: [] };

    case "FULL_UPDATE":
      return {
        ...state,
        ...action.payload,
        lastGlobalUpdate: now,
      };

    default:
      return state;
  }
}

// Context Definition
interface StatusContextType {
  status: ApplicationStatus;
  dispatch: React.Dispatch<StatusAction>;
  refreshAll: () => Promise<void>;
  refreshNetwork: () => Promise<void>;
  refreshCredentials: () => Promise<void>;
  refreshTrading: () => Promise<void>;
  refreshSystem: () => Promise<void>;
  refreshWorkflows: () => Promise<void>;
  clearErrors: () => void;
  getOverallStatus: () => "healthy" | "warning" | "error" | "loading";
  getStatusMessage: () => string;
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
  const [status, dispatch] = useReducer(statusReducer, initialState);
  const queryClient = useQueryClient();
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  // API Fetching Functions
  const fetchNetworkStatus = useCallback(async (): Promise<NetworkStatus> => {
    try {
      // Use unified status resolver for consistent network status
      const { getUnifiedStatus } = await import("../services/unified-status-resolver");
      const unifiedStatus = await getUnifiedStatus();
      
      return {
        connected: unifiedStatus.network.connected,
        lastChecked: unifiedStatus.network.lastChecked,
        error: unifiedStatus.network.error,
      };
    } catch (error) {
      return {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }, []);

  const fetchCredentialStatus = useCallback(async (): Promise<CredentialStatus> => {
    try {
      // Use unified status resolver to eliminate contradictions
      const { getUnifiedStatus } = await import("../services/unified-status-resolver");
      const unifiedStatus = await getUnifiedStatus();
      
      return {
        hasCredentials: unifiedStatus.credentials.hasCredentials,
        isValid: unifiedStatus.credentials.isValid,
        source: unifiedStatus.credentials.source,
        hasUserCredentials: unifiedStatus.credentials.hasUserCredentials,
        hasEnvironmentCredentials: unifiedStatus.credentials.hasEnvironmentCredentials,
        lastValidated: unifiedStatus.credentials.lastValidated,
        error: unifiedStatus.credentials.error,
        // Enhanced fields
        isTestCredentials: unifiedStatus.credentials.isTestCredentials,
        connectionHealth: unifiedStatus.credentials.connectionHealth,
        metrics: unifiedStatus.credentials.metrics,
        alerts: unifiedStatus.credentials.alerts,
      };
    } catch (error) {
      return {
        hasCredentials: false,
        isValid: false,
        source: "none",
        hasUserCredentials: false,
        hasEnvironmentCredentials: false,
        lastValidated: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Credential check failed",
      };
    }
  }, []);

  const fetchTradingStatus = useCallback(async (): Promise<TradingStatus> => {
    try {
      // Only fetch if credentials are available
      if (!status.credentials.hasCredentials || !status.credentials.isValid) {
        return {
          canTrade: false,
          balanceLoaded: false,
          lastUpdate: new Date().toISOString(),
          error: "No valid credentials available",
        };
      }

      const response = await fetch("/api/mexc/account");
      const data = await response.json();

      return {
        canTrade: data.success && data.data?.canTrade === true,
        accountType: data.data?.accountType,
        balanceLoaded: data.success,
        lastUpdate: new Date().toISOString(),
        error: !data.success ? data.error : undefined,
      };
    } catch (error) {
      return {
        canTrade: false,
        balanceLoaded: false,
        lastUpdate: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Trading status check failed",
      };
    }
  }, [status.credentials.hasCredentials, status.credentials.isValid]);

  const fetchSystemStatus = useCallback(async (): Promise<SystemStatus> => {
    try {
      const [healthResponse, envResponse, validationResponse] = await Promise.allSettled([
        fetch("/api/health/system"),
        fetch("/api/health/environment"),
        fetch("/api/system/validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "quick_health_check" }),
        }),
      ]);

      const healthData =
        healthResponse.status === "fulfilled" ? await healthResponse.value.json() : null;
      const envData = envResponse.status === "fulfilled" ? await envResponse.value.json() : null;
      const validationData =
        validationResponse.status === "fulfilled" ? await validationResponse.value.json() : null;

      const components: Record<string, any> = {};

      // System API health
      if (healthData) {
        components.api = {
          status: healthData.success ? "active" : "error",
          message: healthData.message || "API status",
          lastChecked: new Date().toISOString(),
        };
      }

      // Environment configuration
      if (envData) {
        components.environment = {
          status: envData.success ? "active" : "warning",
          message: envData.message || "Environment status",
          lastChecked: new Date().toISOString(),
        };
      }

      // System readiness validation
      if (validationData && validationData.success) {
        const validationResult = validationData.data;
        components.validation = {
          status:
            validationResult.status === "ready"
              ? "active"
              : validationResult.status === "issues"
                ? "warning"
                : "error",
          message: `System validation score: ${validationResult.score}%`,
          lastChecked: new Date().toISOString(),
          readyForAutoSniping: validationResult.readyForAutoSniping,
          criticalIssues: validationResult.criticalIssues,
        };
      }

      // Determine overall status
      const hasErrors = Object.values(components).some((c) => c.status === "error");
      const hasWarnings = Object.values(components).some((c) => c.status === "warning");

      // If validation shows critical issues, mark as error
      const validationComponent = components.validation;
      if (
        validationComponent &&
        !validationComponent.readyForAutoSniping &&
        validationComponent.criticalIssues > 0
      ) {
        return {
          overall: "error",
          components,
          lastHealthCheck: new Date().toISOString(),
        };
      }

      return {
        overall: hasErrors ? "error" : hasWarnings ? "warning" : "healthy",
        components,
        lastHealthCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        overall: "error",
        components: {
          system: {
            status: "error",
            message: error instanceof Error ? error.message : "System check failed",
            lastChecked: new Date().toISOString(),
          },
        },
        lastHealthCheck: new Date().toISOString(),
      };
    }
  }, []);

  const fetchWorkflowStatus = useCallback(async (): Promise<WorkflowStatus> => {
    try {
      // This would integrate with your workflow monitoring system
      // For now, using basic status
      return {
        discoveryRunning: false,
        sniperActive: false,
        activeWorkflows: [],
        systemStatus: "stopped",
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      return {
        discoveryRunning: false,
        sniperActive: false,
        activeWorkflows: [],
        systemStatus: "error",
        lastUpdate: new Date().toISOString(),
      };
    }
  }, []);

  // Refresh Functions
  const refreshNetwork = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const networkStatus = await fetchNetworkStatus();
      dispatch({ type: "UPDATE_NETWORK", payload: networkStatus });
    } catch (error) {
      dispatch({
        type: "SYNC_ERROR",
        payload: `Network refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }, [fetchNetworkStatus]);

  const refreshCredentials = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const credentialStatus = await fetchCredentialStatus();
      dispatch({ type: "UPDATE_CREDENTIALS", payload: credentialStatus });
    } catch (error) {
      dispatch({
        type: "SYNC_ERROR",
        payload: `Credential refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }, [fetchCredentialStatus]);

  const refreshTrading = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const tradingStatus = await fetchTradingStatus();
      dispatch({ type: "UPDATE_TRADING", payload: tradingStatus });
    } catch (error) {
      dispatch({
        type: "SYNC_ERROR",
        payload: `Trading refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }, [fetchTradingStatus]);

  const refreshSystem = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const systemStatus = await fetchSystemStatus();
      dispatch({ type: "UPDATE_SYSTEM", payload: systemStatus });
    } catch (error) {
      dispatch({
        type: "SYNC_ERROR",
        payload: `System refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }, [fetchSystemStatus]);

  const refreshWorkflows = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const workflowStatus = await fetchWorkflowStatus();
      dispatch({ type: "UPDATE_WORKFLOWS", payload: workflowStatus });
    } catch (error) {
      dispatch({
        type: "SYNC_ERROR",
        payload: `Workflow refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }, [fetchWorkflowStatus]);

  const refreshAll = useCallback(async () => {
    if (!mountedRef.current) return;

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Refresh in logical order - network first, then credentials, then trading
      await refreshNetwork();
      await refreshCredentials();
      await refreshSystem();
      await refreshTrading(); // Trading depends on credentials
      await refreshWorkflows();
    } catch (error) {
      dispatch({
        type: "SYNC_ERROR",
        payload: `Global refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      if (mountedRef.current) {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
  }, [refreshNetwork, refreshCredentials, refreshSystem, refreshTrading, refreshWorkflows]);

  const clearErrors = useCallback(() => {
    dispatch({ type: "CLEAR_ERRORS" });
  }, []);

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

    // Enhanced health evaluation (same as before but documented as unified)
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

    // Unified status message logic to eliminate contradictions
    if (!status.network.connected) return "Network connection unavailable";
    if (status.syncErrors.length > 0) return `System errors detected (${status.syncErrors.length})`;

    // Unified credential status messages
    if (!status.credentials.hasCredentials) return "API credentials not configured";
    if (status.credentials.isTestCredentials)
      return "Demo mode active with test credentials - configure real MEXC API credentials for live trading";
    if (!status.credentials.isValid) return "API credentials invalid";

    // Enhanced health status (consistent with unified resolver)
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
  }, [status]);

  // Auto-refresh Effect
  useEffect(() => {
    if (!enableRealTimeUpdates) return;

    const setupAutoRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          refreshAll().then(() => {
            if (mountedRef.current) {
              setupAutoRefresh();
            }
          });
        }
      }, autoRefreshInterval);
    };

    // Initial load
    refreshAll();

    // Setup auto-refresh
    setupAutoRefresh();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [autoRefreshInterval, enableRealTimeUpdates, refreshAll]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const contextValue: StatusContextType = {
    status,
    dispatch,
    refreshAll,
    refreshNetwork,
    refreshCredentials,
    refreshTrading,
    refreshSystem,
    refreshWorkflows,
    clearErrors,
    getOverallStatus,
    getStatusMessage,
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
