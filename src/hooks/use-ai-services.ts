"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
// ======================
// Types
// ======================

export interface AIServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "error" | "unavailable";
  available: boolean;
  message: string;
  capabilities: string[];
  lastCheck: string;
  metrics?: {
    [key: string]: any;
  };
}

export interface AIServicesData {
  overall: {
    status: "healthy" | "degraded" | "critical";
    message: string;
    availableServices: number;
    totalServices: number;
  };
  services: {
    cohere: AIServiceStatus;
    perplexity: AIServiceStatus;
    openai: AIServiceStatus;
  };
  capabilities: {
    patternEmbedding: boolean;
    marketResearch: boolean;
    fallbackAnalysis: boolean;
  };
  lastUpdated: string;
}

// ======================
// Query Keys
// ======================

const aiServicesQueryKeys = {
  all: ["ai-services"] as const,
  status: () => [...aiServicesQueryKeys.all, "status"] as const,
  health: () => [...aiServicesQueryKeys.all, "health"] as const,
};

// ======================
// Hooks
// ======================

/**
 * Hook to get AI services status and health
 */
export function useAIServices() {
  return useQuery({
    queryKey: aiServicesQueryKeys.status(),
    queryFn: async (): Promise<AIServicesData> => {
      const response = await fetch("/api/ai-services/status");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch AI services status");
      }

      return result.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to get specific AI service status
 */
export function useAIServiceStatus(
  serviceName: "cohere" | "perplexity" | "openai"
) {
  const { data, isLoading, error } = useAIServices();

  return {
    data: data?.services[serviceName],
    isLoading,
    error,
    isAvailable: data?.services[serviceName]?.available || false,
    status: data?.services[serviceName]?.status || "unavailable",
  };
}

/**
 * Hook to get AI capabilities status
 */
export function useAICapabilities() {
  const { data, isLoading, error } = useAIServices();

  return {
    data: data?.capabilities,
    isLoading,
    error,
    patternEmbedding: data?.capabilities?.patternEmbedding || false,
    marketResearch: data?.capabilities?.marketResearch || false,
    fallbackAnalysis: data?.capabilities?.fallbackAnalysis || false,
    overallStatus: data?.overall?.status || "critical",
  };
}

/**
 * Hook to get AI services health summary
 */
export function useAIServicesHealth() {
  const { data, isLoading, error } = useAIServices();

  const healthSummary = data
    ? {
        isHealthy: data.overall.status === "healthy",
        isDegraded: data.overall.status === "degraded",
        isCritical: data.overall.status === "critical",
        availableServices: data.overall.availableServices,
        totalServices: data.overall.totalServices,
        healthPercentage:
          (data.overall.availableServices / data.overall.totalServices) * 100,
        message: data.overall.message,
        lastUpdated: data.lastUpdated,
      }
    : null;

  return {
    data: healthSummary,
    isLoading,
    error,
  };
}

/**
 * Hook to trigger AI service health check
 */
export function useAIServiceHealthCheck() {
  const queryClient = useQueryClient();

  const triggerHealthCheck = async () => {
    try {
      // Invalidate and refetch AI services data
      if (queryClient) {
        await queryClient.invalidateQueries({
          queryKey: aiServicesQueryKeys.all,
        });
        await queryClient.refetchQueries({
          queryKey: aiServicesQueryKeys.status(),
        });
      }
      return { success: true };
    } catch (error) {
      console.error("[AI Services] Health check failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  return { triggerHealthCheck };
}

// ======================
// Utility Functions
// ======================

/**
 * Get status color for UI components
 */
export function getAIServiceStatusColor(status: AIServiceStatus["status"]) {
  switch (status) {
    case "healthy":
      return "green";
    case "degraded":
      return "yellow";
    case "error":
      return "red";
    case "unavailable":
      return "gray";
    default:
      return "gray";
  }
}

/**
 * Get status icon for UI components
 */
export function getAIServiceStatusIcon(status: AIServiceStatus["status"]) {
  switch (status) {
    case "healthy":
      return "CheckCircle";
    case "degraded":
      return "AlertTriangle";
    case "error":
      return "XCircle";
    case "unavailable":
      return "Circle";
    default:
      return "Circle";
  }
}

/**
 * Format AI service capabilities for display
 */
export function formatAICapabilities(capabilities: string[]) {
  return capabilities.map((cap) =>
    cap.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
}
