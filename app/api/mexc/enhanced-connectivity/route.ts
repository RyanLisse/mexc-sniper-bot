/**
 * Enhanced MEXC Connectivity API Endpoint
 *
 * Advanced connectivity endpoint that leverages the enhanced credential validation,
 * health monitoring, and real-time monitoring services to provide comprehensive
 * credential and connection status information.
 */

import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { apiResponse, handleApiError } from "../../../../src/lib/api-response";
import { getGlobalCredentialValidator } from "../../../../src/services/enhanced-mexc-credential-validator";
import { getGlobalHealthMonitor } from "../../../../src/services/connection-health-monitor";
import { getGlobalRealTimeMonitor } from "../../../../src/services/real-time-credential-monitor";
import { getUserCredentials } from "../../../../src/services/user-credentials-service";
import { toSafeError } from "../../../../src/lib/error-type-utils";
interface EnhancedConnectivityResponse {
  // Core Status
  connected: boolean;
  hasCredentials: boolean;
  credentialsValid: boolean;
  canAuthenticate: boolean;
  isTestCredentials: boolean;
  
  // Credential Source Info
  credentialSource: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  
  // Connection Health
  connectionHealth: "excellent" | "good" | "fair" | "poor";
  connectionQuality: {
    score: number;
    status: string;
    reasons: string[];
    recommendations: string[];
  };
  
  // Performance Metrics
  metrics: {
    totalChecks: number;
    successRate: number;
    averageLatency: number;
    consecutiveFailures: number;
    uptime: number;
    responseTime?: number;
  };
  
  // Circuit Breaker Status
  circuitBreaker: {
    isOpen: boolean;
    failures: number;
    nextAttemptTime?: string;
    reason?: string;
  };
  
  // Alerts and Issues
  alerts: {
    count: number;
    latest?: string;
    severity: "none" | "info" | "warning" | "critical";
    recent: Array<{
      type: string;
      severity: string;
      message: string;
      timestamp: string;
    }>;
  };
  
  // Recommendations
  recommendedActions: string[];
  
  // Status Details
  error?: string;
  message: string;
  status: "fully_connected" | "credentials_invalid" | "test_credentials" | "no_credentials" | "network_error" | "error";
  timestamp: string;
  lastChecked: string;
  nextCheckIn: number;
  
  // Trends and Analysis
  trends: {
    period: string;
    healthTrend: "improving" | "stable" | "degrading";
    averageUptime: number;
    statusChanges: number;
    mostCommonIssue?: string;
  };
  
