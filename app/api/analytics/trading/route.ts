/**
 * Trading Analytics API Endpoint
 * 
 * Provides access to trading analytics, performance metrics, and structured logging data.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSafeLogger } from '../../../../src/lib/structured-logger';
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { tradingAnalytics } from "../../../../src/services/trading-analytics-service";
import { checkRateLimit, getClientIP } from "../../../../src/lib/rate-limiter";
import { z } from "zod";

// ============================================================================
// Request Validation Schemas
// ============================================================================

const AnalyticsQuerySchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  userId: z.string().optional(),
  eventType: z.enum([
    "TRADE_PLACED",
    "TRADE_FILLED", 
    "TRADE_CANCELLED",
    "TRADE_FAILED",
    "API_CALL",
    "BALANCE_UPDATE",
    "PATTERN_DETECTED",
    "RISK_ASSESSMENT",
    "CREDENTIAL_ROTATION",
    "SYSTEM_ERROR"
  ]).optional(),
  onlyErrors: z.boolean().optional(),
  format: z.enum(["json", "csv", "human-readable"]).optional(),
});

const LogEventSchema = z.object({
  eventType: z.enum([
    "TRADE_PLACED",
    "TRADE_FILLED", 
    "TRADE_CANCELLED",
    "TRADE_FAILED",
    "API_CALL",
    "BALANCE_UPDATE",
    "PATTERN_DETECTED",
    "RISK_ASSESSMENT",
    "CREDENTIAL_ROTATION",
    "SYSTEM_ERROR"
  ]),
  metadata: z.record(z.unknown()),
  performance: z.object({
    responseTimeMs: z.number(),
    retryCount: z.number().default(0),
    circuitBreakerState: z.string().optional(),
  }),
  success: z.boolean(),
  error: z.string().optional(),
});

// ============================================================================
// GET /api/analytics/trading
// Get trading analytics reports and metrics
// ============================================================================

const logger = createSafeLogger('route');

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(ip, "/api/analytics/trading", "general", userAgent);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    // Check authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          message: "You must be logged in to access trading analytics",
        },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      startTime: searchParams.get("startTime") || undefined,
      endTime: searchParams.get("endTime") || undefined,
      userId: searchParams.get("userId") || undefined,
      eventType: searchParams.get("eventType") || undefined,
      onlyErrors: searchParams.get("onlyErrors") === "true",
      format: searchParams.get("format") || "json",
    };

    const validatedParams = AnalyticsQuerySchema.parse(queryParams);

    // Parse dates if provided
    const startTime = validatedParams.startTime ? new Date(validatedParams.startTime) : undefined;
    const endTime = validatedParams.endTime ? new Date(validatedParams.endTime) : undefined;

    // Validate date range
    if (startTime && endTime && startTime >= endTime) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid date range",
          message: "Start time must be before end time",
        },
        { status: 400 }
      );
    }

    // Get the requested data type
    const action = searchParams.get("action") || "report";

    switch (action) {
      case "report":
        // Generate analytics report
        const report = tradingAnalytics.generateAnalyticsReport(
          startTime,
          endTime,
          {
            userId: validatedParams.userId,
            eventType: validatedParams.eventType,
            onlyErrors: validatedParams.onlyErrors,
          }
        );

        if (validatedParams.format && validatedParams.format !== "json") {
          // Export in requested format
          const exportedData = tradingAnalytics.exportAnalytics(
            validatedParams.format,
            {
              startTime,
              endTime,
              eventTypes: validatedParams.eventType ? [validatedParams.eventType] : undefined,
            }
          );

          const contentType = validatedParams.format === "csv" 
            ? "text/csv" 
            : "text/plain";

          return new Response(exportedData, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="trading-analytics-${Date.now()}.${validatedParams.format === "human-readable" ? "txt" : validatedParams.format}"`,
            },
          });
        }

        return NextResponse.json({
          success: true,
          data: report,
        });

      case "metrics":
        // Get performance metrics
        const operation = searchParams.get("operation") || undefined;
        const timeWindow = Number(searchParams.get("timeWindow")) || 300000; // 5 minutes default

        const metrics = tradingAnalytics.getPerformanceMetrics(operation, timeWindow);

        return NextResponse.json({
          success: true,
          data: {
            metrics,
            operation,
            timeWindow,
            timestamp: new Date().toISOString(),
          },
        });

      case "stats":
        // Get analytics statistics
        const stats = tradingAnalytics.getAnalyticsStats();

        return NextResponse.json({
          success: true,
          data: stats,
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
            message: `Action '${action}' is not supported`,
            supportedActions: ["report", "metrics", "stats"],
          },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error("[TradingAnalytics API] GET failed:", { error: error });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid parameters",
          message: "Request parameters are invalid",
          details: error.errors,
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "Failed to retrieve trading analytics data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/analytics/trading
// Log new trading events
// ============================================================================

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // Check rate limiting (more permissive for logging)
    const rateLimitResult = await checkRateLimit(ip, "/api/analytics/trading", "general", userAgent);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    // Check authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          message: "You must be logged in to log trading events",
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    
    // Handle single event or batch of events
    const events = Array.isArray(body.events) ? body.events : [body];

    const loggedEvents = [];
    const failedEvents = [];

    for (const eventData of events) {
      try {
        const validatedEvent = LogEventSchema.parse(eventData);
        
        // Add user ID to the event
        tradingAnalytics.logTradingEvent({
          ...validatedEvent,
          userId: user.id,
        });

        loggedEvents.push({
          eventType: validatedEvent.eventType,
          success: validatedEvent.success,
          timestamp: new Date().toISOString(),
        });

      } catch (error) {
        failedEvents.push({
          event: eventData,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: loggedEvents.length > 0,
      data: {
        loggedEvents: loggedEvents.length,
        failedEvents: failedEvents.length,
        details: {
          logged: loggedEvents,
          failed: failedEvents,
        },
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error("[TradingAnalytics API] POST failed:", { error: error });
    
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "Failed to log trading events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/analytics/trading
// Clear analytics data (admin only)
// ============================================================================

export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // Check rate limiting (stricter for delete operations)
    const rateLimitResult = await checkRateLimit(ip, "/api/analytics/trading", "authStrict", userAgent);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    // Check authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          message: "You must be logged in to clear analytics data",
        },
        { status: 401 }
      );
    }

    // Additional authorization check could be added here for admin users
    // For now, allow any authenticated user to clear their own analytics data

    const statsBeforeClear = tradingAnalytics.getAnalyticsStats();
    
    // Clear analytics data
    tradingAnalytics.clearAnalyticsData();

    logger.info(`[TradingAnalytics API] User ${user.id} cleared analytics data`);

    return NextResponse.json({
      success: true,
      data: {
        message: "Analytics data cleared successfully",
        statsBeforeClear,
        clearedBy: user.id,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error("[TradingAnalytics API] DELETE failed:", { error: error });
    
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "Failed to clear analytics data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}