/**
 * usePatternMonitoring Hook
 *
 * React hook for managing pattern monitoring state and API interactions.
 * Provides real-time pattern detection monitoring capabilities.
 */

import { ApiClient } from "@/src/lib/api-client";
import type { CalendarEntry, SymbolEntry } from "@/src/services/mexc-unified-exports";
import type { PatternMatch } from "@/src/services/pattern-detection-engine";
import type { PatternMonitoringReport } from "@/src/services/pattern-monitoring-service";
import { useCallback, useEffect, useState } from "react";

interface PatternMonitoringState {
  // Monitoring report data
  report: PatternMonitoringReport | null;
  recentPatterns: PatternMatch[] | null;

  // Loading states
  isLoading: boolean;
  isStartingMonitoring: boolean;
  isStoppingMonitoring: boolean;
  isDetecting: boolean;

  // Error handling
  error: string | null;

  // Last update tracking
  lastUpdated: string | null;

  // Real-time monitoring status
  isMonitoringActive: boolean;
  consecutiveErrors: number;

  // Alert management
  unacknowledgedAlertsCount: number;
}

interface PatternMonitoringActions {
  // Main monitoring functions
  loadMonitoringReport: (includePatterns?: boolean, patternLimit?: number) => Promise<void>;
  startMonitoring: () => Promise<boolean>;
  stopMonitoring: () => Promise<boolean>;

  // Manual pattern detection
  runManualDetection: (
    symbols: SymbolEntry[],
    calendarEntries?: CalendarEntry[]
  ) => Promise<PatternMatch[] | null>;

  // Alert management
  acknowledgeAlert: (alertId: string) => Promise<boolean>;
  clearAcknowledgedAlerts: () => Promise<number>;

  // Utility functions
  refreshData: () => Promise<void>;
  clearError: () => void;

  // Auto-refresh control
  startAutoRefresh: (intervalMs?: number) => void;
  stopAutoRefresh: () => void;
}

interface UsePatternMonitoringOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  loadOnMount?: boolean;
  includePatterns?: boolean;
  patternLimit?: number;
}

