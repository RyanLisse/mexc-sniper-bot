/**
 * Unified Status Resolver
 *
 * Single source of truth for MEXC API status that eliminates contradictory
 * status reporting by normalizing responses from multiple endpoints.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import { getUnifiedMexcService } from "@/src/services/api/unified-mexc-service-factory";
// Standardized Status Types
export interface UnifiedCredentialStatus {
  hasCredentials: boolean;
  isValid: boolean;
  source: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  lastValidated: string;
  error?: string;
  isTestCredentials?: boolean;
  connectionHealth?: "excellent" | "good" | "fair" | "poor";
  canAuthenticate?: boolean;
}

export interface UnifiedNetworkStatus {
  connected: boolean;
  lastChecked: string;
  error?: string;
  responseTime?: number;
}

export interface StatusResolutionResult {
  credentials: UnifiedCredentialStatus;
  network: UnifiedNetworkStatus;
  overall: {
    status: "healthy" | "warning" | "error" | "loading";
    message: string;
    canTrade: boolean;
  };
  source: "enhanced" | "legacy" | "fallback";
  timestamp: string;
}

export class UnifiedStatusResolver {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[unified-status-resolver]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[unified-status-resolver]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[unified-status-resolver]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[unified-status-resolver]", message, context || ""),
  };

  private lastKnownStatus: StatusResolutionResult | null = null;
  private isResolving = false;

  /**
   * Resolve API URL for both client and server environments
   */
  private resolveApiUrl(relativePath: string): string {
    // Check if we're in a browser environment
    if (typeof window !== "undefined" && window.location) {
      // Browser environment - relative URLs work fine
      return relativePath;
    }

    // Server environment - need to construct absolute URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    return new URL(relativePath, baseUrl).toString();
  }

  /**
   * Resolve unified status by attempting enhanced endpoint first,
   * then falling back to legacy with proper response normalization
   */
  async resolveStatus(): Promise<StatusResolutionResult> {
    if (this.isResolving) {
      // Return last known status if already resolving to prevent race conditions
      return this.lastKnownStatus || this.createFallbackStatus("Resolving status...");
    }

    this.isResolving = true;
    const timestamp = new Date().toISOString();

    try {
      // Try enhanced endpoint first
      const enhancedResult = await this.tryEnhancedEndpoint();
      if (enhancedResult) {
        this.lastKnownStatus = { ...enhancedResult, timestamp };
        return this.lastKnownStatus;
      }

      // Fall back to legacy endpoint
      const legacyResult = await this.tryLegacyEndpoint();
      if (legacyResult) {
        this.lastKnownStatus = { ...legacyResult, timestamp };
        return this.lastKnownStatus;
      }

      // Both failed - return error status
      return this.createFallbackStatus("All connectivity checks failed");
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("[UnifiedStatusResolver] Resolution failed:", safeError.message);
      return this.createFallbackStatus(`Status resolution error: ${safeError.message}`);
    } finally {
      this.isResolving = false;
    }
  }

  /**
   * Try direct service call to avoid HTTP overhead and connection issues during startup
   */
  private async tryDirectServiceCall(): Promise<StatusResolutionResult | null> {
    try {
      // Get unified MEXC service instance
      const mexcService = await getUnifiedMexcService();

      // Test connectivity directly
      const connectivityTest = await mexcService.testConnectivity();

      // Create status from direct service result
      const isConnected = connectivityTest.success;
      
      const credentials: UnifiedCredentialStatus = {
        hasCredentials: Boolean(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY),
        isValid: isConnected,
        source: "environment" as const,
        hasUserCredentials: false, // Would need database check for this
        hasEnvironmentCredentials: Boolean(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY),
        lastValidated: new Date().toISOString(),
        canAuthenticate: isConnected,
        connectionHealth: isConnected ? "good" : "poor",
      };

      const network: UnifiedNetworkStatus = {
        connected: isConnected,
        lastChecked: new Date().toISOString(),
      };

      return {
        credentials,
        network,
        overall: {
          status: isConnected ? "healthy" : "error",
          message: isConnected
            ? "Direct service connectivity successful"
            : "Direct service connectivity failed",
          canTrade: isConnected && credentials.hasCredentials,
        },
        source: "enhanced" as const,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.debug("[UnifiedStatusResolver] Direct service call failed:", error);
      return null;
    }
  }

  /**
   * Attempt to get status from enhanced connectivity endpoint
   */
  private async tryEnhancedEndpoint(): Promise<StatusResolutionResult | null> {
    try {
      // First try direct service call (avoids HTTP overhead and connection issues)
      try {
        const directResult = await this.tryDirectServiceCall();
        if (directResult) {
          return directResult;
        }
      } catch (directError) {
        console.debug(
          "[UnifiedStatusResolver] Direct service call failed, trying HTTP:",
          directError
        );
      }

      // Fallback to HTTP request only if direct call fails
      const url = this.resolveApiUrl("/api/mexc/enhanced-connectivity");
      const enhancedController = new AbortController();
      setTimeout(() => enhancedController.abort(), 2000);

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Add timeout to prevent hanging during startup
        signal: enhancedController.signal,
      });

      if (!response.ok) {
        console.warn("[UnifiedStatusResolver] Enhanced endpoint failed:", response.status);
        return null;
      }

      const data = await response.json();
      if (!data.success || !data.data) {
        console.warn("[UnifiedStatusResolver] Enhanced endpoint returned invalid data");
        return null;
      }

      return this.normalizeEnhancedResponse(data.data);
    } catch (error) {
      // Don't log connection refused as error - it's expected during startup
      if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
        console.debug("[UnifiedStatusResolver] Enhanced endpoint not available (startup)");
      } else {
        console.warn("[UnifiedStatusResolver] Enhanced endpoint error:", error);
      }
      return null;
    }
  }

  /**
   * Attempt to get status from legacy connectivity endpoint
   */
  private async tryLegacyEndpoint(): Promise<StatusResolutionResult | null> {
    try {
      const url = this.resolveApiUrl("/api/mexc/connectivity");
      const legacyController = new AbortController();
      setTimeout(() => legacyController.abort(), 2000);

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Add timeout to prevent hanging during startup
        signal: legacyController.signal,
      });

      if (!response.ok) {
        console.warn("[UnifiedStatusResolver] Legacy endpoint failed:", response.status);
        return null;
      }

      const data = await response.json();
      if (!data.success) {
        console.warn("[UnifiedStatusResolver] Legacy endpoint returned error:", data.error);
        return null;
      }

      return this.normalizeLegacyResponse(data.data);
    } catch (error) {
      // Don't log connection refused as error - it's expected during startup
      if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
        console.debug("[UnifiedStatusResolver] Legacy endpoint not available (startup)");
      } else {
        console.warn("[UnifiedStatusResolver] Legacy endpoint error:", error);
      }
      return null;
    }
  }

  /**
   * Normalize enhanced endpoint response to unified format
   */
  private normalizeEnhancedResponse(data: any): StatusResolutionResult {
    const credentials: UnifiedCredentialStatus = {
      hasCredentials: Boolean(data.hasCredentials),
      isValid: Boolean(data.credentialsValid),
      source: data.credentialSource || "none",
      hasUserCredentials: Boolean(data.hasUserCredentials),
      hasEnvironmentCredentials: Boolean(data.hasEnvironmentCredentials),
      lastValidated: new Date().toISOString(),
      error: data.error,
      isTestCredentials: Boolean(data.isTestCredentials),
      connectionHealth: data.connectionHealth,
      canAuthenticate: Boolean(data.canAuthenticate),
    };

    const network: UnifiedNetworkStatus = {
      connected: Boolean(data.connected),
      lastChecked: new Date().toISOString(),
      error: data.connected ? undefined : data.error || "Network disconnected",
      responseTime: data.metrics?.responseTime,
    };

    return {
      credentials,
      network,
      overall: this.determineOverallStatus(credentials, network, data),
      source: "enhanced",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Normalize legacy endpoint response to unified format
   */
  private normalizeLegacyResponse(data: any): StatusResolutionResult {
    const credentials: UnifiedCredentialStatus = {
      hasCredentials: Boolean(data.hasCredentials),
      isValid: Boolean(data.credentialsValid),
      source: data.credentialSource || "none",
      hasUserCredentials: Boolean(data.hasUserCredentials),
      hasEnvironmentCredentials: Boolean(data.hasEnvironmentCredentials),
      lastValidated: new Date().toISOString(),
      error: data.error,
      canAuthenticate: Boolean(data.credentialsValid), // Legacy uses credentialsValid for authentication
    };

    const network: UnifiedNetworkStatus = {
      connected: Boolean(data.connected),
      lastChecked: new Date().toISOString(),
      error: data.connected ? undefined : data.error || "Network disconnected",
    };

    return {
      credentials,
      network,
      overall: this.determineOverallStatus(credentials, network, data),
      source: "legacy",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Determine overall system status with consistent logic
   */
  private determineOverallStatus(
    credentials: UnifiedCredentialStatus,
    network: UnifiedNetworkStatus,
    _rawData?: any
  ): StatusResolutionResult["overall"] {
    // Network connectivity is first priority
    if (!network.connected) {
      return {
        status: "error",
        message: "Network connection unavailable",
        canTrade: false,
      };
    }

    // No credentials configured
    if (!credentials.hasCredentials) {
      return {
        status: "warning",
        message: "API credentials not configured",
        canTrade: false,
      };
    }

    // Test credentials - special handling
    if (credentials.isTestCredentials) {
      return {
        status: "warning",
        message:
          "Demo mode active with test credentials - configure real MEXC API credentials for live trading",
        canTrade: false, // Cannot trade with test credentials
      };
    }

    // Invalid credentials
    if (!credentials.isValid || !credentials.canAuthenticate) {
      return {
        status: "error",
        message: `Invalid API credentials: ${credentials.error || "Authentication failed"}`,
        canTrade: false,
      };
    }

    // Poor connection quality
    if (credentials.connectionHealth === "poor") {
      return {
        status: "warning",
        message: "Poor connection quality detected",
        canTrade: true, // Can still trade but with warnings
      };
    }

    // All systems operational
    return {
      status: "healthy",
      message: "All systems operational",
      canTrade: true,
    };
  }

  /**
   * Create fallback status when all endpoints fail
   */
  private createFallbackStatus(message: string): StatusResolutionResult {
    return {
      credentials: {
        hasCredentials: false,
        isValid: false,
        source: "none",
        hasUserCredentials: false,
        hasEnvironmentCredentials: false,
        lastValidated: new Date().toISOString(),
        error: "Status check failed",
      },
      network: {
        connected: false,
        lastChecked: new Date().toISOString(),
        error: "Unable to check network status",
      },
      overall: {
        status: "error",
        message,
        canTrade: false,
      },
      source: "fallback",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get last known status (useful for quick access)
   */
  getLastKnownStatus(): StatusResolutionResult | null {
    return this.lastKnownStatus;
  }

  /**
   * Force refresh of status (clears cache)
   */
  async forceRefresh(): Promise<StatusResolutionResult> {
    this.lastKnownStatus = null;
    return this.resolveStatus();
  }

  /**
   * Check if status is stale (older than specified time)
   */
  isStale(maxAgeMs = 30000): boolean {
    if (!this.lastKnownStatus) return true;

    const age = Date.now() - new Date(this.lastKnownStatus.timestamp).getTime();
    return age > maxAgeMs;
  }
}

// Global instance
let globalStatusResolver: UnifiedStatusResolver | null = null;

/**
 * Get or create global status resolver instance
 */
export function getGlobalStatusResolver(): UnifiedStatusResolver {
  if (!globalStatusResolver) {
    globalStatusResolver = new UnifiedStatusResolver();
  }
  return globalStatusResolver;
}

/**
 * Utility function to get unified status
 */
export async function getUnifiedStatus(): Promise<StatusResolutionResult> {
  return getGlobalStatusResolver().resolveStatus();
}

/**
 * Utility function to force status refresh
 */
export async function refreshUnifiedStatus(): Promise<StatusResolutionResult> {
  return getGlobalStatusResolver().forceRefresh();
}
