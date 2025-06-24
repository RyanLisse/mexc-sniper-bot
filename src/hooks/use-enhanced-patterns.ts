"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createLogger } from "../lib/structured-logger";

// ======================
// Types
// ======================

export interface EnhancedPatternData {
  symbolName: string;
  vcoinId: string;
  confidence: number;
  aiEnhancedConfidence?: number;
  patternType: "ready_state" | "pre_ready" | "emerging";
  detectionTime: string;
  advanceHours?: number;
  aiInsights?: {
    cohereEmbedding?: number[];
    perplexityInsights?: {
      sentiment: string;
      marketAnalysis: string;
      riskFactors: string[];
      opportunities: string[];
      confidence: number;
      researchTimestamp: number;
    };
    recommendations?: string[];
    aiConfidence?: number;
    aiContext?: {
      enhancementType: "cohere" | "perplexity" | "combined";
      processingTime: number;
      confidenceBoost: number;
    };
  };
  activityData?: {
    volume24h?: number;
    priceChange24h?: number;
    marketCap?: number;
    tradingPairs?: number;
    activityScore?: number;
  };
  rawData?: {
    sts: number;
    st: number;
    tt: number;
  };
}

export interface EnhancedPatternsResponse {
  patterns: EnhancedPatternData[];
  summary: {
    totalPatterns: number;
    readyStatePatterns: number;
    aiEnhancedPatterns: number;
    averageConfidence: number;
    averageAdvanceHours: number;
  };
  aiServiceStatus: {
    cohereAvailable: boolean;
    perplexityAvailable: boolean;
    enhancementEnabled: boolean;
  };
  lastUpdated: string;
}

// ======================
// Query Keys
// ======================

const enhancedPatternsQueryKeys = {
  all: ["enhanced-patterns"] as const,
  list: (filters?: any) => [...enhancedPatternsQueryKeys.all, "list", filters] as const,
  detail: (vcoinId: string) => [...enhancedPatternsQueryKeys.all, "detail", vcoinId] as const,
  aiEnhanced: () => [...enhancedPatternsQueryKeys.all, "ai-enhanced"] as const,
};

// ======================
// Hooks
// ======================

/**
 * Hook to get AI-enhanced pattern detection data
 */
const logger = createLogger("use-enhanced-patterns");

