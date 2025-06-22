/**
 * useAutoSnipingExecution Hook
 *
 * React hook for managing auto-sniping execution state and API interactions.
 * Provides comprehensive control over trade execution and position management.
 */

import { ApiClient } from "@/src/lib/api-client";
import type {
  AutoSnipingConfig,
  AutoSnipingExecutionReport,
  ExecutionAlert,
  ExecutionPosition,
  ExecutionStats,
} from "@/src/services/auto-sniping-execution-service";
import { useCallback, useEffect, useState } from "react";

interface AutoSnipingExecutionState {
  // Execution report data
  report: AutoSnipingExecutionReport | null;
  config: AutoSnipingConfig | null;
  stats: ExecutionStats | null;
  activePositions: ExecutionPosition[];
  recentExecutions: ExecutionPosition[];
  activeAlerts: ExecutionAlert[];

  // Execution status
  isExecutionActive: boolean;
  executionStatus: "active" | "idle" | "paused" | "error";

  // Loading states
  isLoading: boolean;
  isStartingExecution: boolean;
  isStoppingExecution: boolean;
  isPausingExecution: boolean;
  isResumingExecution: boolean;
  isClosingPosition: boolean;
  isUpdatingConfig: boolean;

  // Error handling
  error: string | null;

  // Last update tracking
  lastUpdated: string | null;

  // Summary metrics
  totalPnl: string;
  successRate: number;
  activePositionsCount: number;
  unacknowledgedAlertsCount: number;
  dailyTradeCount: number;
}

interface AutoSnipingExecutionActions {
  // Execution control
  startExecution: () => Promise<boolean>;
  stopExecution: () => Promise<boolean>;
  pauseExecution: () => Promise<boolean>;
  resumeExecution: () => Promise<boolean>;

  // Position management
  closePosition: (positionId: string, reason?: string) => Promise<boolean>;
  emergencyCloseAll: () => Promise<number>;

  // Configuration management
  updateConfig: (config: Partial<AutoSnipingConfig>) => Promise<boolean>;

  // Alert management
  acknowledgeAlert: (alertId: string) => Promise<boolean>;
  clearAcknowledgedAlerts: () => Promise<number>;

  // Data management
  loadExecutionReport: (
    includePositions?: boolean,
    includeHistory?: boolean,
    includeAlerts?: boolean
  ) => Promise<void>;
  refreshData: () => Promise<void>;
  clearError: () => void;

  // Auto-refresh control
  startAutoRefresh: (intervalMs?: number) => void;
  stopAutoRefresh: () => void;
}

interface UseAutoSnipingExecutionOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  loadOnMount?: boolean;
  includePositions?: boolean;
  includeHistory?: boolean;
  includeAlerts?: boolean;
}

