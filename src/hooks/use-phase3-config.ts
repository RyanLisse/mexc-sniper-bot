"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ======================
// Types
// ======================

export interface Phase3Configuration {
  aiIntelligence: {
    enabled: boolean;
    cohereEnabled: boolean;
    perplexityEnabled: boolean;
    openaiEnabled: boolean;
    confidenceThreshold: number;
    maxAIBoost: number;
  };
  patternDetection: {
    advanceDetectionEnabled: boolean;
    targetAdvanceHours: number;
    activityEnhancementEnabled: boolean;
    confidenceThreshold: number;
  };
  cacheWarming: {
    enabled: boolean;
    autoWarmingEnabled: boolean;
    warmingInterval: number;
    strategies: {
      mexcSymbols: boolean;
      patternData: boolean;
      activityData: boolean;
      calendarData: boolean;
    };
  };
  performance: {
    monitoringEnabled: boolean;
    alertsEnabled: boolean;
    metricsRetentionDays: number;
    performanceThresholds: {
      maxResponseTime: number;
      minHitRate: number;
      maxMemoryUsage: number;
    };
  };
}

export interface Phase3ConfigResponse {
  configuration: Phase3Configuration;
  lastUpdated: string;
  version: string;
  environment: string;
}

// ======================
// Query Keys
// ======================

const phase3ConfigQueryKeys = {
  all: ["phase3-config"] as const,
  config: () => [...phase3ConfigQueryKeys.all, "config"] as const,
};

// ======================
// Hooks
// ======================

/**
 * Hook to get Phase 3 configuration
 */
export function usePhase3Config() {
  return useQuery({
    queryKey: phase3ConfigQueryKeys.config(),
    queryFn: async (): Promise<Phase3ConfigResponse> => {
      const response = await fetch("/api/configuration/phase3");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error || "Failed to fetch Phase 3 configuration"
        );
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Don't auto-refetch config
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to update Phase 3 configuration
 */
export function usePhase3ConfigUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configuration: Phase3Configuration) => {
      const response = await fetch("/api/configuration/phase3", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ configuration }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error || "Failed to update Phase 3 configuration"
        );
      }

      return result.data;
    },
    onSuccess: () => {
      // Invalidate and refetch configuration after successful update
      queryClient.invalidateQueries({ queryKey: phase3ConfigQueryKeys.all });
    },
  });
}

/**
 * Hook to get specific configuration section
 */
export function usePhase3ConfigSection<T extends keyof Phase3Configuration>(
  section: T
): {
  data: Phase3Configuration[T] | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = usePhase3Config();

  return {
    data: data?.configuration[section],
    isLoading,
    error,
  };
}

/**
 * Hook to check if specific Phase 3 features are enabled
 */
export function usePhase3FeatureStatus() {
  const { data, isLoading, error } = usePhase3Config();

  const featureStatus = data
    ? {
        aiIntelligenceEnabled: data.configuration.aiIntelligence.enabled,
        cohereEnabled: data.configuration.aiIntelligence.cohereEnabled,
        perplexityEnabled: data.configuration.aiIntelligence.perplexityEnabled,
        advanceDetectionEnabled:
          data.configuration.patternDetection.advanceDetectionEnabled,
        cacheWarmingEnabled: data.configuration.cacheWarming.enabled,
        performanceMonitoringEnabled:
          data.configuration.performance.monitoringEnabled,
        targetAdvanceHours:
          data.configuration.patternDetection.targetAdvanceHours,
        aiConfidenceThreshold:
          data.configuration.aiIntelligence.confidenceThreshold,
        patternConfidenceThreshold:
          data.configuration.patternDetection.confidenceThreshold,
      }
    : undefined;

  return {
    data: featureStatus,
    isLoading,
    error,
  };
}

/**
 * Hook to validate configuration before saving
 */
export function usePhase3ConfigValidation() {
  const validateConfiguration = (
    config: Phase3Configuration
  ): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate AI Intelligence
    if (
      config.aiIntelligence.confidenceThreshold < 0 ||
      config.aiIntelligence.confidenceThreshold > 100
    ) {
      errors.push("AI confidence threshold must be between 0 and 100");
    }

    if (
      config.aiIntelligence.maxAIBoost < 0 ||
      config.aiIntelligence.maxAIBoost > 50
    ) {
      errors.push("Max AI boost must be between 0 and 50");
    }

    // Validate Pattern Detection
    if (
      config.patternDetection.targetAdvanceHours < 0 ||
      config.patternDetection.targetAdvanceHours > 24
    ) {
      errors.push("Target advance hours must be between 0 and 24");
    }

    if (
      config.patternDetection.confidenceThreshold < 0 ||
      config.patternDetection.confidenceThreshold > 100
    ) {
      errors.push("Pattern confidence threshold must be between 0 and 100");
    }

    // Validate Cache Warming
    if (
      config.cacheWarming.warmingInterval < 1 ||
      config.cacheWarming.warmingInterval > 1440
    ) {
      errors.push("Cache warming interval must be between 1 and 1440 minutes");
    }

    // Validate Performance
    if (
      config.performance.metricsRetentionDays < 1 ||
      config.performance.metricsRetentionDays > 90
    ) {
      errors.push("Metrics retention days must be between 1 and 90");
    }

    if (
      config.performance.performanceThresholds.maxResponseTime < 10 ||
      config.performance.performanceThresholds.maxResponseTime > 10000
    ) {
      errors.push("Max response time must be between 10 and 10000 ms");
    }

    if (
      config.performance.performanceThresholds.minHitRate < 0 ||
      config.performance.performanceThresholds.minHitRate > 100
    ) {
      errors.push("Min hit rate must be between 0 and 100%");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  return { validateConfiguration };
}

// ======================
// Utility Functions
// ======================

/**
 * Get default Phase 3 configuration
 */
export function getDefaultPhase3Config(): Phase3Configuration {
  return {
    aiIntelligence: {
      enabled: true,
      cohereEnabled: true,
      perplexityEnabled: true,
      openaiEnabled: false,
      confidenceThreshold: 70,
      maxAIBoost: 20,
    },
    patternDetection: {
      advanceDetectionEnabled: true,
      targetAdvanceHours: 3.5,
      activityEnhancementEnabled: true,
      confidenceThreshold: 70,
    },
    cacheWarming: {
      enabled: true,
      autoWarmingEnabled: true,
      warmingInterval: 30,
      strategies: {
        mexcSymbols: true,
        patternData: true,
        activityData: true,
        calendarData: true,
      },
    },
    performance: {
      monitoringEnabled: true,
      alertsEnabled: true,
      metricsRetentionDays: 7,
      performanceThresholds: {
        maxResponseTime: 100,
        minHitRate: 70,
        maxMemoryUsage: 500,
      },
    },
  };
}

/**
 * Check if configuration has changed from default
 */
export function hasConfigurationChanged(config: Phase3Configuration): boolean {
  const defaultConfig = getDefaultPhase3Config();
  return JSON.stringify(config) !== JSON.stringify(defaultConfig);
}
