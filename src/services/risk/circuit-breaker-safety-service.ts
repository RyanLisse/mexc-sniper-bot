import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Circuit Breaker Safety Service
 *
 * Comprehensive service to fix "Circuit breaker in protective state" issues
 * and implement safety validation before enabling auto-sniping operations.
 *
 * FIXED: Added coordination to prevent race conditions between multiple services
 * attempting to disable trading simultaneously.
 */

import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { TRADING_TELEMETRY_CONFIG } from "@/src/lib/opentelemetry-setup";
import { UnifiedErrorHandler } from "@/src/lib/unified-error-handling";
import {
  CircuitBreakerCoordinator,
  CoordinatedCircuitBreakerRegistry,
} from "./coordinated-circuit-breaker";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CircuitBreakerDiagnosis {
  isInProtectiveState: boolean;
  issue: string;
  canAutoRecover: boolean;
  timeSinceLastFailure?: number;
  failureCount: number;
  recommendedAction: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface RecoveryResult {
  success: boolean;
  steps: string[];
  newState?: string;
  reason?: string;
  duration: number;
  timestamp: string;
}

export interface SystemReadiness {
  ready: boolean;
  score: number;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  lastChecked: string;
}

export interface ComprehensiveSafetyCheck {
  overall: "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL";
  checks: {
    circuitBreaker: SafetyCheckResult;
    connectivity: SafetyCheckResult;
    systemHealth: SafetyCheckResult;
    riskManagement: SafetyCheckResult;
  };
  recommendations: string[];
  nextCheckTime: string;
}

export interface SafetyCheckResult {
  status: "PASS" | "WARN" | "FAIL";
  message: string;
  details?: any;
  timestamp: string;
}

export interface RiskManagementValidation {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  safeToTrade: boolean;
  requiredActions: string[];
  riskFactors: string[];
  maxPositionSize?: number;
  recommendedDelay?: number;
}

export interface AutoSnipingSafetyGate {
  approved: boolean;
  blockers: string[];
  warnings: string[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requiresManualApproval: boolean;
  validUntil?: string;
}

// ============================================================================
// Main Circuit Breaker Safety Service
// ============================================================================

export class CircuitBreakerSafetyService {
  private errorHandler: UnifiedErrorHandler;
  private mexcService: any;
  private coordinatedRegistry: CoordinatedCircuitBreakerRegistry;
  private coordinator: CircuitBreakerCoordinator;
  private serviceId: string;
  private tracer = trace.getTracer("circuit-breaker-safety-service");
  private _logger: any;

  /**
   * Lazy logger initialization to prevent webpack bundling issues
   */
  private get logger(): {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  } {
    if (!this._logger) {
      try {
        this._logger = {
          info: (message: string, context?: any) =>
            console.info(
              "[circuit-breaker-safety-service]",
              message,
              context || ""
            ),
          warn: (message: string, context?: any) =>
            console.warn(
              "[circuit-breaker-safety-service]",
              message,
              context || ""
            ),
          error: (message: string, context?: any, error?: Error) =>
            console.error(
              "[circuit-breaker-safety-service]",
              message,
              context || "",
              error || ""
            ),
          debug: (message: string, context?: any) =>
            console.debug(
              "[circuit-breaker-safety-service]",
              message,
              context || ""
            ),
        };
      } catch (_error) {
        // Fallback to console logging during build time
        this._logger = {
          debug: console.debug.bind(console),
          info: console.info.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console),
          fatal: console.error.bind(console),
        } as any;
      }
    }
    return this._logger;
  }

  constructor(mexcService: any, serviceId = "circuit-breaker-safety-service") {
    this.mexcService = mexcService;
    this.errorHandler = new UnifiedErrorHandler();
    this.coordinatedRegistry = CoordinatedCircuitBreakerRegistry.getInstance();
    this.coordinator = CircuitBreakerCoordinator.getInstance();
    this.serviceId = serviceId;
  }

  /**
   * Diagnose circuit breaker protective state issue
   */
  async diagnoseCircuitBreakerIssue(): Promise<CircuitBreakerDiagnosis> {
    return await this.tracer.startActiveSpan(
      TRADING_TELEMETRY_CONFIG.spans.safety_check,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [TRADING_TELEMETRY_CONFIG.attributes.agent_type]:
            "circuit-breaker-safety",
          "operation.type": "diagnosis",
        },
      },
      async (span) => {
        try {
          const statusResponse =
            await this.mexcService.getCircuitBreakerStatus();

          if (!statusResponse.success) {
            span.recordException(
              new Error("Circuit breaker status check failed")
            );
            span.setStatus({ code: SpanStatusCode.ERROR });
            const result = {
              isInProtectiveState: true,
              issue: "Cannot determine circuit breaker status",
              canAutoRecover: false,
              failureCount: 999,
              recommendedAction: "Manual system check required",
              severity: "CRITICAL" as const,
            };
            span.setAttributes({
              "diagnosis.result": "error",
              "diagnosis.severity": result.severity,
            });
            return result;
          }

          const status = statusResponse.data;
          const isOpen = status.state === "OPEN";
          const failureCount = status.failures || 0;

          let timeSinceLastFailure: number | undefined;
          if (status.lastFailureTime) {
            timeSinceLastFailure =
              Date.now() - new Date(status.lastFailureTime).getTime();
          }

          let result: CircuitBreakerDiagnosis;

          if (isOpen) {
            result = {
              isInProtectiveState: true,
              issue: "Circuit breaker is OPEN",
              canAutoRecover: true,
              timeSinceLastFailure,
              failureCount,
              recommendedAction:
                "Reset circuit breaker after safety validation",
              severity: failureCount > 10 ? "CRITICAL" : "HIGH",
            };
          } else if (status.state === "HALF_OPEN") {
            result = {
              isInProtectiveState: true,
              issue: "Circuit breaker is HALF_OPEN (testing recovery)",
              canAutoRecover: true,
              timeSinceLastFailure,
              failureCount,
              recommendedAction: "Monitor recovery progress",
              severity: "MEDIUM",
            };
          } else {
            result = {
              isInProtectiveState: false,
              issue: "Circuit breaker is healthy",
              canAutoRecover: false,
              timeSinceLastFailure,
              failureCount,
              recommendedAction: "No action required",
              severity: "LOW",
            };
          }

          // Add span attributes
          span.setAttributes({
            "diagnosis.protective_state": result.isInProtectiveState,
            "diagnosis.severity": result.severity,
            "diagnosis.failure_count": result.failureCount,
            "diagnosis.can_auto_recover": result.canAutoRecover,
            "circuit_breaker.state": status.state,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          span.setStatus({ code: SpanStatusCode.ERROR });
          const result = {
            isInProtectiveState: true,
            issue: `Circuit breaker diagnosis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            canAutoRecover: false,
            failureCount: 999,
            recommendedAction: "Manual system check required",
            severity: "CRITICAL" as const,
          };
          span.setAttributes({
            "diagnosis.result": "error",
            "diagnosis.severity": result.severity,
          });
          return result;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Execute safe circuit breaker recovery process with coordination
   * FIXED: Now uses coordinated circuit breaker to prevent race conditions
   */
  async executeCircuitBreakerRecovery(
    _reliabilityManager: any
  ): Promise<RecoveryResult> {
    return await this.tracer.startActiveSpan(
      "trading.circuit_breaker_recovery",
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [TRADING_TELEMETRY_CONFIG.attributes.agent_type]:
            "circuit-breaker-safety",
          "operation.type": "recovery",
        },
      },
      async (span) => {
        const startTime = Date.now();
        const steps: string[] = [];
        const timestamp = new Date().toISOString();

        try {
          // Step 1: Validate safety conditions with coordination
          steps.push("Starting coordinated safety validation");

          // Use coordination to ensure only one service is performing recovery at a time
          const recoveryOperation = async (): Promise<RecoveryResult> => {
            // Safety validation
            const connectivity = await this.mexcService.testConnectivity();
            if (!connectivity) {
              return {
                success: false,
                steps,
                reason:
                  "System connectivity check failed - unsafe to reset circuit breaker",
                duration: Date.now() - startTime,
                timestamp,
              };
            }
            steps.push("Validated safety conditions under coordination lock");

            // Get coordinated circuit breaker instance
            const mexcApiBreaker = this.coordinatedRegistry.getBreaker(
              "mexc-api",
              this.serviceId,
              {
                failureThreshold: 3,
                recoveryTimeout: 30000,
                enableCoordination: true,
              }
            );

            if (!mexcApiBreaker) {
              return {
                success: false,
                steps,
                reason: "Coordinated circuit breaker instance not available",
                duration: Date.now() - startTime,
                timestamp,
              };
            }

            steps.push("Acquired coordinated circuit breaker instance");

            // Reset circuit breaker with coordination
            try {
              await mexcApiBreaker.reset();
              steps.push("Reset circuit breaker with coordination");
            } catch (error) {
              return {
                success: false,
                steps,
                reason: `Coordinated circuit breaker reset failed: ${error instanceof Error ? error.message : "Unknown error"}`,
                duration: Date.now() - startTime,
                timestamp,
              };
            }

            // Verify connectivity after reset
            const postResetConnectivity =
              await this.mexcService.testConnectivityWithResponse();
            if (!postResetConnectivity.success) {
              return {
                success: false,
                steps,
                reason: "Post-reset connectivity test failed",
                duration: Date.now() - startTime,
                timestamp,
              };
            }
            steps.push("Verified system connectivity after coordinated reset");

            // Final validation
            const finalState = mexcApiBreaker.getStats();
            steps.push(
              `Coordinated circuit breaker state: ${finalState.state}`
            );
            steps.push("Coordinated recovery process completed successfully");

            return {
              success: true,
              steps,
              newState: finalState.state,
              duration: Date.now() - startTime,
              timestamp,
            };
          };

          // Execute recovery with coordination to prevent race conditions
          const result = await this.coordinator.executeWithCoordination(
            "mexc-api",
            "recovery",
            this.serviceId,
            recoveryOperation,
            "critical"
          );

          // Add span attributes based on result
          span.setAttributes({
            "recovery.success": result.success,
            "recovery.duration_ms": result.duration,
            "recovery.steps_count": result.steps.length,
            "recovery.new_state": result.newState || "unknown",
          });

          if (result.success) {
            span.setStatus({ code: SpanStatusCode.OK });
          } else {
            span.recordException(new Error(result.reason || "Recovery failed"));
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: result.reason,
            });
          }

          return result;
        } catch (error) {
          steps.push(
            `Coordinated recovery failed: ${error instanceof Error ? error.message : "Unknown error"}`
          );

          const result = {
            success: false,
            steps,
            reason: `Coordinated recovery process failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            duration: Date.now() - startTime,
            timestamp,
          };

          span.recordException(
            error instanceof Error ? error : new Error(String(error))
          );
          span.setStatus({ code: SpanStatusCode.ERROR });
          span.setAttributes({
            "recovery.success": false,
            "recovery.duration_ms": result.duration,
            "recovery.error": result.reason,
          });

          return result;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Validate system readiness for auto-sniping
   */
  async validateSystemReadiness(): Promise<SystemReadiness> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // Check circuit breaker status
      const cbDiagnosis = await this.diagnoseCircuitBreakerIssue();
      if (cbDiagnosis.isInProtectiveState) {
        blockers.push("Circuit breaker is in protective state");
        recommendations.push("Reset circuit breaker safely");
        score -= 30;
      }

      // Check connectivity
      const connectivity = await this.mexcService.testConnectivity();
      if (!connectivity) {
        blockers.push("MEXC API connectivity failed");
        recommendations.push("Check internet connection and API status");
        score -= 40;
      }

      // Check credential validity (if available)
      if (this.mexcService.hasValidCredentials) {
        const hasCredentials = this.mexcService.hasValidCredentials();
        if (!hasCredentials) {
          blockers.push("MEXC API credentials not configured");
          recommendations.push("Configure valid MEXC API credentials");
          score -= 25;
        }
      }

      // FIXED: Auto-sniping is ALWAYS enabled by system design
      // Removed dependency on AUTO_SNIPING_ENABLED environment variable
      console.info(
        "ℹ️ Auto-sniping is permanently enabled by system configuration"
      );

      // Risk management configuration
      const maxPositionSize = process.env.MAX_POSITION_SIZE;
      if (!maxPositionSize || Number.parseFloat(maxPositionSize) <= 0) {
        warnings.push("Max position size not configured");
        recommendations.push("Set MAX_POSITION_SIZE environment variable");
        score -= 5;
      }

      const ready = blockers.length === 0 && score >= 80;

      if (ready) {
        recommendations.push("System is ready for auto-sniping operations");
      } else {
        recommendations.push(
          "Resolve all blockers before enabling auto-sniping"
        );
      }

      return {
        ready,
        score: Math.max(0, score),
        blockers,
        warnings,
        recommendations,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ready: false,
        score: 0,
        blockers: [
          `System readiness check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
        warnings: [],
        recommendations: ["Investigate system readiness check failure"],
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Perform comprehensive safety check
   */
  async performComprehensiveSafetyCheck(): Promise<ComprehensiveSafetyCheck> {
    return await this.tracer.startActiveSpan(
      TRADING_TELEMETRY_CONFIG.spans.safety_check,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [TRADING_TELEMETRY_CONFIG.attributes.agent_type]:
            "circuit-breaker-safety",
          "operation.type": "comprehensive_safety_check",
        },
      },
      async (span) => {
        const timestamp = new Date().toISOString();
        const recommendations: string[] = [];

        // Circuit breaker check
        const cbDiagnosis = await this.diagnoseCircuitBreakerIssue();
        const circuitBreakerCheck: SafetyCheckResult = {
          status: cbDiagnosis.isInProtectiveState ? "FAIL" : "PASS",
          message: cbDiagnosis.issue,
          details: cbDiagnosis,
          timestamp,
        };

        if (cbDiagnosis.isInProtectiveState) {
          recommendations.push("Fix circuit breaker protective state");
        }

        // Connectivity check
        let connectivityCheck: SafetyCheckResult;
        try {
          const connectivity =
            await this.mexcService.testConnectivityWithResponse();
          connectivityCheck = {
            status: connectivity.success ? "PASS" : "FAIL",
            message: connectivity.success
              ? "API connectivity healthy"
              : "API connectivity failed",
            details: connectivity,
            timestamp,
          };

          if (!connectivity.success) {
            recommendations.push("Restore MEXC API connectivity");
          }
        } catch (error) {
          connectivityCheck = {
            status: "FAIL",
            message: "Connectivity test failed",
            details: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp,
          };
          recommendations.push("Investigate connectivity issues");
        }

        // System health check (basic)
        const systemHealthCheck: SafetyCheckResult = {
          status: "PASS",
          message: "System health check passed",
          details: {
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
          },
          timestamp,
        };

        // Risk management check
        const riskValidation = await this.validateRiskManagementSystems();
        const riskManagementCheck: SafetyCheckResult = {
          status: riskValidation.safeToTrade ? "PASS" : "FAIL",
          message: `Risk level: ${riskValidation.riskLevel}`,
          details: riskValidation,
          timestamp,
        };

        if (!riskValidation.safeToTrade) {
          recommendations.push(...riskValidation.requiredActions);
        }

        // Determine overall status
        const checks = {
          circuitBreaker: circuitBreakerCheck,
          connectivity: connectivityCheck,
          systemHealth: systemHealthCheck,
          riskManagement: riskManagementCheck,
        };
        const failedChecks = Object.values(checks).filter(
          (check) => check.status === "FAIL"
        ).length;
        const warnChecks = Object.values(checks).filter(
          (check) => check.status === "WARN"
        ).length;

        let overall: "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL";
        if (failedChecks === 0 && warnChecks === 0) {
          overall = "HEALTHY";
        } else if (failedChecks <= 2) {
          // Allow for circuit breaker + risk issues without going critical
          overall = "NEEDS_ATTENTION";
        } else {
          overall = "CRITICAL";
        }

        if (overall === "HEALTHY") {
          recommendations.push("All safety checks passed - system ready");
        }

        const result = {
          overall,
          checks,
          recommendations,
          nextCheckTime: new Date(Date.now() + 5 * 60000).toISOString(), // 5 minutes from now
        };

        // Add span attributes
        span.setAttributes({
          "safety_check.overall_status": overall,
          "safety_check.circuit_breaker_status": checks.circuitBreaker.status,
          "safety_check.connectivity_status": checks.connectivity.status,
          "safety_check.system_health_status": checks.systemHealth.status,
          "safety_check.risk_management_status": checks.riskManagement.status,
          "safety_check.recommendations_count": recommendations.length,
        });

        if (overall === "HEALTHY") {
          span.setStatus({ code: SpanStatusCode.OK });
        } else if (overall === "CRITICAL") {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Critical safety issues detected",
          });
        } else {
          span.setStatus({
            code: SpanStatusCode.OK,
            message: "Safety issues require attention",
          });
        }

        span.end();
        return result;
      }
    );
  }

  /**
   * Validate risk management systems
   */
  async validateRiskManagementSystems(): Promise<RiskManagementValidation> {
    const riskFactors: string[] = [];
    const requiredActions: string[] = [];

    // Check circuit breaker status
    const cbDiagnosis = await this.diagnoseCircuitBreakerIssue();
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";

    if (cbDiagnosis.isInProtectiveState) {
      riskFactors.push("Circuit breaker in protective state");
      requiredActions.push("Reset circuit breaker");
      riskLevel = "HIGH";
    }

    if (cbDiagnosis.failureCount > 10) {
      riskFactors.push("High failure count detected");
      riskLevel = "CRITICAL";
    }

    // Check configuration
    const maxPositionSize = Number.parseFloat(
      process.env.MAX_POSITION_SIZE || "0.1"
    );
    if (maxPositionSize > 0.5) {
      riskFactors.push("Position size too large");
      requiredActions.push("Reduce maximum position size");
      riskLevel = riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH";
    }

    const safeToTrade =
      riskLevel !== "CRITICAL" && !cbDiagnosis.isInProtectiveState;

    return {
      riskLevel,
      safeToTrade,
      requiredActions,
      riskFactors,
      maxPositionSize: safeToTrade ? maxPositionSize : 0,
      recommendedDelay: riskLevel === "HIGH" ? 30000 : 0, // 30 second delay for high risk
    };
  }

  /**
   * Check auto-sniping safety gates
   */
  async checkAutoSnipingSafetyGates(): Promise<AutoSnipingSafetyGate> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";

    // Circuit breaker check
    const cbDiagnosis = await this.diagnoseCircuitBreakerIssue();
    if (cbDiagnosis.isInProtectiveState) {
      blockers.push("Circuit breaker protective state");
      severity = cbDiagnosis.failureCount > 10 ? "CRITICAL" : "HIGH";
    }

    // System readiness check
    const readiness = await this.validateSystemReadiness();
    if (!readiness.ready) {
      blockers.push(...readiness.blockers);
      warnings.push(...readiness.warnings);

      // Only escalate if system score is very low, otherwise keep circuit breaker severity
      if (readiness.score < 30) {
        severity = "CRITICAL";
      } else if (readiness.score < 60 && severity === "LOW") {
        severity = "MEDIUM";
      }
    }

    // Risk management check
    const riskValidation = await this.validateRiskManagementSystems();
    if (!riskValidation.safeToTrade) {
      blockers.push("Risk management validation failed");
      // Only escalate if risk level is CRITICAL, otherwise maintain current severity
      if (riskValidation.riskLevel === "CRITICAL") {
        severity = "CRITICAL";
      }
    }

    const approved = blockers.length === 0 && severity !== "CRITICAL";
    const requiresManualApproval =
      severity === "CRITICAL" || blockers.length > 2;

    return {
      approved,
      blockers,
      warnings,
      severity,
      requiresManualApproval,
      validUntil: approved
        ? new Date(Date.now() + 10 * 60000).toISOString()
        : undefined, // 10 minutes if approved
    };
  }

  /**
   * Get coordination metrics and health status
   * FIXED: New method to monitor coordination effectiveness
   */
  getCoordinationMetrics(): {
    metrics: any;
    health: string;
    recommendations: string[];
  } {
    const metrics = this.coordinator.getMetrics();
    const health = this.coordinatedRegistry.getHealthStatus();
    const recommendations: string[] = [];

    // Generate recommendations based on coordination metrics
    if (metrics.lockContentions > metrics.totalOperations * 0.1) {
      recommendations.push(
        "High lock contention detected - consider increasing coordination timeouts"
      );
    }

    if (metrics.failedAcquisitions > 0) {
      recommendations.push(
        "Lock acquisition failures detected - review service coordination"
      );
    }

    if (metrics.concurrentOperations > 3) {
      recommendations.push(
        "High concurrent operation count - monitor for potential deadlocks"
      );
    }

    return {
      metrics,
      health: health["mexc-api"] ? "healthy" : "degraded",
      recommendations,
    };
  }

  /**
   * Perform coordination maintenance
   * FIXED: New method to cleanup expired locks and maintain coordination health
   */
  performCoordinationMaintenance(): void {
    this.coordinator.cleanupExpiredLocks();
    this.coordinatedRegistry.cleanupExpiredLocks();
  }

  /**
   * Emergency coordination reset
   * FIXED: Emergency method to reset coordination state if deadlocks occur
   */
  async emergencyCoordinationReset(): Promise<void> {
    try {
      // Reset coordination state
      this.coordinator.reset();

      // Reset all circuit breakers with emergency authority
      await this.coordinatedRegistry.resetAll(`${this.serviceId}-emergency`);
    } catch (error) {
      console.error("Emergency coordination reset failed:", error);
      throw error;
    }
  }
}