export function useAutoSnipingExecution(
  options: UseAutoSnipingExecutionOptions = {}
): AutoSnipingExecutionState & AutoSnipingExecutionActions {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    loadOnMount = true,
    includePositions = true,
    includeHistory = true,
    includeAlerts = true,
  } = options;

  // State management
  const [state, setState] = useState<AutoSnipingExecutionState>({
    report: null,
    config: null,
    stats: null,
    activePositions: [],
    recentExecutions: [],
    activeAlerts: [],
    isExecutionActive: false,
    executionStatus: "idle",
    isLoading: false,
    isStartingExecution: false,
    isStoppingExecution: false,
    isPausingExecution: false,
    isResumingExecution: false,
    isClosingPosition: false,
    isUpdatingConfig: false,
    error: null,
    lastUpdated: null,
    totalPnl: "0",
    successRate: 0,
    activePositionsCount: 0,
    unacknowledgedAlertsCount: 0,
    dailyTradeCount: 0,
  });

  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Clear error state
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Load execution report
  const loadExecutionReport = useCallback(
    async (includePositions = true, includeHistory = true, includeAlerts = true) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const queryParams = new URLSearchParams({
          include_positions: includePositions.toString(),
          include_history: includeHistory.toString(),
          include_alerts: includeAlerts.toString(),
        });

        const response = await ApiClient.get<{
          data: {
            report: AutoSnipingExecutionReport;
            execution: {
              isActive: boolean;
              status: "active" | "idle" | "paused" | "error";
              activePositionsCount: number;
              totalPnl: string;
              successRate: number;
              dailyTrades: number;
            };
          };
          message: string;
        }>(`/api/auto-sniping/execution?${queryParams}`);

        // Check if response has the expected structure with safe property access
        if (!response?.data || !response.data.success) {
          throw new Error("API request failed or returned unsuccessful response");
        }

        const responseData = response.data.data;
        if (!responseData?.report || !responseData.execution) {
          throw new Error("Invalid API response structure - missing required data fields");
        }

        const report = responseData.report;
        const execution = responseData.execution;

        setState((prev) => ({
          ...prev,
          report: report,
          config: report.config || {},
          stats: report.stats || {
            totalTrades: 0,
            successRate: 0,
            totalPnl: "0",
            dailyTradeCount: 0,
          },
          activePositions: report.activePositions || [],
          recentExecutions: report.recentExecutions || [],
          activeAlerts: report.activeAlerts || [],
          isExecutionActive: execution.isActive || false,
          executionStatus: execution.status || "idle",
          totalPnl: execution.totalPnl || "0",
          successRate: execution.successRate || 0,
          activePositionsCount: execution.activePositionsCount || 0,
          dailyTradeCount: execution.dailyTrades || 0,
          unacknowledgedAlertsCount: (report.activeAlerts || []).filter((a) => !a.acknowledged)
            .length,
          isLoading: false,
          lastUpdated: new Date().toISOString(),
        }));
      } catch (error) {
        console.error("[useAutoSnipingExecution] Failed to load execution report:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "Failed to load execution report",
        }));
      }
    },
    []
  );

  // Start execution
  const startExecution = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isStartingExecution: true, error: null }));

    try {
      await ApiClient.post<{ message: string }>("/api/auto-sniping/execution", {
        action: "start_execution",
      });

      setState((prev) => ({
        ...prev,
        isStartingExecution: false,
        isExecutionActive: true,
        executionStatus: "active",
      }));

      // Refresh data after starting
      await loadExecutionReport(includePositions, includeHistory, includeAlerts);

      return true;
    } catch (error) {
      console.error("[useAutoSnipingExecution] Failed to start execution:", error);
      setState((prev) => ({
        ...prev,
        isStartingExecution: false,
        error: error instanceof Error ? error.message : "Failed to start execution",
      }));
      return false;
    }
  }, [loadExecutionReport, includePositions, includeHistory, includeAlerts]);

  // Stop execution
  const stopExecution = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isStoppingExecution: true, error: null }));

    try {
      await ApiClient.post<{ message: string }>("/api/auto-sniping/execution", {
        action: "stop_execution",
      });

      setState((prev) => ({
        ...prev,
        isStoppingExecution: false,
        isExecutionActive: false,
        executionStatus: "idle",
      }));

      return true;
    } catch (error) {
      console.error("[useAutoSnipingExecution] Failed to stop execution:", error);
      setState((prev) => ({
        ...prev,
        isStoppingExecution: false,
        error: error instanceof Error ? error.message : "Failed to stop execution",
      }));
      return false;
    }
  }, []);

  // Pause execution
  const pauseExecution = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isPausingExecution: true, error: null }));

    try {
      await ApiClient.post<{ message: string }>("/api/auto-sniping/execution", {
        action: "pause_execution",
      });

      setState((prev) => ({
        ...prev,
        isPausingExecution: false,
        executionStatus: "paused",
      }));

      return true;
    } catch (error) {
      console.error("[useAutoSnipingExecution] Failed to pause execution:", error);
      setState((prev) => ({
        ...prev,
        isPausingExecution: false,
        error: error instanceof Error ? error.message : "Failed to pause execution",
      }));
      return false;
    }
  }, []);

  // Resume execution
  const resumeExecution = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isResumingExecution: true, error: null }));

    try {
      await ApiClient.post<{ message: string }>("/api/auto-sniping/execution", {
        action: "resume_execution",
      });

      setState((prev) => ({
        ...prev,
        isResumingExecution: false,
        executionStatus: "active",
      }));

      return true;
    } catch (error) {
      console.error("[useAutoSnipingExecution] Failed to resume execution:", error);
      setState((prev) => ({
        ...prev,
        isResumingExecution: false,
        error: error instanceof Error ? error.message : "Failed to resume execution",
      }));
      return false;
    }
  }, []);

  // Close position
  const closePosition = useCallback(
    async (positionId: string, reason = "manual"): Promise<boolean> => {
      setState((prev) => ({ ...prev, isClosingPosition: true, error: null }));

      try {
        await ApiClient.post<{ message: string }>("/api/auto-sniping/execution", {
          action: "close_position",
          positionId,
          reason,
        });

        setState((prev) => ({ ...prev, isClosingPosition: false }));

        // Refresh data after closing position
        await loadExecutionReport(includePositions, includeHistory, includeAlerts);

        return true;
      } catch (error) {
        console.error("[useAutoSnipingExecution] Failed to close position:", error);
        setState((prev) => ({
          ...prev,
          isClosingPosition: false,
          error: error instanceof Error ? error.message : "Failed to close position",
        }));
        return false;
      }
    },
    [loadExecutionReport, includePositions, includeHistory, includeAlerts]
  );

  // Emergency close all
  const emergencyCloseAll = useCallback(async (): Promise<number> => {
    setState((prev) => ({ ...prev, error: null }));

    try {
      const response = await ApiClient.post<{
        data: { closedCount: number };
        message: string;
      }>("/api/auto-sniping/execution", {
        action: "emergency_close_all",
      });

      // Refresh data after emergency close
      await loadExecutionReport(includePositions, includeHistory, includeAlerts);

      return response.data.closedCount;
    } catch (error) {
      console.error("[useAutoSnipingExecution] Emergency close failed:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Emergency close failed",
      }));
      return 0;
    }
  }, [loadExecutionReport, includePositions, includeHistory, includeAlerts]);

  // Update configuration
  const updateConfig = useCallback(
    async (config: Partial<AutoSnipingConfig>): Promise<boolean> => {
      setState((prev) => ({ ...prev, isUpdatingConfig: true, error: null }));

      try {
        await ApiClient.put<{ message: string }>("/api/auto-sniping/execution", {
          config,
        });

        setState((prev) => ({
          ...prev,
          isUpdatingConfig: false,
          config: prev.config ? { ...prev.config, ...config } : null,
        }));

        // Refresh data after config update
        await loadExecutionReport(includePositions, includeHistory, includeAlerts);

        return true;
      } catch (error) {
        console.error("[useAutoSnipingExecution] Failed to update config:", error);
        setState((prev) => ({
          ...prev,
          isUpdatingConfig: false,
          error: error instanceof Error ? error.message : "Failed to update configuration",
        }));
        return false;
      }
    },
    [loadExecutionReport, includePositions, includeHistory, includeAlerts]
  );

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string): Promise<boolean> => {
    try {
      await ApiClient.post<{ message: string }>("/api/auto-sniping/execution", {
        action: "acknowledge_alert",
        alertId,
      });

      // Update local state
      setState((prev) => ({
        ...prev,
        activeAlerts: prev.activeAlerts.map((alert) =>
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ),
        unacknowledgedAlertsCount: Math.max(0, prev.unacknowledgedAlertsCount - 1),
      }));

      return true;
    } catch (error) {
      console.error("[useAutoSnipingExecution] Failed to acknowledge alert:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to acknowledge alert",
      }));
      return false;
    }
  }, []);

  // Clear acknowledged alerts
  const clearAcknowledgedAlerts = useCallback(async (): Promise<number> => {
    try {
      const response = await ApiClient.post<{
        data: { clearedCount: number };
        message: string;
      }>("/api/auto-sniping/execution", {
        action: "clear_acknowledged_alerts",
      });

      // Refresh data after clearing
      await loadExecutionReport(includePositions, includeHistory, includeAlerts);

      return response.data.clearedCount;
    } catch (error) {
      console.error("[useAutoSnipingExecution] Failed to clear alerts:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to clear alerts",
      }));
      return 0;
    }
  }, [loadExecutionReport, includePositions, includeHistory, includeAlerts]);

  // Refresh data (alias for loadExecutionReport)
  const refreshData = useCallback(async () => {
    await loadExecutionReport(includePositions, includeHistory, includeAlerts);
  }, [loadExecutionReport, includePositions, includeHistory, includeAlerts]);

  // Start auto-refresh
  const startAutoRefresh = useCallback(
    (intervalMs = refreshInterval) => {
      // Clear existing interval
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }

      const interval = setInterval(() => {
        loadExecutionReport(includePositions, includeHistory, includeAlerts);
      }, intervalMs);

      setAutoRefreshInterval(interval);
    },
    [
      autoRefreshInterval,
      refreshInterval,
      loadExecutionReport,
      includePositions,
      includeHistory,
      includeAlerts,
    ]
  );

  // Stop auto-refresh
  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      setAutoRefreshInterval(null);
    }
  }, [autoRefreshInterval]);

  // Load initial data on mount
  useEffect(() => {
    if (loadOnMount) {
      loadExecutionReport(includePositions, includeHistory, includeAlerts);
    }
  }, [loadOnMount, loadExecutionReport, includePositions, includeHistory, includeAlerts]);

  // Setup auto-refresh if enabled
  useEffect(() => {
    if (autoRefresh) {
      startAutoRefresh();
    }

    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [autoRefresh, startAutoRefresh, autoRefreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [autoRefreshInterval]);

  return {
    // State
    ...state,

    // Actions
    startExecution,
    stopExecution,
    pauseExecution,
    resumeExecution,
    closePosition,
    emergencyCloseAll,
    updateConfig,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    loadExecutionReport,
    refreshData,
    clearError,
    startAutoRefresh,
    stopAutoRefresh,
  };
}

// Utility hooks for specific use cases

/**
 * Hook for monitoring execution status only
 */
export function useExecutionStatus(refreshInterval = 60000) {
  return useAutoSnipingExecution({
    autoRefresh: true,
    refreshInterval,
    loadOnMount: true,
    includePositions: false,
    includeHistory: false,
    includeAlerts: false,
  });
}

/**
 * Hook for position management
 */
export function usePositionManagement() {
  return useAutoSnipingExecution({
    autoRefresh: true,
    refreshInterval: 15000, // More frequent updates for positions
    loadOnMount: true,
    includePositions: true,
    includeHistory: true,
    includeAlerts: true,
  });
}

/**
 * Hook for configuration management
 */
export function useExecutionConfig() {
  return useAutoSnipingExecution({
    autoRefresh: false,
    loadOnMount: true,
    includePositions: false,
    includeHistory: false,
    includeAlerts: false,
  });
}

export default useAutoSnipingExecution;