  // System Status
  monitoring: {
    isActive: boolean;
    intervalMs: number;
    totalStatusUpdates: number;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = `enhanced_conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();

  try {
    // Get authentication context
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    const userId = user?.id;

    // Initialize services
    const credentialValidator = getGlobalCredentialValidator();
    const healthMonitor = getGlobalHealthMonitor();
    const realTimeMonitor = getGlobalRealTimeMonitor();

    // Start monitoring if not already started
    if (!realTimeMonitor.getMonitoringStatus().isActive) {
      await realTimeMonitor.start();
    }

    // Get comprehensive credential and connection status
    const [
      validationResult,
      healthMetrics,
      connectionQuality,
      circuitBreakerStatus,
      realTimeStatus,
      userCredentialInfo
    ] = await Promise.allSettled([
      credentialValidator.validateCredentials(),
      healthMonitor.getHealthMetrics(),
      healthMonitor.getConnectionQuality(),
      credentialValidator.getCircuitBreakerStatus(),
      realTimeMonitor.getCurrentStatus() || realTimeMonitor.checkStatus(),
      getUserCredentialInfo(userId)
    ]);

    // Extract results (handle any failures gracefully)
    const validation = validationResult.status === "fulfilled" ? validationResult.value : getDefaultValidation();
    const metrics = healthMetrics.status === "fulfilled" ? healthMetrics.value : getDefaultMetrics();
    const quality = connectionQuality.status === "fulfilled" ? connectionQuality.value : getDefaultQuality();
    const circuitBreaker = circuitBreakerStatus.status === "fulfilled" ? circuitBreakerStatus.value : getDefaultCircuitBreaker();
    const rtStatus = realTimeStatus.status === "fulfilled" ? realTimeStatus.value : null;
    const userCreds = userCredentialInfo.status === "fulfilled" ? userCredentialInfo.value : { hasUserCredentials: false, hasEnvironmentCredentials: false };

    // Get recent alerts
    const recentAlerts = healthMonitor.getRecentAlerts(1).slice(0, 5).map(alert => ({
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp.toISOString(),
    }));

    // Get trends and analysis
    const statusSummary = realTimeMonitor.getStatusSummary(24);
    const recommendedActions = realTimeMonitor.getRecommendedActions();
    const monitoringStatus = realTimeMonitor.getMonitoringStatus();

    // Determine overall status
    const overallStatus = determineOverallStatus(validation, metrics, quality);
    const statusMessage = generateStatusMessage(validation, overallStatus);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Build comprehensive response
    const response: EnhancedConnectivityResponse = {
      // Core Status  
      // FIXED: Allow connection even with test credentials for demo mode - auto-sniping always enabled
      connected: validation.hasCredentials && validation.canAuthenticate,
      hasCredentials: validation.hasCredentials,
      credentialsValid: validation.isValid,
      canAuthenticate: validation.canAuthenticate,
      isTestCredentials: validation.isTestCredentials,
      
      // Credential Source Info
      credentialSource: validation.source,
      hasUserCredentials: userCreds.hasUserCredentials,
      hasEnvironmentCredentials: userCreds.hasEnvironmentCredentials,
      
      // Connection Health
      connectionHealth: quality.status,
      connectionQuality: {
        score: quality.score,
        status: quality.status,
        reasons: quality.reasons,
        recommendations: quality.recommendations,
      },
      
      // Performance Metrics
      metrics: {
        totalChecks: metrics.totalChecks,
        successRate: metrics.successRate,
        averageLatency: metrics.averageLatency,
        consecutiveFailures: metrics.consecutiveFailures,
        uptime: metrics.uptime,
        responseTime: (validation as any).responseTime || responseTime,
      },
      
      // Circuit Breaker Status
      circuitBreaker: {
        isOpen: circuitBreaker.isOpen,
        failures: circuitBreaker.failures,
        nextAttemptTime: (circuitBreaker as any).nextAttemptTime?.toISOString(),
        reason: (circuitBreaker as any).reason,
      },
      
      // Alerts and Issues
      alerts: {
        count: recentAlerts.length,
        latest: recentAlerts[0]?.message,
        severity: rtStatus?.alerts?.severity || (recentAlerts.length > 0 ? recentAlerts[0].severity as any : "none"),
        recent: recentAlerts,
      },
      
      // Recommendations
      recommendedActions,
      
      // Status Details
      error: validation.error,
      message: statusMessage,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      lastChecked: rtStatus?.lastChecked?.toISOString() || new Date().toISOString(),
      nextCheckIn: rtStatus?.nextCheckIn || 30000,
      
      // Trends and Analysis
      trends: {
        period: "last_24_hours",
        healthTrend: statusSummary.healthTrend,
        averageUptime: statusSummary.averageUptime,
        statusChanges: statusSummary.statusChanges,
        mostCommonIssue: statusSummary.mostCommonIssue,
      },
      
      // System Status
      monitoring: {
        isActive: monitoringStatus.isActive,
        intervalMs: monitoringStatus.intervalMs,
        totalStatusUpdates: monitoringStatus.totalStatusUpdates,
      },
    };

    return apiResponse({
      success: true,
      data: response,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        responseTime,
      },
    });

  } catch (error) {
    console.error("[Enhanced Connectivity] Error:", { error: error });
    const safeError = toSafeError(error);
    
    return apiResponse.error(
      safeError.message || "Enhanced connectivity check failed",
      500,
      {
        requestId,
        responseTime: Date.now() - startTime,
      }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getUserCredentialInfo(userId?: string): Promise<{
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
}> {
  let hasUserCredentials = false;
  
  if (userId) {
    try {
      const userCredentials = await getUserCredentials(userId, 'mexc');
      hasUserCredentials = !!userCredentials;
    } catch (error) {
      // Ignore credential fetch errors for this status check
      console.warn("Failed to fetch user credentials for status check:", { error: error });
    }
  }
  
  const hasEnvironmentCredentials = !!(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY);
  
  return { hasUserCredentials, hasEnvironmentCredentials };
}

function determineOverallStatus(
  validation: any,
  metrics: any,
  quality: any
): EnhancedConnectivityResponse["status"] {
  if (!validation.hasCredentials) {
    return "no_credentials";
  }
  
  if (validation.isTestCredentials) {
    return "test_credentials";
  }
  
  if (!validation.isValid || !validation.canAuthenticate) {
    return "credentials_invalid";
  }
  
  if (quality.status === "poor" || metrics.consecutiveFailures > 5) {
    return "network_error";
  }
  
  if (validation.error) {
    return "error";
  }
  
  return "fully_connected";
}

function generateStatusMessage(validation: any, status: string): string {
  switch (status) {
    case "fully_connected":
      return "MEXC API fully connected with valid credentials";
    case "test_credentials":
      return "Demo mode active with test credentials - auto-sniping enabled for demonstration";
    case "credentials_invalid":
      return `Invalid credentials: ${validation.error || "Authentication failed"}`;
    case "no_credentials":
      return "No MEXC API credentials configured";
    case "network_error":
      return "Network connectivity issues detected";
    case "error":
      return `Connection error: ${validation.error || "Unknown error"}`;
    default:
      return "Unknown connection status";
  }
}

// Default fallback values for failed service calls
function getDefaultValidation() {
  return {
    hasCredentials: false,
    isValid: false,
    source: "none" as const,
    isTestCredentials: false,
    canAuthenticate: false,
    error: "Service unavailable",
  };
}

function getDefaultMetrics() {
  return {
    totalChecks: 0,
    successRate: 0,
    averageLatency: 0,
    consecutiveFailures: 0,
    uptime: 0,
  };
}

function getDefaultQuality() {
  return {
    score: 0,
    status: "poor" as const,
    reasons: ["Service unavailable"],
    recommendations: ["Check system status"],
  };
}

function getDefaultCircuitBreaker() {
  return {
    isOpen: false,
    failures: 0,
  };
}

// POST endpoint for manual credential testing
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = `enhanced_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { testCredentials, resetCircuitBreaker, forceRefresh } = body;

    const credentialValidator = getGlobalCredentialValidator();
    const realTimeMonitor = getGlobalRealTimeMonitor();

    // Handle different POST actions
    if (resetCircuitBreaker) {
      credentialValidator.reset();
      return apiResponse({
        success: true,
        message: "Circuit breaker reset successfully",
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }

    if (forceRefresh) {
      const status = await realTimeMonitor.refresh();
      return apiResponse({
        success: true,
        data: status,
        message: "Status refreshed successfully",
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }

    if (testCredentials) {
      // Perform credential test with provided credentials
      const testResult = await credentialValidator.testAuthentication();
      
      return apiResponse({
        success: testResult.canAuthenticate,
        data: testResult,
        message: testResult.canAuthenticate 
          ? "Credentials test successful" 
          : `Credentials test failed: ${testResult.error}`,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          responseTime: testResult.responseTime,
        },
      });
    }

    return apiResponse({
      success: false,
      error: "Invalid request - specify testCredentials, resetCircuitBreaker, or forceRefresh",
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    });

  } catch (error) {
    console.error("[Enhanced Connectivity POST] Error:", { error: error });
    return apiResponse.error(
      error instanceof Error ? error.message : "Enhanced connectivity action failed",
      500,
      {
        requestId,
        responseTime: Date.now() - startTime,
      }
    );
  }
}