/**
 * Unified MEXC Status API Endpoint
 *
 * Single source of truth for MEXC API status that consolidates all status
 * information and eliminates contradictory reports.
 */

import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { apiResponse, handleApiError } from "@/src/lib/api-response";
import { getUnifiedStatus } from "@/src/services/notification/unified-status-resolver";
import { toSafeError } from "@/src/lib/error-type-utils";
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/src/lib/api-rate-limiter";
interface UnifiedStatusResponse {
  // Core Status
  connected: boolean;
  hasCredentials: boolean;
  credentialsValid: boolean;
  canTrade: boolean;

  // Credential Details
  credentialSource: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  isTestCredentials?: boolean;

  // Connection Quality
  connectionHealth?: "excellent" | "good" | "fair" | "poor";
  responseTime?: number;

  // Overall System Status
  overallStatus: "healthy" | "warning" | "error" | "loading";
  statusMessage: string;

  // Metadata
  lastChecked: string;
  source: "enhanced" | "legacy" | "fallback";
  error?: string;

  // Troubleshooting Info
  recommendations: string[];
  nextSteps: string[];
}

async function getHandler(request: NextRequest): Promise<NextResponse> {
  const requestId = `unified_status_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();

  try {
    // Get authentication context
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    const userId = user?.id;

    // Get unified status
    const unifiedStatus = await getUnifiedStatus();
    const responseTime = Date.now() - startTime;

    // Generate recommendations and next steps
    const recommendations = generateRecommendations(unifiedStatus);
    const nextSteps = generateNextSteps(unifiedStatus);

    // Build unified response
    const response: UnifiedStatusResponse = {
      // Core Status
      connected: unifiedStatus.network.connected,
      hasCredentials: unifiedStatus.credentials.hasCredentials,
      credentialsValid: unifiedStatus.credentials.isValid,
      canTrade: unifiedStatus.overall.canTrade,

      // Credential Details
      credentialSource: unifiedStatus.credentials.source,
      hasUserCredentials: unifiedStatus.credentials.hasUserCredentials,
      hasEnvironmentCredentials:
        unifiedStatus.credentials.hasEnvironmentCredentials,
      isTestCredentials: unifiedStatus.credentials.isTestCredentials,

      // Connection Quality
      connectionHealth: unifiedStatus.credentials.connectionHealth,
      responseTime: unifiedStatus.network.responseTime || responseTime,

      // Overall System Status
      overallStatus: unifiedStatus.overall.status,
      statusMessage: unifiedStatus.overall.message,

      // Metadata
      lastChecked: unifiedStatus.timestamp,
      source: unifiedStatus.source,
      error: unifiedStatus.credentials.error || unifiedStatus.network.error,

      // Troubleshooting Info
      recommendations,
      nextSteps,
    };

    return apiResponse({
      success: true,
      data: response,
      message: "Unified status retrieved successfully",
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        responseTime,
      },
    });
  } catch (error) {
    console.error("[Unified Status] Error:", { error: error });
    const safeError = toSafeError(error);

    return apiResponse.error(
      safeError.message || "Unified status check failed",
      500,
      {
        requestId,
        responseTime: Date.now() - startTime,
      },
    );
  }
}

/**
 * POST endpoint for forcing status refresh
 */
async function postHandler(request: NextRequest): Promise<NextResponse> {
  const requestId = `unified_refresh_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { forceRefresh } = body;

    if (forceRefresh) {
      // Force refresh the unified status
      const { refreshUnifiedStatus } = await import(
        "@/src/services/notification/unified-status-resolver"
      );
      const unifiedStatus = await refreshUnifiedStatus();

      const recommendations = generateRecommendations(unifiedStatus);
      const nextSteps = generateNextSteps(unifiedStatus);

      const response: UnifiedStatusResponse = {
        connected: unifiedStatus.network.connected,
        hasCredentials: unifiedStatus.credentials.hasCredentials,
        credentialsValid: unifiedStatus.credentials.isValid,
        canTrade: unifiedStatus.overall.canTrade,
        credentialSource: unifiedStatus.credentials.source,
        hasUserCredentials: unifiedStatus.credentials.hasUserCredentials,
        hasEnvironmentCredentials:
          unifiedStatus.credentials.hasEnvironmentCredentials,
        isTestCredentials: unifiedStatus.credentials.isTestCredentials,
        connectionHealth: unifiedStatus.credentials.connectionHealth,
        responseTime: Date.now() - startTime,
        overallStatus: unifiedStatus.overall.status,
        statusMessage: unifiedStatus.overall.message,
        lastChecked: unifiedStatus.timestamp,
        source: unifiedStatus.source,
        error: unifiedStatus.credentials.error || unifiedStatus.network.error,
        recommendations,
        nextSteps,
      };

      return apiResponse({
        success: true,
        data: response,
        message: "Status refreshed successfully",
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          responseTime: Date.now() - startTime,
        },
      });
    }

    return apiResponse({
      success: false,
      error: "Invalid request - specify forceRefresh: true",
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
  } catch (error) {
    console.error("[Unified Status POST] Error:", { error: error });
    return apiResponse.error(
      error instanceof Error ? error.message : "Unified status refresh failed",
      500,
      {
        requestId,
        responseTime: Date.now() - startTime,
      },
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateRecommendations(status: any): string[] {
  const recommendations: string[] = [];

  if (!status.network.connected) {
    recommendations.push("Check your internet connection");
    recommendations.push("Verify MEXC API is accessible from your location");
  }

  if (!status.credentials.hasCredentials) {
    recommendations.push(
      "Configure MEXC API credentials in your user settings",
    );
    recommendations.push("Ensure API keys have spot trading permissions");
  } else if (!status.credentials.isValid) {
    recommendations.push("Verify API credentials are correct");
    recommendations.push("Check API key permissions and restrictions");
    recommendations.push(
      "Ensure IP allowlist includes your current IP address",
    );
  }

  if (status.credentials.isTestCredentials) {
    recommendations.push("Replace test credentials with real MEXC API keys");
    recommendations.push("Create new API keys from MEXC exchange");
  }

  if (status.credentials.connectionHealth === "poor") {
    recommendations.push("Check network stability");
    recommendations.push("Consider using a VPN if connection is blocked");
  }

  if (recommendations.length === 0) {
    recommendations.push("System is operating normally");
  }

  return recommendations;
}

function generateNextSteps(status: any): string[] {
  const nextSteps: string[] = [];

  if (!status.network.connected) {
    nextSteps.push("1. Test internet connectivity");
    nextSteps.push("2. Try accessing mexc.com directly");
    nextSteps.push("3. Check firewall and proxy settings");
    return nextSteps;
  }

  if (!status.credentials.hasCredentials) {
    nextSteps.push("1. Go to Configuration page");
    nextSteps.push("2. Enter your MEXC API credentials");
    nextSteps.push("3. Test the connection");
    return nextSteps;
  }

  if (status.credentials.isTestCredentials) {
    nextSteps.push("1. Log into your MEXC account");
    nextSteps.push("2. Generate new API keys");
    nextSteps.push("3. Update your configuration");
    return nextSteps;
  }

  if (!status.credentials.isValid) {
    nextSteps.push("1. Verify API keys are correct");
    nextSteps.push("2. Check API permissions");
    nextSteps.push("3. Ensure IP allowlist is configured");
    return nextSteps;
  }

  if (status.overall.status === "healthy") {
    nextSteps.push("System is ready for trading");
  } else {
    nextSteps.push("Monitor system status for any changes");
  }

  return nextSteps;
}

// Export rate-limited handlers
export const GET = withRateLimit(getHandler, RATE_LIMIT_CONFIGS.moderate);
export const POST = withRateLimit(postHandler, RATE_LIMIT_CONFIGS.moderate);
