/**
 * Pattern Monitoring API Route
 * 
 * Handles pattern monitoring operations including monitoring control,
 * status reporting, manual detection, and alert management.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLogger } from "@/src/lib/structured-logger";
import type { CalendarEntry, SymbolEntry } from "@/src/services/mexc-unified-exports";

// Lazy import to avoid build-time initialization issues
async function getPatternMonitoringService() {
  const { PatternMonitoringService } = await import("@/src/services/pattern-monitoring-service");
  return PatternMonitoringService.getInstance();
}

// Lazy logger initialization
function getLogger() {
  return createLogger("api-pattern-monitoring");
}

// Request validation schemas
const PostActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start_monitoring"),
  }),
  z.object({
    action: z.literal("stop_monitoring"),
  }),
  z.object({
    action: z.literal("manual_detection"),
    symbols: z.array(z.any()),
    calendarEntries: z.array(z.any()).optional(),
  }),
  z.object({
    action: z.literal("acknowledge_alert"),
    alertId: z.string(),
  }),
  z.object({
    action: z.literal("clear_acknowledged_alerts"),
  }),
]);

const GetQuerySchema = z.object({
  include_patterns: z.string().optional().default("true"),
  pattern_limit: z.string().optional().default("20"),
});

/**
 * GET handler - Get monitoring report and optional recent patterns
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = GetQuerySchema.parse({
      include_patterns: searchParams.get("include_patterns") || undefined,
      pattern_limit: searchParams.get("pattern_limit") || undefined,
    });

    const includePatterns = query.include_patterns === "true";
    const patternLimit = parseInt(query.pattern_limit);

    const logger = getLogger();
    logger.info("[GET] Getting pattern monitoring report", {
      includePatterns,
      patternLimit,
    });

    const monitoringService = await getPatternMonitoringService();
    
    // Get monitoring report
    const report = await monitoringService.getMonitoringReport();
    
    // Get recent patterns if requested
    let recentPatterns = undefined;
    if (includePatterns) {
      recentPatterns = monitoringService.getRecentPatterns(patternLimit);
    }

    // Get monitoring status
    const monitoringStatus = {
      isActive: monitoringService.isMonitoringActive,
      lastUpdate: report.lastUpdated,
      totalAlerts: report.activeAlerts.length,
      unacknowledgedAlerts: report.activeAlerts.filter(alert => !alert.acknowledged).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        report,
        recentPatterns,
        monitoring: monitoringStatus,
      },
      message: "Pattern monitoring report retrieved successfully",
    });

  } catch (error) {
    const logger = getLogger();
    logger.error("[GET] Failed to get pattern monitoring report:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get pattern monitoring report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Handle monitoring actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedBody = PostActionSchema.parse(body);

    const logger = getLogger();
    logger.info("[POST] Processing pattern monitoring action", {
      action: validatedBody.action,
    });

    const monitoringService = await getPatternMonitoringService();

    switch (validatedBody.action) {
      case "start_monitoring": {
        await monitoringService.startMonitoring();
        
        return NextResponse.json({
          success: true,
          data: { status: "monitoring_started" },
          message: "Pattern monitoring started successfully",
        });
      }

      case "stop_monitoring": {
        monitoringService.stopMonitoring();
        
        return NextResponse.json({
          success: true,
          data: { status: "monitoring_stopped" },
          message: "Pattern monitoring stopped successfully",
        });
      }

      case "manual_detection": {
        const { symbols, calendarEntries } = validatedBody;
        
        logger.info("[POST] Running manual pattern detection", {
          symbolCount: symbols.length,
          calendarEntriesCount: calendarEntries?.length || 0,
        });

        const patterns = await monitoringService.detectPatternsManually(
          symbols as SymbolEntry[],
          calendarEntries as CalendarEntry[]
        );

        // Generate summary statistics
        const summary = {
          totalPatterns: patterns.length,
          readyStatePatterns: patterns.filter(p => p.type === "ready_state").length,
          preReadyPatterns: patterns.filter(p => p.type === "pre_ready").length,
          advanceOpportunities: patterns.filter(p => p.type === "advance_opportunity").length,
          averageConfidence: patterns.length > 0 
            ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length 
            : 0,
        };

        return NextResponse.json({
          success: true,
          data: {
            patterns,
            summary,
          },
          message: `Manual detection completed: ${patterns.length} patterns found`,
        });
      }

      case "acknowledge_alert": {
        const { alertId } = validatedBody;
        
        const acknowledged = monitoringService.acknowledgeAlert(alertId);
        
        if (!acknowledged) {
          return NextResponse.json(
            {
              success: false,
              error: "Alert not found",
              details: `Alert with ID ${alertId} not found`,
            },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: { alertId, acknowledged: true },
          message: "Alert acknowledged successfully",
        });
      }

      case "clear_acknowledged_alerts": {
        const clearedCount = monitoringService.clearAcknowledgedAlerts();
        
        return NextResponse.json({
          success: true,
          data: { clearedCount },
          message: `${clearedCount} acknowledged alerts cleared`,
        });
      }

      default: {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
            details: "Unknown action specified",
          },
          { status: 400 }
        );
      }
    }

  } catch (error) {
    const logger = getLogger();
    logger.error("[POST] Pattern monitoring action failed:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Pattern monitoring action failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}