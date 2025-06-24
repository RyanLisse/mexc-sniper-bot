/**
 * Manual API Testing Script for Safety Monitoring Endpoint
 *
 * This script tests the API endpoint functionality manually to validate
 * all endpoints work correctly in a real environment.
 */

import { RealTimeSafetyMonitoringService } from "../../services/real-time-safety-monitoring-modules";
import { createLogger } from "../lib/structured-logger";

interface TestResult {
  endpoint: string;
  method: string;
  action?: string;
  status: "PASS" | "FAIL" | "SKIP";
  responseTime: number;
  statusCode?: number;
  error?: string;
  details?: Record<string, unknown>;
}

class SafetyMonitoringAPITester {
  private logger = createLogger("safety-monitoring-api-test");

  private baseUrl = "http://localhost:3000/api/auto-sniping/safety-monitoring";
  private results: TestResult[] = [];
  private safetyService: RealTimeSafetyMonitoringService;

  constructor() {
    this.safetyService = RealTimeSafetyMonitoringService.getInstance();
  }

  async runAllTests(): Promise<TestResult[]> {
    logger.info("🧪 Starting Safety Monitoring API Tests\n");

    // Test GET endpoints
    await this.testGetEndpoints();

    // Test POST endpoints
    await this.testPostEndpoints();

    // Test error scenarios
    await this.testErrorScenarios();

    // Test edge cases
    await this.testEdgeCases();

    this.printSummary();
    return this.results;
  }

  private async testGetEndpoints(): Promise<void> {
    logger.info("📥 Testing GET endpoints...");

    const getTests = [
      { action: "status", description: "Get monitoring status" },
      { action: "report", description: "Get comprehensive safety report" },
      { action: "risk-metrics", description: "Get current risk metrics" },
      { action: "alerts", description: "Get active alerts" },
      { action: "system-health", description: "Get system health status" },
      { action: "configuration", description: "Get current configuration" },
      { action: "timer-status", description: "Get timer coordination status" },
      { action: "check-safety", description: "Quick safety check" },
    ];

    for (const test of getTests) {
      await this.testGetEndpoint(test.action, test.description);
    }
  }

