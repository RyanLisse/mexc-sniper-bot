/**
 * useConfigValidation Hook
 *
 * React hook for managing MEXC configuration validation state and API interactions.
 * Provides real-time system readiness status for auto-sniping functionality.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiClient } from "@/src/lib/api-client";
import { createSafeLogger } from "../lib/structured-logger";
import type {
  ConfigValidationResult,
  SystemReadinessReport,
} from "../services/mexc-config-validator";

interface ConfigValidationState {
  // System readiness
  readinessReport: SystemReadinessReport | null;

  // Loading states
  isLoading: boolean;
  isValidating: boolean;

  // Error handling
  error: string | null;

  // Last update timestamp
  lastUpdated: string | null;

  // Individual validation results
  validationResults: ConfigValidationResult[];

  // Quick health status
  healthStatus: {
    healthy: boolean;
    score: number;
    issues: string[];
  } | null;
}

interface ConfigValidationActions {
  // Main validation functions
  generateReadinessReport: () => Promise<void>;
  validateComponent: (component: string) => Promise<ConfigValidationResult | null>;
  runHealthCheck: () => Promise<void>;

  // Utility functions
  refreshValidation: () => Promise<void>;
  clearError: () => void;

  // Auto-refresh control
  startAutoRefresh: (intervalMs?: number) => void;
  stopAutoRefresh: () => void;
}

interface UseConfigValidationOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  loadOnMount?: boolean;
}

const logger = createSafeLogger("use-config-validation");

export function useConfigValidation(
  options: UseConfigValidationOptions = {}
): ConfigValidationState & ConfigValidationActions {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    loadOnMount = true,
  } = options;

  // State management
  const [state, setState] = useState<ConfigValidationState>({
    readinessReport: null,
    isLoading: false,
    isValidating: false,
    error: null,
    lastUpdated: null,
    validationResults: [],
    healthStatus: null,
  });

  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Clear error state
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Generate comprehensive system readiness report
  const generateReadinessReport = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await ApiClient.get<{
        data: SystemReadinessReport;
        message: string;
      }>("/api/auto-sniping/config-validation");

      setState((prev) => ({
        ...prev,
        readinessReport: response.data,
        validationResults: response.data.validationResults,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error("[useConfigValidation] Failed to generate readiness report:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to generate readiness report",
      }));
    }
  }, []);

  // Validate specific component
  const validateComponent = useCallback(
    async (component: string): Promise<ConfigValidationResult | null> => {
      setState((prev) => ({ ...prev, isValidating: true, error: null }));

      try {
        const response = await ApiClient.post<{
          data: ConfigValidationResult;
          message: string;
        }>("/api/auto-sniping/config-validation", {
          action: "validate_component",
          component,
        });

        const validationResult = response.data;

        // Update the specific validation result in state
        setState((prev) => ({
          ...prev,
          validationResults: prev.validationResults.map((result) =>
            result.component === validationResult.component ? validationResult : result
          ),
          isValidating: false,
          lastUpdated: new Date().toISOString(),
        }));

        return validationResult;
      } catch (error) {
        logger.error(`[useConfigValidation] Failed to validate ${component}:`, error);
        setState((prev) => ({
          ...prev,
          isValidating: false,
          error: error instanceof Error ? error.message : `Failed to validate ${component}`,
        }));
        return null;
      }
    },
    []
  );

  // Run quick health check
  const runHealthCheck = useCallback(async () => {
    setState((prev) => ({ ...prev, isValidating: true, error: null }));

    try {
      const response = await ApiClient.post<{
        data: {
          healthy: boolean;
          score: number;
          issues: string[];
        };
        message: string;
      }>("/api/auto-sniping/config-validation", {
        action: "health_check",
      });

      setState((prev) => ({
        ...prev,
        healthStatus: response.data,
        isValidating: false,
        lastUpdated: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error("[useConfigValidation] Health check failed:", error);
      setState((prev) => ({
        ...prev,
        isValidating: false,
        error: error instanceof Error ? error.message : "Health check failed",
      }));
    }
  }, []);

  // Refresh validation (alias for generateReadinessReport)
  const refreshValidation = useCallback(async () => {
    await generateReadinessReport();
  }, [generateReadinessReport]);

  // Start auto-refresh
  const startAutoRefresh = useCallback(
    (intervalMs = refreshInterval) => {
      // Clear existing interval
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }

      const interval = setInterval(() => {
        runHealthCheck(); // Use quick health check for auto-refresh
      }, intervalMs);

      setAutoRefreshInterval(interval);
    },
    [autoRefreshInterval, refreshInterval, runHealthCheck]
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
      generateReadinessReport();
    }
  }, [loadOnMount, generateReadinessReport]);

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
    generateReadinessReport,
    validateComponent,
    runHealthCheck,
    refreshValidation,
    clearError,
    startAutoRefresh,
    stopAutoRefresh,
  };
}

// Utility hooks for specific use cases

/**
 * Hook for monitoring system health with auto-refresh
 */
export function useSystemHealth(refreshInterval = 30000) {
  return useConfigValidation({
    autoRefresh: true,
    refreshInterval,
    loadOnMount: true,
  });
}

/**
 * Hook for one-time validation checks
 */
export function useValidationCheck() {
  return useConfigValidation({
    autoRefresh: false,
    loadOnMount: false,
  });
}

export default useConfigValidation;
