/**
 * Enhanced Metrics API Endpoint
 *
 * Phase 3 monitoring endpoint that provides comprehensive performance
 * and trading metrics with real-time data and alerting capabilities.
 */

import type { NextRequest } from "next/server";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
} from "@/src/lib/api-response";
import { enhancedPerformanceMonitor } from "@/src/lib/monitoring/enhanced-performance-monitor";
import { tradingMetricsCollector } from "@/src/lib/monitoring/trading-metrics-collector";

export interface MetricsResponse {
  timestamp: string;
  performance: {
    trading: any;
    system: any;
    alerts: any;
  };
  trading: {
    execution: any;
    profitability: any;
    risk: any;
    patterns: any;
  };
  realtime: any;
  health: {
    status: "healthy" | "degraded" | "unhealthy";
    issues: string[];
    score: number;
  };
}

/**
 * GET /api/monitoring/enhanced-metrics
 * Returns comprehensive system and trading metrics
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";
    const _includeHistory = url.searchParams.get("history") === "true";

    // Gather performance metrics
    const performanceReport = enhancedPerformanceMonitor.getPerformanceReport();
    const tradingPerformance =
      tradingMetricsCollector.getTradingPerformanceSummary();
    const realtimeMetrics = tradingMetricsCollector.getRealtimeMetrics();

    // Calculate health score
    const health = calculateSystemHealth(performanceReport, tradingPerformance);

    const metrics: MetricsResponse = {
      timestamp: new Date().toISOString(),
      performance: performanceReport,
      trading: tradingPerformance,
      realtime: realtimeMetrics,
      health,
    };

    // Return different formats based on request
    if (format === "csv") {
      const csvData = tradingMetricsCollector.exportMetrics("csv");
      return new Response(csvData, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="trading-metrics.csv"',
        },
      });
    }

    if (format === "prometheus") {
      const prometheusMetrics = formatPrometheusMetrics(metrics);
      return new Response(prometheusMetrics, {
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }

    return apiResponse(createSuccessResponse(metrics));
  } catch (error) {
    console.error("[Enhanced Metrics API] Error:", error);
    return apiResponse(
      createErrorResponse("Failed to retrieve enhanced metrics", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      500
    );
  }
}

/**
 * POST /api/monitoring/enhanced-metrics
 * Submit custom metrics or trigger manual metric collection
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case "record_trade":
        if (data?.symbol && data.executionTime !== undefined) {
          tradingMetricsCollector.recordTradeExecution(data);
          return apiResponse(createSuccessResponse({ recorded: true }));
        }
        break;

      case "record_pattern":
        if (data?.symbol && data.patternType && data.confidence !== undefined) {
          tradingMetricsCollector.recordPatternDetection(data);
          return apiResponse(createSuccessResponse({ recorded: true }));
        }
        break;

      case "update_pnl":
        if (data && data.pnl !== undefined && data.symbol) {
          tradingMetricsCollector.updatePnL(data.pnl, data.symbol);
          return apiResponse(createSuccessResponse({ updated: true }));
        }
        break;

      case "update_risk":
        if (data && data.exposure !== undefined) {
          tradingMetricsCollector.updateRiskExposure(data.exposure);
          return apiResponse(createSuccessResponse({ updated: true }));
        }
        break;

      default:
        return apiResponse(
          createErrorResponse("Invalid action", {
            validActions: [
              "record_trade",
              "record_pattern",
              "update_pnl",
              "update_risk",
            ],
          }),
          400
        );
    }

    return apiResponse(
      createErrorResponse("Missing required data for action", {
        action,
        requiredFields: getRequiredFields(action),
      }),
      400
    );
  } catch (error) {
    console.error("[Enhanced Metrics API] POST Error:", error);
    return apiResponse(
      createErrorResponse("Failed to process metrics submission", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      500
    );
  }
}

/**
 * Calculate overall system health based on metrics
 */
function calculateSystemHealth(
  performance: any,
  trading: any
): {
  status: "healthy" | "degraded" | "unhealthy";
  issues: string[];
  score: number;
} {
  const issues: string[] = [];
  let score = 100;

  // Check system performance
  if (performance.system.memoryUsageMB > 1024) {
    issues.push("High memory usage detected");
    score -= 20;
  }

  if (performance.alerts.active > 0) {
    issues.push(`${performance.alerts.active} active alerts`);
    score -= 10 * performance.alerts.active;
  }

  // Check trading performance
  if (trading.execution.successRate < 90) {
    issues.push("Low trade execution success rate");
    score -= 15;
  }

  if (trading.execution.averageExecutionTime > 1000) {
    issues.push("High trade execution latency");
    score -= 10;
  }

  if (trading.risk.currentExposure > 80) {
    issues.push("High risk exposure");
    score -= 25;
  }

  // Determine status
  let status: "healthy" | "degraded" | "unhealthy";
  if (score >= 80) {
    status = "healthy";
  } else if (score >= 60) {
    status = "degraded";
  } else {
    status = "unhealthy";
  }

  return {
    status,
    issues,
    score: Math.max(0, score),
  };
}

/**
 * Format metrics for Prometheus scraping
 */
function formatPrometheusMetrics(metrics: MetricsResponse): string {
  const timestamp = Date.now();

  return [
    `# HELP mexc_trading_total_trades Total number of trades`,
    `# TYPE mexc_trading_total_trades counter`,
    `mexc_trading_total_trades ${metrics.trading.execution.totalTrades} ${timestamp}`,
    ``,
    `# HELP mexc_trading_success_rate Trade execution success rate`,
    `# TYPE mexc_trading_success_rate gauge`,
    `mexc_trading_success_rate ${metrics.trading.execution.successRate} ${timestamp}`,
    ``,
    `# HELP mexc_trading_pnl Total profit and loss`,
    `# TYPE mexc_trading_pnl gauge`,
    `mexc_trading_pnl ${metrics.trading.profitability.totalPnL} ${timestamp}`,
    ``,
    `# HELP mexc_system_memory_mb Memory usage in megabytes`,
    `# TYPE mexc_system_memory_mb gauge`,
    `mexc_system_memory_mb ${metrics.performance.system.memoryUsageMB} ${timestamp}`,
    ``,
    `# HELP mexc_system_health_score Overall system health score`,
    `# TYPE mexc_system_health_score gauge`,
    `mexc_system_health_score ${metrics.health.score} ${timestamp}`,
    ``,
    `# HELP mexc_risk_exposure Current risk exposure percentage`,
    `# TYPE mexc_risk_exposure gauge`,
    `mexc_risk_exposure ${metrics.trading.risk.currentExposure} ${timestamp}`,
  ].join("\n");
}

/**
 * Get required fields for each action
 */
function getRequiredFields(action: string): string[] {
  switch (action) {
    case "record_trade":
      return [
        "symbol",
        "executionTime",
        "slippage",
        "fillRate",
        "success",
        "orderType",
        "side",
        "quantity",
        "price",
      ];
    case "record_pattern":
      return ["symbol", "patternType", "confidence", "processingTime"];
    case "update_pnl":
      return ["pnl", "symbol"];
    case "update_risk":
      return ["exposure"];
    default:
      return [];
  }
}