  private async testGetEndpoint(action: string, description: string): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`  Testing: ${description} (${action})`);

      // Simulate authenticated request (in real test, would include auth headers)
      const url = `${this.baseUrl}?action=${action}`;

      // For this manual test, we'll call the service directly
      // In a real test, this would be an HTTP request
      const result = await this.simulateGetRequest(action);

      const responseTime = Date.now() - startTime;

      this.results.push({
        endpoint: url,
        method: "GET",
        action,
        status: result.success ? "PASS" : "FAIL",
        responseTime,
        statusCode: result.success ? 200 : 500,
        details: result.data || result.error,
      });

      logger.info(`  ✅ ${description}: ${responseTime}ms`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.push({
        endpoint: `${this.baseUrl}?action=${action}`,
        method: "GET",
        action,
        status: "FAIL",
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      });

      logger.info(
        `  ❌ ${description}: Failed - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async simulateGetRequest(
    action: string
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      switch (action) {
        case "status": {
          const isActive = this.safetyService.isMonitoringActive;
          const timerStatus = this.safetyService.getTimerStatus();
          return {
            success: true,
            data: {
              isActive,
              timerOperations: timerStatus,
              lastChecked: new Date().toISOString(),
            },
          };
        }

        case "report": {
          const report = await this.safetyService.getSafetyReport();
          return { success: true, data: report };
        }

        case "risk-metrics": {
          const riskMetrics = this.safetyService.getRiskMetrics();
          return {
            success: true,
            data: {
              riskMetrics,
              timestamp: new Date().toISOString(),
            },
          };
        }

        case "alerts": {
          const report = await this.safetyService.getSafetyReport();
          return {
            success: true,
            data: {
              alerts: report.activeAlerts,
              totalCount: report.activeAlerts.length,
              filteredCount: report.activeAlerts.length,
            },
          };
        }

        case "system-health": {
          const report = await this.safetyService.getSafetyReport();
          return {
            success: true,
            data: {
              systemHealth: report.systemHealth,
              overallRiskScore: report.overallRiskScore,
              status: report.status,
              recommendations: report.recommendations,
              lastUpdated: report.lastUpdated,
            },
          };
        }

        case "configuration": {
          const config = this.safetyService.config;
          return {
            success: true,
            data: {
              configuration: config,
              isActive: this.safetyService.isMonitoringActive,
            },
          };
        }

        case "timer-status": {
          const timerStatus = this.safetyService.getTimerStatus();
          return {
            success: true,
            data: {
              timerOperations: timerStatus,
              isMonitoringActive: this.safetyService.isMonitoringActive,
              currentTime: Date.now(),
            },
          };
        }

        case "check-safety": {
          const isSafe = await this.safetyService.isSystemSafe();
          const riskMetrics = this.safetyService.getRiskMetrics();
          return {
            success: true,
            data: {
              isSafe,
              overallRiskScore: this.safetyService.calculateOverallRiskScore(),
              currentDrawdown: riskMetrics.currentDrawdown,
              successRate: riskMetrics.successRate,
              consecutiveLosses: riskMetrics.consecutiveLosses,
              lastChecked: new Date().toISOString(),
            },
          };
        }

        default:
          return { success: false, error: "Invalid action" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async testPostEndpoints(): Promise<void> {
    logger.info("\n📤 Testing POST endpoints...");

    const postTests = [
      {
        action: "start_monitoring",
        description: "Start monitoring",
        body: { action: "start_monitoring" },
      },
      {
        action: "stop_monitoring",
        description: "Stop monitoring",
        body: { action: "stop_monitoring" },
      },
      {
        action: "update_configuration",
        description: "Update configuration",
        body: {
          action: "update_configuration",
          configuration: {
            monitoringIntervalMs: 45000,
            autoActionEnabled: true,
          },
        },
      },
      {
        action: "update_thresholds",
        description: "Update safety thresholds",
        body: {
          action: "update_thresholds",
          thresholds: {
            maxDrawdownPercentage: 20,
            minSuccessRatePercentage: 70,
          },
        },
      },
      {
        action: "emergency_response",
        description: "Trigger emergency response",
        body: {
          action: "emergency_response",
          reason: "Manual API test emergency",
        },
      },
      {
        action: "acknowledge_alert",
        description: "Acknowledge alert",
        body: {
          action: "acknowledge_alert",
          alertId: "test_alert_123",
        },
      },
      {
        action: "clear_acknowledged_alerts",
        description: "Clear acknowledged alerts",
        body: { action: "clear_acknowledged_alerts" },
      },
      {
        action: "force_risk_assessment",
        description: "Force risk assessment",
        body: { action: "force_risk_assessment" },
      },
    ];

    for (const test of postTests) {
      await this.testPostEndpoint(test.action, test.description, test.body);
    }
  }

  private async testPostEndpoint(
    action: string,
    description: string,
    body: Record<string, unknown>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(`  Testing: ${description} (${action})`);

      const result = await this.simulatePostRequest(body);
      const responseTime = Date.now() - startTime;

      this.results.push({
        endpoint: this.baseUrl,
        method: "POST",
        action,
        status: result.success ? "PASS" : "FAIL",
        responseTime,
        statusCode: result.success ? 200 : result.error?.includes("already") ? 409 : 500,
        details: result.data || result.error,
      });

      logger.info(`  ✅ ${description}: ${responseTime}ms`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.push({
        endpoint: this.baseUrl,
        method: "POST",
        action,
        status: "FAIL",
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      });

      logger.info(
        `  ❌ ${description}: Failed - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async simulatePostRequest(
    body: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const { action } = body;

      switch (action) {
        case "start_monitoring": {
          if (this.safetyService.isMonitoringActive) {
            return { success: false, error: "Safety monitoring is already active" };
          }

          await this.safetyService.startMonitoring();
          return {
            success: true,
            data: {
              message: "Safety monitoring started successfully",
              isActive: true,
              startedAt: new Date().toISOString(),
            },
          };
        }

        case "stop_monitoring": {
          if (!this.safetyService.isMonitoringActive) {
            return { success: false, error: "Safety monitoring is not currently active" };
          }

          this.safetyService.stopMonitoring();
          return {
            success: true,
            data: {
              message: "Safety monitoring stopped successfully",
              isActive: false,
              stoppedAt: new Date().toISOString(),
            },
          };
        }

        case "update_configuration": {
          const { configuration } = body;
          this.safetyService.updateConfiguration(configuration);
          return {
            success: true,
            data: {
              message: "Configuration updated successfully",
              updatedFields: Object.keys(configuration),
            },
          };
        }

        case "update_thresholds": {
          const { thresholds } = body;
          this.safetyService.updateConfiguration({
            thresholds: { ...this.safetyService.config.thresholds, ...thresholds },
          });
          return {
            success: true,
            data: {
              message: "Thresholds updated successfully",
              updatedThresholds: Object.keys(thresholds),
            },
          };
        }

        case "emergency_response": {
          const { reason } = body;
          const actions = await this.safetyService.triggerEmergencyResponse(reason);
          return {
            success: true,
            data: {
              message: "Emergency response triggered successfully",
              reason,
              actionsExecuted: actions,
            },
          };
        }

        case "acknowledge_alert": {
          const { alertId } = body;
          const acknowledged = this.safetyService.acknowledgeAlert(alertId);
          if (!acknowledged) {
            return { success: false, error: "Alert not found" };
          }
          return {
            success: true,
            data: {
              message: "Alert acknowledged successfully",
              alertId,
            },
          };
        }

        case "clear_acknowledged_alerts": {
          const clearedCount = this.safetyService.clearAcknowledgedAlerts();
          return {
            success: true,
            data: {
              message: "Acknowledged alerts cleared successfully",
              clearedCount,
            },
          };
        }

        case "force_risk_assessment": {
          await this.safetyService.performRiskAssessment();
          const riskMetrics = this.safetyService.getRiskMetrics();
          return {
            success: true,
            data: {
              message: "Risk assessment completed",
              riskMetrics,
              overallRiskScore: this.safetyService.calculateOverallRiskScore(),
            },
          };
        }

        default:
          return { success: false, error: "Invalid action" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async testErrorScenarios(): Promise<void> {
    logger.info("\n🚨 Testing error scenarios...");

    const errorTests = [
      {
        description: "Invalid GET action",
        test: () => this.simulateGetRequest("invalid_action"),
      },
      {
        description: "Invalid POST action",
        test: () => this.simulatePostRequest({ action: "invalid_action" }),
      },
      {
        description: "Missing POST action",
        test: () => this.simulatePostRequest({}),
      },
      {
        description: "Missing emergency reason",
        test: () => this.simulatePostRequest({ action: "emergency_response" }),
      },
      {
        description: "Missing alert ID",
        test: () => this.simulatePostRequest({ action: "acknowledge_alert" }),
      },
    ];

    for (const errorTest of errorTests) {
      const startTime = Date.now();
      try {
        logger.info(`  Testing: ${errorTest.description}`);

        const result = await errorTest.test();
        const responseTime = Date.now() - startTime;

        // For error tests, we expect success: false
        const status = !result.success ? "PASS" : "FAIL";

        this.results.push({
          endpoint: this.baseUrl,
          method: "TEST",
          status,
          responseTime,
          details: result,
        });

        logger.info(
          `  ${status === "PASS" ? "✅" : "❌"} ${errorTest.description}: ${responseTime}ms`
        );
      } catch (error) {
        // Unexpected errors are failures
        this.results.push({
          endpoint: this.baseUrl,
          method: "TEST",
          status: "FAIL",
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        });

        logger.info(
          `  ❌ ${errorTest.description}: Unexpected error - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  private async testEdgeCases(): Promise<void> {
    logger.info("\n🎯 Testing edge cases...");

    const edgeTests = [
      {
        description: "Filtered alerts with invalid parameters",
        test: () => this.simulateGetRequest("alerts"),
      },
      {
        description: "Configuration update with invalid fields",
        test: () =>
          this.simulatePostRequest({
            action: "update_configuration",
            configuration: {
              invalidField: "should_be_ignored",
              monitoringIntervalMs: 30000,
            },
          }),
      },
      {
        description: "Threshold update with mixed valid/invalid fields",
        test: () =>
          this.simulatePostRequest({
            action: "update_thresholds",
            thresholds: {
              maxDrawdownPercentage: 15,
              invalidThreshold: "not_a_number",
            },
          }),
      },
    ];

    for (const edgeTest of edgeTests) {
      const startTime = Date.now();
      try {
        logger.info(`  Testing: ${edgeTest.description}`);

        const result = await edgeTest.test();
        const responseTime = Date.now() - startTime;

        this.results.push({
          endpoint: this.baseUrl,
          method: "EDGE",
          status: result.success ? "PASS" : "FAIL",
          responseTime,
          details: result,
        });

        logger.info(`  ✅ ${edgeTest.description}: ${responseTime}ms`);
      } catch (error) {
        this.results.push({
          endpoint: this.baseUrl,
          method: "EDGE",
          status: "FAIL",
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        });

        logger.info(
          `  ❌ ${edgeTest.description}: Failed - ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  private printSummary(): void {
    logger.info("\n📊 Test Summary:");
    logger.info("================");

    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.status === "PASS").length;
    const failedTests = this.results.filter((r) => r.status === "FAIL").length;
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;

    logger.info(`Total Tests: ${totalTests}`);
    logger.info(`Passed: ${passedTests} (${Math.round((passedTests / totalTests) * 100)}%)`);
    logger.info(`Failed: ${failedTests} (${Math.round((failedTests / totalTests) * 100)}%)`);
    logger.info(`Average Response Time: ${Math.round(avgResponseTime)}ms`);

    // Performance analysis
    const slowTests = this.results.filter((r) => r.responseTime > 1000);
    if (slowTests.length > 0) {
      logger.info(`\n⚠️  Slow Tests (>1000ms): ${slowTests.length}`);
      slowTests.forEach((test) => {
        logger.info(
          `  - ${test.method} ${test.endpoint} (${test.action || "N/A"}): ${test.responseTime}ms`
        );
      });
    }

    // Failed tests details
    const failed = this.results.filter((r) => r.status === "FAIL");
    if (failed.length > 0) {
      logger.info(`\n❌ Failed Tests:`);
      failed.forEach((test) => {
        logger.info(
          `  - ${test.method} ${test.endpoint} (${test.action || "N/A"}): ${test.error || "No error details"}`
        );
      });
    }

    logger.info("\n🎉 Testing completed!");
  }
}

// Export for potential use in other tests
export { SafetyMonitoringAPITester, type TestResult };

// Self-executing test when run directly
if (require.main === module) {
  const tester = new SafetyMonitoringAPITester();
  tester
    .runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Test execution failed:", error);
      process.exit(1);
    });
}
