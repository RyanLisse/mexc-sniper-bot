/**
 * Real-time Safety Monitoring Hook
 *
 * React hook for managing real-time safety monitoring state and operations.
 * Provides comprehensive safety monitoring capabilities with auto-refresh and error handling.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RiskMetrics,
  SafetyAction,
  SafetyAlert,
  SafetyConfiguration,
  SafetyMonitoringReport,
} from "@/src/schemas/safety-monitoring-schemas";
export interface UseRealTimeSafetyMonitoringOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  loadOnMount?: boolean;
  includeRecommendations?: boolean;
  includeSystemHealth?: boolean;
}

export interface RealTimeSafetyMonitoringState {
  // Core data
  report: SafetyMonitoringReport | null;
  riskMetrics: RiskMetrics | null;
  activeAlerts: SafetyAlert[];
  recentActions: SafetyAction[];

  // Derived state
  safetyStatus: string;
  overallRiskScore: number;
  alertsCount: number;
  criticalAlertsCount: number;
  systemHealthScore: number;
  monitoringActive: boolean;

  // Loading states
  isLoading: boolean;
  isStartingMonitoring: boolean;
  isStoppingMonitoring: boolean;
  isUpdatingConfig: boolean;
  isTriggeringEmergency: boolean;
  isAcknowledgingAlert: boolean;
  isClearingAlerts: boolean;

  // Error handling
  error: string | null;
  lastUpdated: string | null;
}

export interface RealTimeSafetyMonitoringActions {
  // Monitoring controls
  startMonitoring: () => Promise<boolean>;
  stopMonitoring: () => Promise<boolean>;
  updateConfiguration: (config: Partial<SafetyConfiguration>) => Promise<boolean>;

  // Emergency response
  triggerEmergencyResponse: (reason: string) => Promise<SafetyAction[]>;

  // Alert management
  acknowledgeAlert: (alertId: string) => Promise<boolean>;
  clearAcknowledgedAlerts: () => Promise<number>;

  // Data operations
  refreshData: () => Promise<void>;
  getRiskMetrics: () => Promise<RiskMetrics | null>;
  checkSystemSafety: () => Promise<boolean>;

  // Utility
  clearError: () => void;
}

export function useRealTimeSafetyMonitoring(
  options: UseRealTimeSafetyMonitoringOptions = {}
): RealTimeSafetyMonitoringState & RealTimeSafetyMonitoringActions {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    loadOnMount = true,
    includeRecommendations = true,
    includeSystemHealth = true,
  } = options;

  // State
  const [report, setReport] = useState<SafetyMonitoringReport | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingMonitoring, setIsStartingMonitoring] = useState(false);
  const [isStoppingMonitoring, setIsStoppingMonitoring] = useState(false);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [isTriggeringEmergency, setIsTriggeringEmergency] = useState(false);
  const [isAcknowledgingAlert, setIsAcknowledgingAlert] = useState(false);
  const [isClearingAlerts, setIsClearingAlerts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Refs for cleanup
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Derived state
  const activeAlerts = report?.activeAlerts || [];
  const recentActions = report?.recentActions || [];
  const safetyStatus = report?.status || "unknown";
  const overallRiskScore = report?.overallRiskScore || 0;
  const alertsCount = activeAlerts.length;
  const criticalAlertsCount = activeAlerts.filter((alert) => alert.severity === "critical").length;
  const systemHealthScore = report?.systemHealth?.overallHealth || 0;
  const monitoringActive = report?.status !== "safe" && report?.monitoringStats?.systemUptime > 0;

  // Load safety monitoring report
  const loadSafetyReport = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        include_recommendations: includeRecommendations.toString(),
        include_system_health: includeSystemHealth.toString(),
      });

      const response = await fetch(`/api/auto-sniping/safety-monitoring?${queryParams}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load safety report`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load safety monitoring report");
      }

      if (mountedRef.current) {
        setReport(result.data);
        setLastUpdated(new Date().toISOString());
      }
    } catch (err: any) {
      console.error("[RealTimeSafetyMonitoring] Failed to load report:", err);
      if (mountedRef.current) {
        setError(err.message || "Failed to load safety monitoring report");
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [includeRecommendations, includeSystemHealth]);

  // Start safety monitoring
  const startMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      setIsStartingMonitoring(true);
      setError(null);

      const response = await fetch("/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_monitoring" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to start monitoring`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to start safety monitoring");
      }

      // Refresh data after successful start
      await loadSafetyReport();
      return true;
    } catch (err: any) {
      console.error("[RealTimeSafetyMonitoring] Failed to start monitoring:", err);
      setError(err.message || "Failed to start safety monitoring");
      return false;
    } finally {
      setIsStartingMonitoring(false);
    }
  }, [loadSafetyReport]);

  // Stop safety monitoring
  const stopMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      setIsStoppingMonitoring(true);
      setError(null);

      const response = await fetch("/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop_monitoring" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to stop monitoring`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to stop safety monitoring");
      }

      // Refresh data after successful stop
      await loadSafetyReport();
      return true;
    } catch (err: any) {
      console.error("[RealTimeSafetyMonitoring] Failed to stop monitoring:", err);
      setError(err.message || "Failed to stop safety monitoring");
      return false;
    } finally {
      setIsStoppingMonitoring(false);
    }
  }, [loadSafetyReport]);

  // Update configuration
  const updateConfiguration = useCallback(
    async (config: Partial<SafetyConfiguration>): Promise<boolean> => {
      try {
        setIsUpdatingConfig(true);
        setError(null);

        const response = await fetch("/api/auto-sniping/safety-monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_configuration",
            configuration: config,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to update configuration`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to update safety configuration");
        }

        // Refresh data after successful update
        await loadSafetyReport();
        return true;
      } catch (err: any) {
        console.error("[RealTimeSafetyMonitoring] Failed to update config:", err);
        setError(err.message || "Failed to update safety configuration");
        return false;
      } finally {
        setIsUpdatingConfig(false);
      }
    },
    [loadSafetyReport]
  );

  // Trigger emergency response
  const triggerEmergencyResponse = useCallback(
    async (reason: string): Promise<SafetyAction[]> => {
      try {
        setIsTriggeringEmergency(true);
        setError(null);

        const response = await fetch("/api/auto-sniping/safety-monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "trigger_emergency_response",
            reason,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to trigger emergency response`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to trigger emergency response");
        }

        // Refresh data after emergency response
        await loadSafetyReport();
        return result.data.actions || [];
      } catch (err: any) {
        console.error("[RealTimeSafetyMonitoring] Failed to trigger emergency:", err);
        setError(err.message || "Failed to trigger emergency response");
        return [];
      } finally {
        setIsTriggeringEmergency(false);
      }
    },
    [loadSafetyReport]
  );

  // Acknowledge alert
  const acknowledgeAlert = useCallback(
    async (alertId: string): Promise<boolean> => {
      try {
        setIsAcknowledgingAlert(true);
        setError(null);

        const response = await fetch("/api/auto-sniping/safety-monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "acknowledge_alert",
            alertId,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to acknowledge alert`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to acknowledge alert");
        }

        // Refresh data after acknowledgment
        await loadSafetyReport();
        return true;
      } catch (err: any) {
        console.error("[RealTimeSafetyMonitoring] Failed to acknowledge alert:", err);
        setError(err.message || "Failed to acknowledge alert");
        return false;
      } finally {
        setIsAcknowledgingAlert(false);
      }
    },
    [loadSafetyReport]
  );

  // Clear acknowledged alerts
  const clearAcknowledgedAlerts = useCallback(async (): Promise<number> => {
    try {
      setIsClearingAlerts(true);
      setError(null);

      const response = await fetch("/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_acknowledged_alerts" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to clear alerts`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to clear acknowledged alerts");
      }

      // Refresh data after clearing
      await loadSafetyReport();
      return result.data.clearedCount || 0;
    } catch (err: any) {
      console.error("[RealTimeSafetyMonitoring] Failed to clear alerts:", err);
      setError(err.message || "Failed to clear acknowledged alerts");
      return 0;
    } finally {
      setIsClearingAlerts(false);
    }
  }, [loadSafetyReport]);

  // Get risk metrics
  const getRiskMetrics = useCallback(async (): Promise<RiskMetrics | null> => {
    try {
      const response = await fetch("/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_risk_metrics" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to get risk metrics`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to get risk metrics");
      }

      setRiskMetrics(result.data);
      return result.data;
    } catch (err: any) {
      console.error("[RealTimeSafetyMonitoring] Failed to get risk metrics:", err);
      setError(err.message || "Failed to get risk metrics");
      return null;
    }
  }, []);

  // Check system safety
  const checkSystemSafety = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/auto-sniping/safety-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_system_safety" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to check system safety`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to check system safety");
      }

      return result.data.isSystemSafe || false;
    } catch (err: any) {
      console.error("[RealTimeSafetyMonitoring] Failed to check system safety:", err);
      setError(err.message || "Failed to check system safety");
      return false;
    }
  }, []);

  // Refresh data
  const refreshData = useCallback(async () => {
    await loadSafetyReport();
  }, [loadSafetyReport]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const scheduleRefresh = () => {
        refreshTimeoutRef.current = setTimeout(async () => {
          if (mountedRef.current) {
            await loadSafetyReport();
            scheduleRefresh();
          }
        }, refreshInterval);
      };

      scheduleRefresh();

      return () => {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
      };
    }
    return undefined;
  }, [autoRefresh, refreshInterval, loadSafetyReport]);

  // Initial load
  useEffect(() => {
    if (loadOnMount) {
      loadSafetyReport();
    }
  }, [loadOnMount, loadSafetyReport]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    report,
    riskMetrics,
    activeAlerts,
    recentActions,
    safetyStatus,
    overallRiskScore,
    alertsCount,
    criticalAlertsCount,
    systemHealthScore,
    monitoringActive,
    isLoading,
    isStartingMonitoring,
    isStoppingMonitoring,
    isUpdatingConfig,
    isTriggeringEmergency,
    isAcknowledgingAlert,
    isClearingAlerts,
    error,
    lastUpdated,

    // Actions
    startMonitoring,
    stopMonitoring,
    updateConfiguration,
    triggerEmergencyResponse,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    refreshData,
    getRiskMetrics,
    checkSystemSafety,
    clearError,
  };
}
