/**
 * Connectivity Health Monitor Hook
 *
 * Provides continuous monitoring of network connectivity with health metrics,
 * automatic recovery mechanisms, and real-time status updates.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { type MexcConnectivityResult, useMexcConnectivity } from "./use-mexc-data";

interface ConnectivityHealthMetrics {
  isOnline: boolean;
  consecutiveFailures: number;
  lastSuccessfulPing: Date | null;
  averageLatency: number;
  connectionStability: "stable" | "unstable" | "poor" | "offline";
  recentLatencies: number[];
  healthScore: number; // 0-100
}

interface ConnectivityMonitorOptions {
  enableContinuousMonitoring?: boolean;
  pingInterval?: number; // milliseconds
  maxPingHistory?: number;
  autoRetryOnFailure?: boolean;
  notifyOnHealthChange?: boolean;
}

const DEFAULT_OPTIONS: Required<ConnectivityMonitorOptions> = {
  enableContinuousMonitoring: false,
  pingInterval: 30000, // 30 seconds
  maxPingHistory: 10,
  autoRetryOnFailure: true,
  notifyOnHealthChange: true,
};

export function useConnectivityMonitor(options: ConnectivityMonitorOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const queryClient = useQueryClient();
  const { data: connectivity, refetch, isLoading, error } = useMexcConnectivity();

  const [healthMetrics, setHealthMetrics] = useState<ConnectivityHealthMetrics>({
    isOnline: navigator.onLine,
    consecutiveFailures: 0,
    lastSuccessfulPing: null,
    averageLatency: 0,
    connectionStability: "stable",
    recentLatencies: [],
    healthScore: 100,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMonitoringRef = useRef(false);

  // Network connectivity change handler
  const handleOnlineStatusChange = useCallback(() => {
    const isOnline = navigator.onLine;
    setHealthMetrics((prev) => ({
      ...prev,
      isOnline,
      connectionStability: isOnline ? prev.connectionStability : "offline",
    }));

    if (isOnline && opts.autoRetryOnFailure) {
      // Retry connectivity check when back online
      setTimeout(() => {
        refetch();
      }, 1000);
    }
  }, [refetch, opts.autoRetryOnFailure]);

  // Update health metrics based on connectivity result
  const updateHealthMetrics = useCallback(
    (connectivityResult: MexcConnectivityResult | undefined) => {
      if (!connectivityResult) return;

      setHealthMetrics((prev) => {
        const newLatencies = connectivityResult.latency
          ? [...prev.recentLatencies, connectivityResult.latency].slice(-opts.maxPingHistory)
          : prev.recentLatencies;

        const averageLatency =
          newLatencies.length > 0
            ? newLatencies.reduce((sum, lat) => sum + lat, 0) / newLatencies.length
            : 0;

        const isSuccessful = connectivityResult.connected && connectivityResult.credentialsValid;
        const consecutiveFailures = isSuccessful ? 0 : prev.consecutiveFailures + 1;
        const lastSuccessfulPing = isSuccessful ? new Date() : prev.lastSuccessfulPing;

        // Calculate connection stability
        let connectionStability: ConnectivityHealthMetrics["connectionStability"] = "stable";
        if (!navigator.onLine) {
          connectionStability = "offline";
        } else if (consecutiveFailures >= 3) {
          connectionStability = "poor";
        } else if (consecutiveFailures >= 1 || averageLatency > 3000) {
          connectionStability = "unstable";
        }

        // Calculate health score (0-100)
        let healthScore = 100;
        if (consecutiveFailures > 0) {
          healthScore -= consecutiveFailures * 20;
        }
        if (averageLatency > 1000) {
          healthScore -= Math.min(30, (averageLatency - 1000) / 100);
        }
        if (connectivityResult.retryCount && connectivityResult.retryCount > 0) {
          healthScore -= connectivityResult.retryCount * 10;
        }
        healthScore = Math.max(0, Math.min(100, healthScore));

        return {
          isOnline: navigator.onLine,
          consecutiveFailures,
          lastSuccessfulPing,
          averageLatency,
          connectionStability,
          recentLatencies: newLatencies,
          healthScore,
        };
      });
    },
    [opts.maxPingHistory]
  );

  // Ping function for continuous monitoring
  const performHealthCheck = useCallback(async () => {
    try {
      const result = await refetch();
      if (result.data) {
        updateHealthMetrics(result.data);
      }
    } catch (error) {
      console.warn("Health check failed:", error);
      setHealthMetrics((prev) => ({
        ...prev,
        consecutiveFailures: prev.consecutiveFailures + 1,
        connectionStability: prev.consecutiveFailures >= 2 ? "poor" : "unstable",
      }));
    }
  }, [refetch, updateHealthMetrics]);

  // Start continuous monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoringRef.current || !opts.enableContinuousMonitoring) return;

    isMonitoringRef.current = true;
    intervalRef.current = setInterval(performHealthCheck, opts.pingInterval);
    console.info("Connectivity monitoring started");
  }, [performHealthCheck, opts.enableContinuousMonitoring, opts.pingInterval]);

  // Stop continuous monitoring
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isMonitoringRef.current = false;
    console.info("Connectivity monitoring stopped");
  }, []);

  // Manual refresh with health update
  const refreshWithHealthCheck = useCallback(async () => {
    const result = await refetch();
    if (result.data) {
      updateHealthMetrics(result.data);
    }
    return result;
  }, [refetch, updateHealthMetrics]);

  // Reset health metrics
  const resetHealthMetrics = useCallback(() => {
    setHealthMetrics({
      isOnline: navigator.onLine,
      consecutiveFailures: 0,
      lastSuccessfulPing: null,
      averageLatency: 0,
      connectionStability: "stable",
      recentLatencies: [],
      healthScore: 100,
    });
  }, []);

  // Setup event listeners and monitoring
  useEffect(() => {
    // Listen for online/offline events
    window.addEventListener("online", handleOnlineStatusChange);
    window.addEventListener("offline", handleOnlineStatusChange);

    // Start monitoring if enabled
    if (opts.enableContinuousMonitoring) {
      startMonitoring();
    }

    return () => {
      window.removeEventListener("online", handleOnlineStatusChange);
      window.removeEventListener("offline", handleOnlineStatusChange);
      stopMonitoring();
    };
  }, [handleOnlineStatusChange, startMonitoring, stopMonitoring, opts.enableContinuousMonitoring]);

  // Update health metrics when connectivity data changes
  useEffect(() => {
    if (connectivity) {
      updateHealthMetrics(connectivity);
    }
  }, [connectivity, updateHealthMetrics]);

  return {
    // Connectivity data
    connectivity,
    isLoading,
    error,

    // Health metrics
    healthMetrics,

    // Control functions
    refresh: refreshWithHealthCheck,
    startMonitoring,
    stopMonitoring,
    resetHealthMetrics,

    // Computed states
    isHealthy: healthMetrics.healthScore >= 70,
    isMonitoring: isMonitoringRef.current,
    needsAttention:
      healthMetrics.consecutiveFailures > 0 || healthMetrics.connectionStability === "poor",
  };
}

export type { ConnectivityHealthMetrics, ConnectivityMonitorOptions };