export function useEnhancedPatterns(options?: {
  enableAI?: boolean;
  confidenceThreshold?: number;
  patternTypes?: string[];
  includeAdvanceDetection?: boolean;
}) {
  const {
    enableAI = true,
    confidenceThreshold = 70,
    patternTypes = ["ready_state", "pre_ready"],
    includeAdvanceDetection = true,
  } = options || {};

  return useQuery({
    queryKey: enhancedPatternsQueryKeys.list({
      enableAI,
      confidenceThreshold,
      patternTypes,
      includeAdvanceDetection,
    }),
    queryFn: async (): Promise<EnhancedPatternsResponse> => {
      const params = new URLSearchParams({
        action: "analyze",
        enableAgentAnalysis: enableAI.toString(),
        confidenceThreshold: confidenceThreshold.toString(),
        enableAdvanceDetection: includeAdvanceDetection.toString(),
        patternTypes: patternTypes.join(","),
      });

      const response = await fetch(`/api/pattern-detection?${params}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "analyze",
          enableAgentAnalysis: enableAI,
          confidenceThreshold,
          enableAdvanceDetection: includeAdvanceDetection,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch enhanced patterns");
      }

      // Transform the API response to match our interface
      return transformPatternResponse(result.data);
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to get AI-enhanced patterns for ready state detection
 */
export function useReadyStatePatterns() {
  return useEnhancedPatterns({
    enableAI: true,
    confidenceThreshold: 80,
    patternTypes: ["ready_state"],
    includeAdvanceDetection: true,
  });
}

/**
 * Hook to get pattern detection performance metrics
 */
export function usePatternDetectionMetrics() {
  return useQuery({
    queryKey: ["pattern-detection", "metrics"],
    queryFn: async () => {
      const response = await fetch("/api/pattern-detection?action=performance");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch pattern detection metrics");
      }

      return result.data;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
    retry: 2,
  });
}

/**
 * Hook to trigger pattern analysis manually
 */
export function usePatternAnalysisTrigger() {
  const queryClient = useQueryClient();

  const triggerAnalysis = async (options?: {
    symbols?: string[];
    vcoinId?: string;
    enableAI?: boolean;
  }) => {
    try {
      const response = await fetch("/api/triggers/pattern-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          directAnalysis: true,
          analysisType: "discovery",
          enableAgentAnalysis: options?.enableAI ?? true,
          symbols: options?.symbols || [],
          vcoinId: options?.vcoinId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to trigger pattern analysis");
      }

      // Invalidate and refetch pattern data
      if (queryClient) {
        await queryClient.invalidateQueries({ queryKey: enhancedPatternsQueryKeys.all });
      }

      return result.data;
    } catch (error) {
      logger.error("[Pattern Analysis Trigger] Error:", error);
      throw error;
    }
  };

  return { triggerAnalysis };
}

// ======================
// Utility Functions
// ======================

/**
 * Transform API response to match our interface
 */
function transformPatternResponse(apiData: any): EnhancedPatternsResponse {
  const patterns: EnhancedPatternData[] = [];
  let totalPatterns = 0;
  let readyStatePatterns = 0;
  let aiEnhancedPatterns = 0;
  let totalConfidence = 0;
  let totalAdvanceHours = 0;
  let advanceHourCount = 0;

  // Process pattern analysis results
  if (apiData.results?.patternAnalysis?.matches) {
    for (const match of apiData.results.patternAnalysis.matches) {
      const pattern: EnhancedPatternData = {
        symbolName: match.symbol || match.symbolName || "Unknown",
        vcoinId: match.vcoinId || match.symbol || "unknown",
        confidence: match.confidence || 0,
        patternType: match.patternType || "emerging",
        detectionTime: match.detectedAt || new Date().toISOString(),
        rawData: match.data,
      };

      // Add AI enhancement data if available
      if (match.aiEnhancement) {
        pattern.aiEnhancedConfidence = match.aiEnhancement.enhancedConfidence;
        pattern.aiInsights = {
          aiConfidence: match.aiEnhancement.enhancedConfidence,
          recommendations: match.aiEnhancement.recommendations,
          aiContext: {
            enhancementType: "combined",
            processingTime: match.aiEnhancement.processingTime || 0,
            confidenceBoost:
              (match.aiEnhancement.enhancedConfidence || 0) - (match.confidence || 0),
          },
        };
        aiEnhancedPatterns++;
      }

      // Add advance detection data
      if (match.advanceHours) {
        pattern.advanceHours = match.advanceHours;
        totalAdvanceHours += match.advanceHours;
        advanceHourCount++;
      }

      patterns.push(pattern);
      totalPatterns++;
      totalConfidence += pattern.aiEnhancedConfidence || pattern.confidence;

      if (pattern.patternType === "ready_state") {
        readyStatePatterns++;
      }
    }
  }

  return {
    patterns,
    summary: {
      totalPatterns,
      readyStatePatterns,
      aiEnhancedPatterns,
      averageConfidence: totalPatterns > 0 ? totalConfidence / totalPatterns : 0,
      averageAdvanceHours: advanceHourCount > 0 ? totalAdvanceHours / advanceHourCount : 0,
    },
    aiServiceStatus: {
      cohereAvailable: apiData.aiServiceStatus?.cohere || false,
      perplexityAvailable: apiData.aiServiceStatus?.perplexity || false,
      enhancementEnabled: apiData.enhancementEnabled || false,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get pattern confidence color for UI
 */
export function getPatternConfidenceColor(confidence: number) {
  if (confidence >= 85) return "green";
  if (confidence >= 70) return "yellow";
  return "red";
}

/**
 * Format advance hours for display
 */
export function formatAdvanceHours(hours: number) {
  if (hours >= 24) {
    return `${(hours / 24).toFixed(1)}d`;
  }
  return `${hours.toFixed(1)}h`;
}
