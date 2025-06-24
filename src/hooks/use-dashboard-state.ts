import { useCallback, useEffect, useState } from "react";
import { createLogger } from "../lib/structured-logger";

interface WorkflowStatus {
  systemStatus: "running" | "stopped" | "error";
  lastUpdate: string;
  activeWorkflows: string[];
  metrics: {
    readyTokens: number;
    totalDetections: number;
    successfulSnipes: number;
    totalProfit: number;
    successRate: number;
    averageROI: number;
    bestTrade: number;
  };
  recentActivity: Array<{
    id: string;
    type: "pattern" | "calendar" | "snipe" | "analysis";
    message: string;
    timestamp: string;
  }>;
}

interface UseDashboardStateOptions {
  refreshInterval?: number;
  userId?: string;
}

const logger = createLogger("use-dashboard-state");

export function useDashboardState(options: UseDashboardStateOptions = {}) {
  const { refreshInterval = 10000, userId: _userId } = options;

  // Core state
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscoveryRunning, setIsDiscoveryRunning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showPreferences, setShowPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch system status
  const fetchSystemStatus = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/workflow-status");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setWorkflowStatus(data);
      setIsDiscoveryRunning(data.systemStatus === "running");
    } catch (error) {
      logger.error("Failed to fetch workflow status:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  // Toggle pattern discovery
  const togglePatternDiscovery = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const action = isDiscoveryRunning ? "stop_monitoring" : "start_monitoring";

      // Control scheduled monitoring
      const scheduleResponse = await fetch("/api/schedule/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!scheduleResponse.ok) {
        throw new Error(`Failed to ${action}: ${scheduleResponse.statusText}`);
      }

      if (action === "start_monitoring") {
        // Also trigger immediate workflows
        const promises = [
          fetch("/api/triggers/calendar-poll", { method: "POST" }),
          fetch("/api/triggers/pattern-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols: [] }),
          }),
        ];

        await Promise.allSettled(promises);
      }

      await fetchSystemStatus();
    } catch (error) {
      logger.error("Failed to toggle pattern discovery:", error);
      setError(error instanceof Error ? error.message : "Failed to toggle discovery");
    } finally {
      setIsLoading(false);
    }
  }, [isDiscoveryRunning, fetchSystemStatus]);

  // Run discovery cycle
  const runDiscoveryCycle = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Force immediate comprehensive analysis
      const forceResponse = await fetch("/api/schedule/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "force_analysis",
          data: { symbols: [] },
        }),
      });

      if (!forceResponse.ok) {
        throw new Error(`Failed to run discovery cycle: ${forceResponse.statusText}`);
      }

      // Add activity log
      await fetch("/api/workflow-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "addActivity",
          data: {
            activity: {
              type: "analysis",
              message: "Forced discovery cycle initiated",
            },
          },
        }),
      });

      await fetchSystemStatus();
    } catch (error) {
      logger.error("Failed to run discovery cycle:", error);
      setError(error instanceof Error ? error.message : "Failed to run discovery cycle");
    } finally {
      setIsLoading(false);
    }
  }, [fetchSystemStatus]);

  // Manual refresh
  const refreshStatus = useCallback(() => {
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  // Toggle preferences visibility
  const togglePreferences = useCallback(() => {
    setShowPreferences(!showPreferences);
  }, [showPreferences]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Setup polling
  useEffect(() => {
    fetchSystemStatus();

    const interval = setInterval(fetchSystemStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchSystemStatus, refreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsLoading(false);
      setError(null);
    };
  }, []);

  return {
    // State
    workflowStatus,
    isLoading,
    isDiscoveryRunning,
    lastRefresh,
    showPreferences,
    error,

    // Actions
    togglePatternDiscovery,
    runDiscoveryCycle,
    refreshStatus,
    togglePreferences,
    clearError,

    // Computed values
    hasError: !!error,
    isSystemHealthy: workflowStatus?.systemStatus === "running",
    activeWorkflowCount: workflowStatus?.activeWorkflows?.length || 0,
    recentActivityCount: workflowStatus?.recentActivity?.length || 0,
  };
}