export function usePatternMonitoring(
  options: UsePatternMonitoringOptions = {}
): PatternMonitoringState & PatternMonitoringActions {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    loadOnMount = true,
    includePatterns = true,
    patternLimit = 20,
  } = options;

  // State management
  const [state, setState] = useState<PatternMonitoringState>({
    report: null,
    recentPatterns: null,
    isLoading: false,
    isStartingMonitoring: false,
    isStoppingMonitoring: false,
    isDetecting: false,
    error: null,
    lastUpdated: null,
    isMonitoringActive: false,
    consecutiveErrors: 0,
    unacknowledgedAlertsCount: 0,
  });

  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Clear error state
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Load monitoring report
  const loadMonitoringReport = useCallback(async (includePatterns = true, patternLimit = 20) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const queryParams = new URLSearchParams({
        include_patterns: includePatterns.toString(),
        pattern_limit: patternLimit.toString(),
      });

      const response = await ApiClient.get<{
        data: {
          report: PatternMonitoringReport;
          recentPatterns?: PatternMatch[];
          monitoring: {
            isActive: boolean;
            lastUpdate: string;
            totalAlerts: number;
            unacknowledgedAlerts: number;
          };
        };
        message: string;
      }>(`/api/auto-sniping/pattern-monitoring?${queryParams}`);

      setState((prev) => ({
        ...prev,
        report: response.data.report,
        recentPatterns: response.data.recentPatterns || null,
        isMonitoringActive: response.data.monitoring.isActive,
        unacknowledgedAlertsCount: response.data.monitoring.unacknowledgedAlerts,
        consecutiveErrors: response.data.report.stats.consecutiveErrors,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("[usePatternMonitoring] Failed to load monitoring report:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load monitoring report",
      }));
    }
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isStartingMonitoring: true, error: null }));

    try {
      await ApiClient.post<{ message: string }>("/api/auto-sniping/pattern-monitoring", {
        action: "start_monitoring",
      });

      setState((prev) => ({
        ...prev,
        isStartingMonitoring: false,
        isMonitoringActive: true,
      }));

      // Refresh data after starting
      await loadMonitoringReport(includePatterns, patternLimit);

      return true;
    } catch (error) {
      console.error("[usePatternMonitoring] Failed to start monitoring:", error);
      setState((prev) => ({
        ...prev,
        isStartingMonitoring: false,
        error: error instanceof Error ? error.message : "Failed to start monitoring",
      }));
      return false;
    }
  }, [loadMonitoringReport, includePatterns, patternLimit]);

  // Stop monitoring
  const stopMonitoring = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isStoppingMonitoring: true, error: null }));

    try {
      await ApiClient.post<{ message: string }>("/api/auto-sniping/pattern-monitoring", {
        action: "stop_monitoring",
      });

      setState((prev) => ({
        ...prev,
        isStoppingMonitoring: false,
        isMonitoringActive: false,
      }));

      return true;
    } catch (error) {
      console.error("[usePatternMonitoring] Failed to stop monitoring:", error);
      setState((prev) => ({
        ...prev,
        isStoppingMonitoring: false,
        error: error instanceof Error ? error.message : "Failed to stop monitoring",
      }));
      return false;
    }
  }, []);

  // Run manual pattern detection
  const runManualDetection = useCallback(
    async (
      symbols: SymbolEntry[],
      calendarEntries?: CalendarEntry[]
    ): Promise<PatternMatch[] | null> => {
      setState((prev) => ({ ...prev, isDetecting: true, error: null }));

      try {
        const response = await ApiClient.post<{
          data: {
            patterns: PatternMatch[];
            summary: {
              totalPatterns: number;
              readyStatePatterns: number;
              preReadyPatterns: number;
              advanceOpportunities: number;
              averageConfidence: number;
            };
          };
          message: string;
        }>("/api/auto-sniping/pattern-monitoring", {
          action: "manual_detection",
          symbols,
          calendarEntries,
        });

        setState((prev) => ({ ...prev, isDetecting: false }));

        // Refresh data after manual detection
        await loadMonitoringReport(includePatterns, patternLimit);

        return response.data.patterns;
      } catch (error) {
        console.error("[usePatternMonitoring] Manual detection failed:", error);
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          error: error instanceof Error ? error.message : "Manual detection failed",
        }));
        return null;
      }
    },
    [loadMonitoringReport, includePatterns, patternLimit]
  );

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string): Promise<boolean> => {
    try {
      await ApiClient.post<{ message: string }>("/api/auto-sniping/pattern-monitoring", {
        action: "acknowledge_alert",
        alertId,
      });

      // Update local state
      setState((prev) => ({
        ...prev,
        report: prev.report
          ? {
              ...prev.report,
              activeAlerts: prev.report.activeAlerts.map((alert) =>
                alert.id === alertId ? { ...alert, acknowledged: true } : alert
              ),
            }
          : null,
        unacknowledgedAlertsCount: Math.max(0, prev.unacknowledgedAlertsCount - 1),
      }));

      return true;
    } catch (error) {
      console.error("[usePatternMonitoring] Failed to acknowledge alert:", error);
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
      }>("/api/auto-sniping/pattern-monitoring", {
        action: "clear_acknowledged_alerts",
      });

      // Refresh data after clearing
      await loadMonitoringReport(includePatterns, patternLimit);

      return response.data.clearedCount;
    } catch (error) {
      console.error("[usePatternMonitoring] Failed to clear alerts:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to clear alerts",
      }));
      return 0;
    }
  }, [loadMonitoringReport, includePatterns, patternLimit]);

  // Refresh data (alias for loadMonitoringReport)
  const refreshData = useCallback(async () => {
    await loadMonitoringReport(includePatterns, patternLimit);
  }, [loadMonitoringReport, includePatterns, patternLimit]);

  // Start auto-refresh
  const startAutoRefresh = useCallback(
    (intervalMs = refreshInterval) => {
      // Clear existing interval
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }

      const interval = setInterval(() => {
        loadMonitoringReport(includePatterns, patternLimit);
      }, intervalMs);

      setAutoRefreshInterval(interval);
    },
    [autoRefreshInterval, refreshInterval, loadMonitoringReport, includePatterns, patternLimit]
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
      loadMonitoringReport(includePatterns, patternLimit);
    }
  }, [loadOnMount, loadMonitoringReport, includePatterns, patternLimit]);

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
    loadMonitoringReport,
    startMonitoring,
    stopMonitoring,
    runManualDetection,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    refreshData,
    clearError,
    startAutoRefresh,
    stopAutoRefresh,
  };
}

// Utility hooks for specific use cases

/**
 * Hook for monitoring pattern statistics only
 */
export function usePatternStats(refreshInterval = 60000) {
  return usePatternMonitoring({
    autoRefresh: true,
    refreshInterval,
    loadOnMount: true,
    includePatterns: false,
  });
}

/**
 * Hook for pattern detection operations
 */
export function usePatternDetection() {
  return usePatternMonitoring({
    autoRefresh: false,
    loadOnMount: false,
    includePatterns: true,
    patternLimit: 50,
  });
}

export default usePatternMonitoring;
