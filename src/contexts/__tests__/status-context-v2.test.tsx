/**
 * Status Context V2 (React Query) Tests
 *
 * Tests for the React Query-based StatusContext implementation
 * to ensure it maintains backward compatibility and improves functionality.
 */

import { describe, expect, it } from "vitest";
import type { 
  ApplicationStatus, 
  NetworkStatus, 
  CredentialStatus, 
  TradingStatus, 
  SystemStatus, 
  WorkflowStatus 
} from "../status-context-v2";

describe("StatusContext V2 Types and Interfaces", () => {
  it("should maintain backward compatibility with original ApplicationStatus interface", () => {
    const mockStatus: ApplicationStatus = {
      network: {
        connected: true,
        lastChecked: new Date().toISOString(),
      },
      credentials: {
        hasCredentials: true,
        isValid: true,
        source: "database",
        hasUserCredentials: true,
        hasEnvironmentCredentials: false,
        lastValidated: new Date().toISOString(),
      },
      trading: {
        canTrade: true,
        balanceLoaded: true,
        lastUpdate: new Date().toISOString(),
      },
      system: {
        overall: "healthy",
        components: {},
        lastHealthCheck: new Date().toISOString(),
      },
      workflows: {
        discoveryRunning: false,
        sniperActive: false,
        activeWorkflows: [],
        systemStatus: "stopped",
        lastUpdate: new Date().toISOString(),
      },
      isLoading: false,
      lastGlobalUpdate: new Date().toISOString(),
      syncErrors: [],
    };

    // Type assertions to ensure backward compatibility
    expect(mockStatus.network.connected).toBe(true);
    expect(mockStatus.credentials.hasCredentials).toBe(true);
    expect(mockStatus.credentials.isValid).toBe(true);
    expect(mockStatus.credentials.source).toBe("database");
    expect(mockStatus.trading.canTrade).toBe(true);
    expect(mockStatus.system.overall).toBe("healthy");
    expect(mockStatus.workflows.systemStatus).toBe("stopped");
    expect(mockStatus.isLoading).toBe(false);
    expect(Array.isArray(mockStatus.syncErrors)).toBe(true);
  });

  it("should support enhanced credential status fields", () => {
    const credentialStatus: CredentialStatus = {
      hasCredentials: true,
      isValid: true,
      source: "database",
      hasUserCredentials: true,
      hasEnvironmentCredentials: false,
      lastValidated: new Date().toISOString(),
      // Enhanced fields
      isTestCredentials: false,
      connectionHealth: "excellent",
      metrics: {
        totalChecks: 100,
        successRate: 95,
        averageLatency: 150,
        consecutiveFailures: 0,
        uptime: 3600,
      },
      alerts: {
        count: 0,
        severity: "none",
      },
    };

    expect(credentialStatus.isTestCredentials).toBe(false);
    expect(credentialStatus.connectionHealth).toBe("excellent");
    expect(credentialStatus.metrics?.successRate).toBe(95);
    expect(credentialStatus.alerts?.severity).toBe("none");
  });

  it("should handle test credentials correctly in type system", () => {
    const testCredentialStatus: CredentialStatus = {
      hasCredentials: true,
      isValid: false, // Test credentials are marked invalid
      source: "database",
      hasUserCredentials: true,
      hasEnvironmentCredentials: false,
      lastValidated: new Date().toISOString(),
      isTestCredentials: true,
      error: "Test credentials detected - configure real MEXC API credentials",
    };

    expect(testCredentialStatus.isTestCredentials).toBe(true);
    expect(testCredentialStatus.isValid).toBe(false);
    expect(testCredentialStatus.error).toContain("Test credentials");
  });

  it("should support all status source types", () => {
    const sources: CredentialStatus["source"][] = ["database", "environment", "none"];
    
    sources.forEach(source => {
      const status: CredentialStatus = {
        hasCredentials: source !== "none",
        isValid: source !== "none",
        source,
        hasUserCredentials: source === "database",
        hasEnvironmentCredentials: source === "environment",
        lastValidated: new Date().toISOString(),
      };
      
      expect(status.source).toBe(source);
      expect(status.hasCredentials).toBe(source !== "none");
    });
  });

  it("should support all connection health levels", () => {
    const healthLevels: CredentialStatus["connectionHealth"][] = [
      "excellent", 
      "good", 
      "fair", 
      "poor"
    ];
    
    healthLevels.forEach(health => {
      const status: CredentialStatus = {
        hasCredentials: true,
        isValid: true,
        source: "database",
        hasUserCredentials: true,
        hasEnvironmentCredentials: false,
        lastValidated: new Date().toISOString(),
        connectionHealth: health,
      };
      
      expect(status.connectionHealth).toBe(health);
    });
  });

  it("should support all system status levels", () => {
    const statusLevels: SystemStatus["overall"][] = [
      "healthy", 
      "warning", 
      "error", 
      "unknown"
    ];
    
    statusLevels.forEach(overall => {
      const status: SystemStatus = {
        overall,
        components: {},
        lastHealthCheck: new Date().toISOString(),
      };
      
      expect(status.overall).toBe(overall);
    });
  });

  it("should support all workflow system status types", () => {
    const workflowStatuses: WorkflowStatus["systemStatus"][] = [
      "running", 
      "stopped", 
      "error"
    ];
    
    workflowStatuses.forEach(systemStatus => {
      const status: WorkflowStatus = {
        discoveryRunning: false,
        sniperActive: false,
        activeWorkflows: [],
        systemStatus,
        lastUpdate: new Date().toISOString(),
      };
      
      expect(status.systemStatus).toBe(systemStatus);
    });
  });

  it("should handle network status with error", () => {
    const networkStatus: NetworkStatus = {
      connected: false,
      lastChecked: new Date().toISOString(),
      error: "Unable to connect to MEXC API",
    };

    expect(networkStatus.connected).toBe(false);
    expect(networkStatus.error).toBe("Unable to connect to MEXC API");
  });

  it("should handle trading status with error", () => {
    const tradingStatus: TradingStatus = {
      canTrade: false,
      balanceLoaded: false,
      lastUpdate: new Date().toISOString(),
      error: "Invalid API credentials",
    };

    expect(tradingStatus.canTrade).toBe(false);
    expect(tradingStatus.balanceLoaded).toBe(false);
    expect(tradingStatus.error).toBe("Invalid API credentials");
  });

  it("should handle system components correctly", () => {
    const systemStatus: SystemStatus = {
      overall: "warning",
      components: {
        api: {
          status: "active",
          message: "API responding normally",
          lastChecked: new Date().toISOString(),
        },
        database: {
          status: "warning",
          message: "High latency detected",
          lastChecked: new Date().toISOString(),
        },
        credentials: {
          status: "error",
          message: "Authentication failed",
          lastChecked: new Date().toISOString(),
        },
      },
      lastHealthCheck: new Date().toISOString(),
    };

    expect(systemStatus.overall).toBe("warning");
    expect(systemStatus.components.api.status).toBe("active");
    expect(systemStatus.components.database.status).toBe("warning");
    expect(systemStatus.components.credentials.status).toBe("error");
  });
});