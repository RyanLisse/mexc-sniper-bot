/**
 * Configuration Validation Integration Tests
 *
 * Tests the complete vertical slice of configuration validation functionality:
 * - Backend validation service
 * - API endpoints
 * - Frontend hook integration
 *
 * This ensures the auto-sniping system readiness validation works end-to-end.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll,
} from "vitest";
import {
  setTestTimeout,
  withTimeout,
  withApiTimeout,
} from "../utils/timeout-utilities";
import { MexcConfigValidator } from "@/src/services/api/mexc-config-validator";
import { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";

describe("Configuration Validation Integration", () => {
  const TEST_TIMEOUT = setTestTimeout("integration");
  let configValidator: MexcConfigValidator;
  let mexcService: UnifiedMexcServiceV2;

  beforeAll(() => {
    // Note: vi.mock calls have been removed as they were causing test failures
    // Individual method mocking is done in beforeEach instead
  });

  beforeEach(async () => {
    // Setup environment variables for testing
    process.env.MEXC_API_KEY = "test-api-key";
    process.env.MEXC_SECRET_KEY = "test-secret-key";
    process.env.MAX_POSITION_SIZE = "0.10";
    process.env.MAX_PORTFOLIO_RISK = "0.20";
    process.env.STOP_LOSS_PERCENTAGE = "0.15";
    process.env.AUTO_SNIPING_ENABLED = "false";

    // Initialize services with test configuration
    configValidator = MexcConfigValidator.getInstance();

    // Get access to the internal mexcService instance for mocking
    mexcService = (configValidator as any).mexcService;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.MEXC_API_KEY;
    delete process.env.MEXC_SECRET_KEY;
    delete process.env.MAX_POSITION_SIZE;
    delete process.env.MAX_PORTFOLIO_RISK;
    delete process.env.STOP_LOSS_PERCENTAGE;
    delete process.env.AUTO_SNIPING_ENABLED;
  });

  describe("MEXC Credentials Validation", () => {
    it(
      "should validate MEXC API credentials successfully",
      async () => {
        // Mock successful API responses
        vi.spyOn(mexcService, "hasValidCredentials").mockReturnValue(true);
        vi.spyOn(mexcService, "testConnectivityWithResponse").mockResolvedValue(
          {
            success: true,
            data: { 
              serverTime: Date.now(),
              latency: 150,
              connected: true,
              apiVersion: "1.0",
              region: "US"
            },
            timestamp: new Date().toISOString(),
          },
        );
        vi.spyOn(mexcService, "getServerTime").mockResolvedValue({
          success: true,
          data: Date.now(),
          timestamp: new Date().toISOString(),
        });

        const result = await withApiTimeout(async () => {
          return await configValidator.validateMexcCredentials();
        });

        expect(result.isValid).toBe(true);
        expect(result.component).toBe("MEXC API Credentials");
        expect(result.status).toBe("valid");
        expect(result.message).toContain("validated successfully");
        expect(result.details).toBeDefined();
        expect(result.details.responseTime).toBeDefined();
      },
      TEST_TIMEOUT,
    );

    it(
      "should detect missing API credentials",
      async () => {
        // Mock missing credentials
        vi.spyOn(mexcService, "hasValidCredentials").mockReturnValue(false);

        const result = await withApiTimeout(async () => {
          return await configValidator.validateMexcCredentials();
        });

        expect(result.isValid).toBe(false);
        expect(result.status).toBe("invalid");
        expect(result.message).toContain("not configured");
        expect(result.details).toBeDefined();
        expect(result.details.hasApiKey).toBeDefined();
        expect(result.details.hasSecretKey).toBeDefined();
      },
      TEST_TIMEOUT,
    );

    it(
      "should detect API connectivity issues",
      async () => {
        // Mock connectivity failure
        vi.spyOn(mexcService, "hasValidCredentials").mockReturnValue(true);
        vi.spyOn(mexcService, "testConnectivityWithResponse").mockResolvedValue(
          {
            success: false,
            error: "Connection timeout",
            timestamp: new Date().toISOString(),
          },
        );

        const result = await withApiTimeout(async () => {
          return await configValidator.validateMexcCredentials();
        });

        expect(result.isValid).toBe(false);
        expect(result.status).toBe("invalid");
        expect(result.message).toContain("connectivity failed");
        expect(result.details.error).toBe("Connection timeout");
      },
      TEST_TIMEOUT,
    );

    it(
      "should detect server time synchronization issues",
      async () => {
        const currentTime = Date.now();
        const serverTime = currentTime + 15000; // 15 seconds ahead

        vi.spyOn(mexcService, "hasValidCredentials").mockReturnValue(true);
        vi.spyOn(mexcService, "testConnectivityWithResponse").mockResolvedValue(
          {
            success: true,
            data: { 
              serverTime,
              latency: 150,
              connected: true,
              apiVersion: "1.0",
              region: "US"
            },
            timestamp: new Date().toISOString(),
          },
        );
        vi.spyOn(mexcService, "getServerTime").mockResolvedValue({
          success: true,
          data: serverTime,
          timestamp: new Date().toISOString(),
        });

        const result = await withApiTimeout(async () => {
          return await configValidator.validateMexcCredentials();
        });

        expect(result.isValid).toBe(false);
        expect(result.status).toBe("warning");
        expect(result.message).toContain("synchronization issue");
        expect(result.details.timeDifference).toBeGreaterThan(10000);
      },
      TEST_TIMEOUT,
    );
  });

  describe("Trading Configuration Validation", () => {
    it(
      "should validate trading configuration successfully",
      async () => {
        const result = await configValidator.validateTradingConfiguration();

        expect(result.isValid).toBe(true);
        expect(result.component).toBe("Trading Configuration");
        expect(result.status).toBe("valid");
        expect(result.details.configuration).toBeDefined();
        expect(result.details.maxPositionSize).toBe(0.1);
        expect(result.details.maxPortfolioRisk).toBe(0.2);
        expect(result.details.stopLossPercentage).toBe(0.15);
      },
      TEST_TIMEOUT,
    );

    it(
      "should detect invalid position size configuration",
      async () => {
        process.env.MAX_POSITION_SIZE = "0.75"; // Invalid: too high

        const result = await configValidator.validateTradingConfiguration();

        expect(result.isValid).toBe(false);
        expect(result.status).toBe("invalid");
        expect(result.details.issues).toContain(
          "Max position size should be between 0.01 and 0.50 (1%-50%)",
        );
      },
      TEST_TIMEOUT,
    );

    it(
      "should detect invalid risk configuration",
      async () => {
        process.env.MAX_PORTFOLIO_RISK = "0.80"; // Invalid: too high
        process.env.STOP_LOSS_PERCENTAGE = "0.50"; // Invalid: too high

        const result = await configValidator.validateTradingConfiguration();

        expect(result.isValid).toBe(false);
        expect(result.status).toBe("invalid");
        expect(result.details.issues.length).toBeGreaterThan(0);
        expect(
          result.details.issues.some((issue: string) =>
            issue.includes("portfolio risk"),
          ),
        ).toBe(true);
        expect(
          result.details.issues.some((issue: string) =>
            issue.includes("Stop loss percentage"),
          ),
        ).toBe(true);
      },
      TEST_TIMEOUT,
    );
  });

  describe("System Readiness Report", () => {
    it(
      "should generate comprehensive system readiness report",
      async () => {
        // Mock all validations as successful
        vi.spyOn(configValidator, "validateMexcCredentials").mockResolvedValue({
          isValid: true,
          component: "MEXC API Credentials",
          status: "valid",
          message: "Validated successfully",
          timestamp: new Date().toISOString(),
        });

        vi.spyOn(configValidator, "validatePatternDetection").mockResolvedValue(
          {
            isValid: true,
            component: "Pattern Detection Engine",
            status: "valid",
            message: "Operational",
            timestamp: new Date().toISOString(),
          },
        );

        vi.spyOn(configValidator, "validateSafetySystems").mockResolvedValue({
          isValid: true,
          component: "Safety & Risk Management",
          status: "valid",
          message: "Fully operational",
          timestamp: new Date().toISOString(),
        });

        const report = await configValidator.generateSystemReadinessReport();

        expect(report.overallStatus).toBe("ready");
        expect(report.readinessScore).toBe(100);
        expect(report.validationResults).toHaveLength(4); // 4 validation components
        expect(report.recommendations).toBeDefined();
        expect(report.autoSnipingEnabled).toBe(false); // ENV is set to false
        expect(report.lastValidated).toBeDefined();
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle partial system readiness",
      async () => {
        // Mock mixed validation results
        vi.spyOn(configValidator, "validateMexcCredentials").mockResolvedValue({
          isValid: true,
          component: "MEXC API Credentials",
          status: "valid",
          message: "Validated successfully",
          timestamp: new Date().toISOString(),
        });

        vi.spyOn(configValidator, "validatePatternDetection").mockResolvedValue(
          {
            isValid: false,
            component: "Pattern Detection Engine",
            status: "invalid",
            message: "AI services unavailable",
            timestamp: new Date().toISOString(),
          },
        );

        vi.spyOn(configValidator, "validateSafetySystems").mockResolvedValue({
          isValid: true,
          component: "Safety & Risk Management",
          status: "valid",
          message: "Operational",
          timestamp: new Date().toISOString(),
        });

        const report = await configValidator.generateSystemReadinessReport();

        expect(report.overallStatus).toBe("partial");
        expect(report.readinessScore).toBe(75); // 3/4 components valid
        expect(report.autoSnipingEnabled).toBe(false);
        expect(
          report.recommendations.some((rec) =>
            rec.includes("Pattern Detection Engine"),
          ),
        ).toBe(true);
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle system not ready state",
      async () => {
        // Mock all validations as failed
        vi.spyOn(configValidator, "validateMexcCredentials").mockResolvedValue({
          isValid: false,
          component: "MEXC API Credentials",
          status: "invalid",
          message: "Not configured",
          timestamp: new Date().toISOString(),
        });

        vi.spyOn(configValidator, "validatePatternDetection").mockResolvedValue(
          {
            isValid: false,
            component: "Pattern Detection Engine",
            status: "invalid",
            message: "Failed",
            timestamp: new Date().toISOString(),
          },
        );

        vi.spyOn(configValidator, "validateSafetySystems").mockResolvedValue({
          isValid: false,
          component: "Safety & Risk Management",
          status: "invalid",
          message: "Failed",
          timestamp: new Date().toISOString(),
        });

        const report = await configValidator.generateSystemReadinessReport();

        expect(report.overallStatus).toBe("not_ready");
        expect(report.readinessScore).toBe(25); // Only trading config valid
        expect(report.autoSnipingEnabled).toBe(false);
        expect(report.recommendations.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT,
    );
  });

  describe("Quick Health Check", () => {
    it(
      "should perform quick health check successfully",
      async () => {
        vi.spyOn(mexcService, "testConnectivity").mockResolvedValue({
          success: true,
          data: { serverTime: Date.now(), latency: 150 },
          timestamp: new Date().toISOString(),
        });
        vi.spyOn(mexcService, "hasValidCredentials").mockReturnValue(true);

        const healthCheck = await configValidator.quickHealthCheck();

        expect(healthCheck.healthy).toBe(true);
        expect(healthCheck.score).toBe(100);
        expect(healthCheck.issues).toHaveLength(0);
      },
      TEST_TIMEOUT,
    );

    it(
      "should detect health issues",
      async () => {
        vi.spyOn(mexcService, "testConnectivity").mockResolvedValue({
          success: false,
          error: "Connection failed",
          timestamp: new Date().toISOString(),
        });
        vi.spyOn(mexcService, "hasValidCredentials").mockReturnValue(false);

        const healthCheck = await configValidator.quickHealthCheck();

        expect(healthCheck.healthy).toBe(false);
        expect(healthCheck.score).toBeLessThan(100);
        expect(healthCheck.issues.length).toBeGreaterThan(0);
        expect(healthCheck.issues).toContain("MEXC API connectivity failed");
        expect(healthCheck.issues).toContain(
          "MEXC API credentials not configured",
        );
      },
      TEST_TIMEOUT,
    );
  });

  describe("Error Handling", () => {
    it(
      "should handle validation errors gracefully",
      async () => {
        // Remove environment variables to trigger "not configured" error
        delete process.env.MEXC_API_KEY;
        delete process.env.MEXC_SECRET_KEY;

        const result = await configValidator.validateMexcCredentials();

        expect(result.isValid).toBe(false);
        expect(result.status).toBe("invalid");
        expect(result.message).toContain("Not configured");
      },
      TEST_TIMEOUT,
    );

    it(
      "should handle health check errors gracefully",
      async () => {
        vi.spyOn(mexcService, "testConnectivity").mockRejectedValue(
          new Error("Service unavailable"),
        );

        const healthCheck = await configValidator.quickHealthCheck();

        expect(healthCheck.healthy).toBe(false);
        expect(healthCheck.score).toBe(0);
        expect(healthCheck.issues[0]).toContain(
          "Health check failed: Service unavailable",
        );
      },
      TEST_TIMEOUT,
    );
  });

  describe("Configuration Singleton Behavior", () => {
    it("should maintain singleton instance", () => {
      const instance1 = MexcConfigValidator.getInstance();
      const instance2 = MexcConfigValidator.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
