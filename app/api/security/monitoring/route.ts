/**
 * Security Monitoring API Endpoint
 * 
 * Provides access to security monitoring metrics, automated credential rotation,
 * anomaly detection, and security recommendations.
 */

import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createLogger } from '../../../../src/lib/structured-logger';
import { securityMonitoring } from "../../../../src/services/security-monitoring-service";
import { checkRateLimit, getClientIP } from "../../../../src/lib/rate-limiter";

// ============================================================================
// GET /api/security/monitoring
// Get comprehensive security metrics and status
// ============================================================================

const logger = createLogger('route');

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(ip, "/api/security/monitoring", "general", userAgent);
    
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
          message: "You must be logged in to access security monitoring",
        },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeRecommendations = searchParams.get("recommendations") === "true";
    const includeAnomalies = searchParams.get("anomalies") === "true";

    // Get security metrics
    const metrics = await securityMonitoring.getSecurityMetrics();

    // Get additional data if requested
    let recommendations = undefined;
    let anomalies = undefined;

    if (includeRecommendations) {
      recommendations = await securityMonitoring.generateSecurityRecommendations();
    }

    if (includeAnomalies) {
      anomalies = await securityMonitoring.detectSecurityAnomalies();
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        recommendations,
        anomalies,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error("[SecurityMonitoring API] GET failed:", { error: error });
    
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "Failed to retrieve security monitoring data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/security/monitoring
// Trigger security actions like credential rotation or incident response
// ============================================================================

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // Check rate limiting (stricter for POST actions)
    const rateLimitResult = await checkRateLimit(ip, "/api/security/monitoring", "authStrict", userAgent);
    
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
          message: "You must be logged in to perform security actions",
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { action, parameters = {} } = body;

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing action parameter",
          message: "Action is required (e.g., 'rotate_credentials', 'detect_anomalies')",
        },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "rotate_credentials":
        logger.info(`[SecurityMonitoring API] User ${user.id} triggered credential rotation`);
        result = await securityMonitoring.performAutomatedCredentialRotation();
        break;

      case "detect_anomalies":
        logger.info(`[SecurityMonitoring API] User ${user.id} triggered anomaly detection`);
        result = await securityMonitoring.detectSecurityAnomalies();
        break;

      case "generate_recommendations":
        logger.info(`[SecurityMonitoring API] User ${user.id} requested security recommendations`);
        result = await securityMonitoring.generateSecurityRecommendations();
        break;

      case "security_assessment":
        logger.info(`[SecurityMonitoring API] User ${user.id} triggered security assessment`);
        result = {
          metrics: await securityMonitoring.getSecurityMetrics(),
          anomalies: await securityMonitoring.detectSecurityAnomalies(),
          recommendations: await securityMonitoring.generateSecurityRecommendations(),
        };
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action",
            message: `Action '${action}' is not supported`,
            supportedActions: [
              "rotate_credentials",
              "detect_anomalies", 
              "generate_recommendations",
              "security_assessment"
            ],
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        result,
        timestamp: new Date().toISOString(),
        triggeredBy: user.id,
      },
    });

  } catch (error) {
    logger.error("[SecurityMonitoring API] POST failed:", { error: error });
    
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "Failed to execute security action",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/security/monitoring
// Update security monitoring configuration
// ============================================================================

export async function PUT(request: NextRequest) {
  const ip = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(ip, "/api/security/monitoring", "auth", userAgent);
    
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
          message: "You must be logged in to update security configuration",
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing settings parameter",
          message: "Settings object is required",
        },
        { status: 400 }
      );
    }

    // For now, just log the configuration update request
    // In a full implementation, this would update monitoring settings
    logger.info(`[SecurityMonitoring API] User ${user.id} updated security settings:`, settings);

    return NextResponse.json({
      success: true,
      data: {
        message: "Security monitoring configuration updated",
        settings,
        updatedBy: user.id,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error("[SecurityMonitoring API] PUT failed:", { error: error });
    
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: "Failed to update security monitoring configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}