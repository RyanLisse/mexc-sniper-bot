/**
 * Unified Error Handling System - Slice 1 Implementation
 *
 * This consolidates error-utils.ts and error-type-utils.ts into a single,
 * comprehensive error handling system with circuit breaker integration
 * and safety validation capabilities.
 */

import { z } from "zod";

// ============================================================================
// Error Classification Types
// ============================================================================

export enum ErrorType {
  CIRCUIT_BREAKER = "CIRCUIT_BREAKER",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  API_ERROR = "API_ERROR",
  SYSTEM_ERROR = "SYSTEM_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export enum ErrorSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum RecoveryStrategy {
  RESET_CIRCUIT_BREAKER = "RESET_CIRCUIT_BREAKER",
  RETRY_WITH_VALIDATION = "RETRY_WITH_VALIDATION",
  EXPONENTIAL_BACKOFF = "EXPONENTIAL_BACKOFF",
  FULL_SYSTEM_RESET = "FULL_SYSTEM_RESET",
  NO_RECOVERY = "NO_RECOVERY",
}

// ============================================================================
// Error Schemas and Interfaces
// ============================================================================

const ClassifiedErrorSchema = z.object({
  type: z.nativeEnum(ErrorType),
  severity: z.nativeEnum(ErrorSeverity),
  recovery: z.nativeEnum(RecoveryStrategy),
  message: z.string(),
  originalError: z.any(),
  timestamp: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type ClassifiedError = z.infer<typeof ClassifiedErrorSchema>;

const SanitizedErrorSchema = z.object({
  message: z.string(),
  type: z.string().optional(),
  stack: z.string().optional(),
  code: z.string().optional(),
});

export type SanitizedError = z.infer<typeof SanitizedErrorSchema>;

const RecoveryPlanSchema = z.object({
  strategy: z.nativeEnum(RecoveryStrategy),
  actions: z.array(z.string()),
  waitTime: z.number(),
  maxRetries: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export type RecoveryPlan = z.infer<typeof RecoveryPlanSchema>;

const SafetyValidationSchema = z.object({
  canProceed: z.boolean(),
  reason: z.string(),
  requirements: z.array(z.string()).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export type SafetyValidation = z.infer<typeof SafetyValidationSchema>;

const SystemReadinessSchema = z.object({
  ready: z.boolean(),
  score: z.number().min(0).max(100),
  components: z.record(z.boolean()),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type SystemReadiness = z.infer<typeof SystemReadinessSchema>;

// ============================================================================
// Main Unified Error Handler Class
// ============================================================================

export class UnifiedErrorHandler {
  private sensitivePatterns: RegExp[] = [
    /[a-zA-Z0-9]{12,}/g, // API keys and long alphanumeric strings
    /sk-[a-zA-Z0-9]+/g, // Secret keys
    /password[=:]\s*\S+/gi, // Passwords
    /token[=:]\s*\S+/gi, // Tokens
    /secret[=:]\s*\S+/gi, // Secrets
  ];

  /**
   * Classify error by type, severity, and recovery strategy
   */
  classifyError(error: Error): ClassifiedError {
    const message = error.message.toLowerCase();
    const timestamp = new Date().toISOString();

    // Circuit breaker errors
    if (message.includes("circuit breaker") && message.includes("open")) {
      return {
        type: ErrorType.CIRCUIT_BREAKER,
        severity: ErrorSeverity.HIGH,
        recovery: RecoveryStrategy.RESET_CIRCUIT_BREAKER,
        message: error.message,
        originalError: error,
        timestamp,
        metadata: {
          pattern: "circuit_breaker_open",
          canAutoRecover: true,
        },
      };
    }

    // Validation errors
    if (message.includes("validation") || message.includes("invalid")) {
      return {
        type: ErrorType.VALIDATION_ERROR,
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.RETRY_WITH_VALIDATION,
        message: error.message,
        originalError: error,
        timestamp,
        metadata: {
          pattern: "validation_failure",
          canAutoRecover: false,
        },
      };
    }

    // API errors (including rate limits)
    if (message.includes("api") || message.includes("429") || message.includes("rate limit")) {
      return {
        type: ErrorType.API_ERROR,
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        message: error.message,
        originalError: error,
        timestamp,
        metadata: {
          pattern: "api_error",
          canAutoRecover: true,
        },
      };
    }

    // System errors
    if (
      message.includes("database") ||
      message.includes("connection") ||
      message.includes("system")
    ) {
      return {
        type: ErrorType.SYSTEM_ERROR,
        severity: ErrorSeverity.CRITICAL,
        recovery: RecoveryStrategy.FULL_SYSTEM_RESET,
        message: error.message,
        originalError: error,
        timestamp,
        metadata: {
          pattern: "system_failure",
          canAutoRecover: false,
        },
      };
    }

    // Default case
    return {
      type: ErrorType.UNKNOWN_ERROR,
      severity: ErrorSeverity.MEDIUM,
      recovery: RecoveryStrategy.NO_RECOVERY,
      message: error.message,
      originalError: error,
      timestamp,
      metadata: {
        pattern: "unknown",
        canAutoRecover: false,
      },
    };
  }

  /**
   * Sanitize error by removing sensitive information
   */
  sanitizeError(error: Error): SanitizedError {
    let sanitizedMessage = error.message;

    // Remove sensitive patterns
    for (const pattern of this.sensitivePatterns) {
      sanitizedMessage = sanitizedMessage.replace(pattern, "[REDACTED]");
    }

    return {
      message: sanitizedMessage,
      type: error.constructor.name,
      stack: error.stack?.split("\n").slice(0, 5).join("\n"), // Limit stack trace
      code: (error as any).code,
    };
  }

  /**
   * Get recovery strategy for a specific error
   */
  async getRecoveryStrategy(error: Error): Promise<RecoveryPlan> {
    const classified = this.classifyError(error);

    switch (classified.recovery) {
      case RecoveryStrategy.RESET_CIRCUIT_BREAKER:
        return {
          strategy: RecoveryStrategy.RESET_CIRCUIT_BREAKER,
          actions: [
            "Reset circuit breaker state",
            "Validate system health",
            "Perform connectivity test",
            "Resume operations with monitoring",
          ],
          waitTime: 5000, // 5 seconds
          maxRetries: 3,
          metadata: {
            requiresSafetyValidation: true,
            autoExecutable: true,
          },
        };

      case RecoveryStrategy.EXPONENTIAL_BACKOFF:
        return {
          strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
          actions: [
            "Wait for rate limit window",
            "Retry with reduced frequency",
            "Monitor success rate",
          ],
          waitTime: 1000, // Start with 1 second
          maxRetries: 5,
          metadata: {
            backoffMultiplier: 2,
            maxWaitTime: 30000,
          },
        };

      case RecoveryStrategy.RETRY_WITH_VALIDATION:
        return {
          strategy: RecoveryStrategy.RETRY_WITH_VALIDATION,
          actions: [
            "Validate input parameters",
            "Check system configuration",
            "Retry operation with corrected data",
          ],
          waitTime: 500,
          maxRetries: 2,
          metadata: {
            requiresManualIntervention: true,
          },
        };

      case RecoveryStrategy.FULL_SYSTEM_RESET:
        return {
          strategy: RecoveryStrategy.FULL_SYSTEM_RESET,
          actions: [
            "Stop all trading operations",
            "Reset all circuit breakers",
            "Validate system health",
            "Restart services systematically",
          ],
          waitTime: 10000, // 10 seconds
          metadata: {
            requiresManualApproval: true,
            criticalAction: true,
          },
        };

      default:
        return {
          strategy: RecoveryStrategy.NO_RECOVERY,
          actions: ["Log error and alert administrators"],
          waitTime: 0,
          metadata: {
            requiresManualIntervention: true,
          },
        };
    }
  }

  /**
   * Validate safety before attempting recovery
   */
  async validateSafetyBeforeRecovery(circuitBreaker: any): Promise<SafetyValidation> {
    if (circuitBreaker.isOpen()) {
      return {
        canProceed: false,
        reason: "Circuit breaker is open - system is in protective state",
        requirements: [
          "Wait for recovery timeout",
          "Validate system health",
          "Check failure rate trends",
        ],
        riskLevel: "HIGH",
      };
    }

    const stats = circuitBreaker.getStats();
    if (stats.failures > 3) {
      return {
        canProceed: false,
        reason: "High failure rate detected - manual review required",
        requirements: [
          "Investigate root cause of failures",
          "Validate system configuration",
          "Reset failure counters manually",
        ],
        riskLevel: "MEDIUM",
      };
    }

    return {
      canProceed: true,
      reason: "Circuit breaker is healthy",
      riskLevel: "LOW",
    };
  }

  /**
   * Validate overall system readiness
   */
  async validateSystemReadiness(safetyCoordinator: any): Promise<SystemReadiness> {
    const status = safetyCoordinator.getCurrentStatus();
    const components: Record<string, boolean> = {};
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check overall system status
    components.overall = status.overall.systemStatus === "operational";
    if (!components.overall) {
      issues.push("System is not in operational state");
      recommendations.push("Review system configuration and restart services");
    }

    // Check circuit breaker
    components.circuitBreaker = status.circuitBreaker?.state === "CLOSED";
    if (!components.circuitBreaker) {
      issues.push("Circuit breaker is not in closed state");
      recommendations.push("Reset circuit breaker and validate connectivity");
    }

    // Check risk management
    components.riskManagement = status.riskManagement?.level === "LOW";
    if (!components.riskManagement) {
      issues.push("Risk management level is elevated");
      recommendations.push("Review risk parameters and trading positions");
    }

    // Calculate readiness score
    const totalComponents = Object.keys(components).length;
    const healthyComponents = Object.values(components).filter(Boolean).length;
    const score = Math.round((healthyComponents / totalComponents) * 100);

    const ready = score >= 90 && issues.length === 0;

    if (ready) {
      recommendations.push("System is ready for auto-sniping operations");
    } else {
      recommendations.push("Complete all validations before enabling auto-sniping");
    }

    return {
      ready,
      score,
      components,
      issues,
      recommendations,
    };
  }

  /**
   * Reset circuit breaker with safety checks
   */
  async resetCircuitBreakerSafely(circuitBreaker: any): Promise<{
    success: boolean;
    message: string;
    newState?: string;
  }> {
    try {
      // Validate safety before reset
      const safetyCheck = await this.validateSafetyBeforeRecovery(circuitBreaker);

      if (!safetyCheck.canProceed) {
        return {
          success: false,
          message: `Cannot reset circuit breaker: ${safetyCheck.reason}`,
        };
      }

      // Reset the circuit breaker
      circuitBreaker.reset();

      // Wait a moment for state to stabilize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newStats = circuitBreaker.getStats();

      return {
        success: true,
        message: "Circuit breaker reset successfully",
        newState: newStats.state,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset circuit breaker: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
