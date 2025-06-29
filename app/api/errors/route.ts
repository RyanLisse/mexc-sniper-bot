/**
 * Error Reporting API Endpoint
 * 
 * Handles client-side error reporting and provides error metadata
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApplicationError, isApplicationError } from "@/src/lib/errors";

// Error reporting schema
const ErrorReportSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  url: z.string().optional(),
  line: z.number().optional(),
  column: z.number().optional(),
  userAgent: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * POST /api/errors
 * Report client-side errors
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const errorData = ErrorReportSchema.parse(body);

    // Log error for monitoring
    console.error("[ClientError]", {
      message: errorData.message,
      url: errorData.url,
      line: errorData.line,
      column: errorData.column,
      userAgent: errorData.userAgent,
      userId: errorData.userId,
      sessionId: errorData.sessionId,
      timestamp: errorData.timestamp || new Date().toISOString(),
      metadata: errorData.metadata,
    });

    return NextResponse.json({
      success: true,
      message: "Error reported successfully",
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

  } catch (error) {
    console.error("[ErrorReporting] Failed to process error report:", error);
    
    return NextResponse.json({
      success: false,
      error: "Failed to process error report",
    }, { status: 400 });
  }
}

/**
 * GET /api/errors
 * Get error metadata and configuration
 */
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: {
        errorTypes: [
          "VALIDATION_ERROR",
          "AUTHENTICATION_ERROR", 
          "AUTHORIZATION_ERROR",
          "API_ERROR",
          "RATE_LIMIT_ERROR",
          "DATABASE_ERROR",
          "NOT_FOUND_ERROR",
          "CONFLICT_ERROR",
          "BUSINESS_LOGIC_ERROR",
          "TRADING_ERROR",
          "CONFIGURATION_ERROR",
          "TIMEOUT_ERROR",
          "NETWORK_ERROR",
        ],
        reportingEnabled: true,
        maxErrorsPerSession: 100,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("[ErrorMetadata] Failed to get error metadata:", error);
    
    return NextResponse.json({
      success: false,
      error: "Failed to retrieve error metadata",
    }, { status: 500 });
  }
}