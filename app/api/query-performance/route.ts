import type { NextRequest } from "next/server";
import {
  apiResponse,
  createOperationResponse,
  handleApiError,
} from "@/src/lib/api-response";
// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import { queryPerformanceMonitor } from "@/src/services/query-performance-monitor";

type LogContext = string | number | boolean | object | undefined;

export async function GET(request: NextRequest) {
  // Simple console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: LogContext) =>
      console.info("[query-performance]", message, context || ""),
    warn: (message: string, context?: LogContext) =>
      console.warn("[query-performance]", message, context || ""),
    error: (message: string, context?: LogContext) =>
      console.error("[query-performance]", message, context || ""),
    debug: (message: string, context?: LogContext) =>
      console.debug("[query-performance]", message, context || ""),
  };
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const timeframe = parseInt(searchParams.get("timeframe") || "60");

    switch (action) {
      case "stats": {
        const stats = queryPerformanceMonitor.getPerformanceStats();
        return apiResponse.success(stats, {
          operation: "get-stats",
          timeframe,
        });
      }

      case "patterns": {
        // Use getMetrics instead of analyzeQueryPatterns which doesn't exist
        const metrics = queryPerformanceMonitor.getMetrics();
        const patterns = {
          recentQueries: Array.isArray(metrics) ? metrics : [],
          slowQueries: [],
          queryTypes: {},
          timeframe: timeframe,
        };
        return apiResponse.success(patterns, {
          operation: "analyze-patterns",
          timeframe,
        });
      }

      case "recommendations": {
        const recommendations =
          queryPerformanceMonitor.getOptimizationRecommendations();
        return apiResponse.success(recommendations, {
          operation: "get-recommendations",
          timeframe,
        });
      }

      case "export": {
        const exportData = queryPerformanceMonitor.getMetrics(); // Use getMetrics instead of exportMetrics
        return apiResponse.success(exportData, {
          operation: "export-metrics",
          timeframe,
        });
      }
      default: {
        const status = queryPerformanceMonitor.getStatus();
        return apiResponse.success(status, { operation: "get-status" });
      }
    }
  } catch (error) {
    logger.error("❌ Error getting query performance data:", { error: error });
    return handleApiError(error, "Failed to get query performance data");
  }
}

export async function POST(request: NextRequest) {
  // Simple console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: LogContext) =>
      console.info("[query-performance]", message, context || ""),
    warn: (message: string, context?: LogContext) =>
      console.warn("[query-performance]", message, context || ""),
    error: (message: string, context?: LogContext) =>
      console.error("[query-performance]", message, context || ""),
    debug: (message: string, context?: LogContext) =>
      console.debug("[query-performance]", message, context || ""),
  };
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start": {
        queryPerformanceMonitor.startMonitoring();
        const startResult = createOperationResponse({
          success: true,
          operation: "start_monitoring",
          data: queryPerformanceMonitor.getStatus(),
        });
        return apiResponse(startResult);
      }

      case "stop": {
        queryPerformanceMonitor.stopMonitoring();
        const stopResult = createOperationResponse({
          success: true,
          operation: "stop_monitoring",
          data: queryPerformanceMonitor.getStatus(),
        });
        return apiResponse(stopResult);
      }

      case "clear": {
        queryPerformanceMonitor.clearMetrics();
        const clearResult = createOperationResponse({
          success: true,
          operation: "clear_metrics",
          data: queryPerformanceMonitor.getStatus(),
        });
        return apiResponse(clearResult);
      }

      default:
        return apiResponse.badRequest(
          "Invalid action. Use 'start', 'stop', or 'clear'"
        );
    }
  } catch (error) {
    logger.error("❌ Error controlling query performance monitor:", {
      error: error,
    });
    return handleApiError(error, "Failed to control query performance monitor");
  }
}
