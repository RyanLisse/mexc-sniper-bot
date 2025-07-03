"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Simplified Status Context
 * Basic status management without complex React Query setup
 */

// Simplified types
export interface SimpleStatus {
  connected: boolean;
  hasCredentials: boolean;
  isValid: boolean;
  canTrade: boolean;
  overall: "healthy" | "warning" | "error" | "loading";
  message: string;
}

interface StatusContextType {
  status: SimpleStatus;
  isLoading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
}

const StatusContext = createContext<StatusContextType | null>(null);

// Status Provider Component
interface StatusProviderProps {
  children: ReactNode;
}

export function StatusProvider({ children }: StatusProviderProps) {
  const [status, setStatus] = useState<SimpleStatus>({
    connected: false,
    hasCredentials: false,
    isValid: false,
    canTrade: false,
    overall: "loading",
    message: "Loading status...",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load status data
  const loadStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mexc/unified-status");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch status");
      }

      const data = result.data;
      setStatus({
        connected: data.connected || false,
        hasCredentials: data.hasCredentials || false,
        isValid: data.credentialsValid || false,
        canTrade: data.canTrade || false,
        overall: data.overallStatus || "error",
        message: data.statusMessage || "Status unknown",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load status";
      setError(errorMessage);
      setStatus((prev) => ({
        ...prev,
        overall: "error",
        message: errorMessage,
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const contextValue: StatusContextType = {
    status,
    isLoading,
    error,
    refreshStatus: loadStatus,
  };

  return (
    <StatusContext.Provider value={contextValue}>
      {children}
    </StatusContext.Provider>
  );
}

// Hook to use Status Context
export function useStatus() {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatus must be used within a StatusProvider");
  }
  return context;
}

// Legacy compatibility hooks
export function useNetworkStatus() {
  const { status } = useStatus();
  return { connected: status.connected };
}

export function useCredentialStatus() {
  const { status } = useStatus();
  return {
    hasCredentials: status.hasCredentials,
    isValid: status.isValid,
  };
}

export function useTradingStatus() {
  const { status } = useStatus();
  return { canTrade: status.canTrade };
}

export function useMexcConnectivityStatus() {
  const { status } = useStatus();
  return {
    data: status.connected,
    isConnected: status.connected,
    hasCredentials: status.hasCredentials,
    isValid: status.isValid,
  };
}

// Export legacy types for backward compatibility
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
  // Enhanced fields for backward compatibility
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
