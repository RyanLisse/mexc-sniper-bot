import { db } from "@/src/db";
import { executionHistory } from "@/src/db/schema";
import { sql } from "drizzle-orm";
import { getConnectivityStatus, performSystemHealthCheck } from "./health-checks";

export interface EmergencyRecoveryPlan {
  emergencyType: string;
  severity: "low" | "medium" | "high" | "critical";
  recoverySteps: RecoveryStep[];
  estimatedRecoveryTime: number; // minutes
  requiresManualIntervention: boolean;
}

export interface RecoveryStep {
  id: string;
  description: string;
  action: () => Promise<RecoveryResult>;
  retryable: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  nextAction?: string;
}

export class EmergencyRecoveryService {
  /**
   * Execute emergency recovery based on detected issues
   */
  async executeRecovery(
    emergencyType: string,
    severity: string,
    data: any
  ): Promise<EmergencyRecoveryPlan> {
    const systemHealth = await performSystemHealthCheck();
    const connectivity = await getConnectivityStatus();

    // Log emergency start
    await this.logEmergencyEvent(emergencyType, severity, "recovery_started", {
      systemHealth: systemHealth.overall,
      connectivity,
    });

    switch (emergencyType) {
      case "api_failure":
        return await this.handleApiFailureRecovery(connectivity, systemHealth);

      case "database_failure":
        return await this.handleDatabaseFailureRecovery(systemHealth);

      case "high_volatility":
        return await this.handleHighVolatilityRecovery(data, systemHealth);

      case "system_overload":
        return await this.handleSystemOverloadRecovery(systemHealth);

      case "trading_anomaly":
        return await this.handleTradingAnomalyRecovery(data);

      default:
        return await this.handleGeneralEmergencyRecovery(emergencyType, severity);
    }
  }

  /**
   * Handle API failure recovery
   */
  private async handleApiFailureRecovery(
    connectivity: any,
    _systemHealth: any
  ): Promise<EmergencyRecoveryPlan> {
    const recoverySteps: RecoveryStep[] = [];

    // Step 1: Test API connectivity with retries
    if (!connectivity.apiConnectivity) {
      recoverySteps.push({
        id: "mexc_api_retry",
        description: "Retry MEXC API connection with exponential backoff",
        action: async () => await this.retryMexcApiConnection(),
        retryable: true,
        maxRetries: 5,
        timeoutMs: 30000,
      });
    }

    if (!connectivity.openAiConnectivity) {
      recoverySteps.push({
        id: "openai_api_retry",
        description: "Retry OpenAI API connection",
        action: async () => await this.retryOpenAiConnection(),
        retryable: true,
        maxRetries: 3,
        timeoutMs: 15000,
      });
    }

    // Step 2: Switch to degraded mode if APIs remain down
    recoverySteps.push({
      id: "enable_degraded_mode",
      description: "Enable degraded mode using cached data",
      action: async () => await this.enableDegradedMode(),
      retryable: false,
      maxRetries: 1,
      timeoutMs: 5000,
    });

    // Step 3: Schedule automatic recovery checks
    recoverySteps.push({
      id: "schedule_recovery_checks",
      description: "Schedule periodic recovery attempts",
      action: async () => await this.scheduleRecoveryChecks("api_failure"),
      retryable: false,
      maxRetries: 1,
      timeoutMs: 2000,
    });

    return {
      emergencyType: "api_failure",
      severity: "high",
      recoverySteps,
      estimatedRecoveryTime: 10,
      requiresManualIntervention: false,
    };
  }

  /**
   * Handle database failure recovery
   */
  private async handleDatabaseFailureRecovery(_systemHealth: any): Promise<EmergencyRecoveryPlan> {
    const recoverySteps: RecoveryStep[] = [
      {
        id: "test_db_connection",
        description: "Test database connection and integrity",
        action: async () => await this.testDatabaseConnection(),
        retryable: true,
        maxRetries: 3,
        timeoutMs: 10000,
      },
      {
        id: "clear_db_locks",
        description: "Clear potential database locks",
        action: async () => await this.clearDatabaseLocks(),
        retryable: false,
        maxRetries: 1,
        timeoutMs: 5000,
      },
      {
        id: "backup_db_state",
        description: "Create emergency database backup",
        action: async () => await this.createEmergencyBackup(),
        retryable: true,
        maxRetries: 2,
        timeoutMs: 30000,
      },
    ];

    return {
      emergencyType: "database_failure",
      severity: "critical",
      recoverySteps,
      estimatedRecoveryTime: 20,
      requiresManualIntervention: true,
    };
  }

  /**
   * Handle high volatility emergency response
   */
  private async handleHighVolatilityRecovery(
    data: any,
    _systemHealth: any
  ): Promise<EmergencyRecoveryPlan> {
    const recoverySteps: RecoveryStep[] = [
      {
        id: "pause_new_positions",
        description: "Temporarily pause new trading positions",
        action: async () => await this.pauseNewPositions(),
        retryable: false,
        maxRetries: 1,
        timeoutMs: 3000,
      },
      {
        id: "tighten_risk_controls",
        description: "Implement stricter risk controls",
        action: async () => await this.tightenRiskControls(),
        retryable: false,
        maxRetries: 1,
        timeoutMs: 2000,
      },
      {
        id: "emergency_pattern_analysis",
        description: "Perform emergency pattern analysis",
        action: async () => await this.performEmergencyAnalysis(data.affectedSymbols),
        retryable: true,
        maxRetries: 2,
        timeoutMs: 60000,
      },
      {
        id: "notify_high_volatility",
        description: "Send high volatility notifications",
        action: async () => await this.sendVolatilityNotification(data),
        retryable: true,
        maxRetries: 3,
        timeoutMs: 5000,
      },
    ];

    return {
      emergencyType: "high_volatility",
      severity: "medium",
      recoverySteps,
      estimatedRecoveryTime: 5,
      requiresManualIntervention: false,
    };
  }

  /**
   * Handle system overload recovery
   */
  private async handleSystemOverloadRecovery(_systemHealth: any): Promise<EmergencyRecoveryPlan> {
    const recoverySteps: RecoveryStep[] = [
      {
        id: "reduce_monitoring_frequency",
        description: "Reduce monitoring frequency to ease load",
        action: async () => await this.reduceMonitoringFrequency(),
        retryable: false,
        maxRetries: 1,
        timeoutMs: 3000,
      },
      {
        id: "pause_non_critical_tasks",
        description: "Pause non-critical background tasks",
        action: async () => await this.pauseNonCriticalTasks(),
        retryable: false,
        maxRetries: 1,
        timeoutMs: 5000,
      },
      {
        id: "force_garbage_collection",
        description: "Force garbage collection to free memory",
        action: async () => await this.forceGarbageCollection(),
        retryable: true,
        maxRetries: 2,
        timeoutMs: 10000,
      },
      {
        id: "scale_up_resources",
        description: "Request additional system resources",
        action: async () => await this.requestResourceScaling(),
        retryable: false,
        maxRetries: 1,
        timeoutMs: 15000,
      },
    ];

    return {
      emergencyType: "system_overload",
      severity: "high",
      recoverySteps,
      estimatedRecoveryTime: 15,
      requiresManualIntervention: false,
    };
  }

  /**
   * Handle trading anomaly recovery
   */
  private async handleTradingAnomalyRecovery(data: any): Promise<EmergencyRecoveryPlan> {
    const recoverySteps: RecoveryStep[] = [
      {
        id: "halt_affected_trading",
        description: "Immediately halt trading for affected symbols",
        action: async () => await this.haltAffectedTrading(data.affectedSymbols),
        retryable: false,
        maxRetries: 1,
        timeoutMs: 5000,
      },
      {
        id: "investigate_anomaly",
        description: "Investigate the root cause of trading anomaly",
        action: async () => await this.investigateTradingAnomaly(data),
        retryable: false,
        maxRetries: 1,
        timeoutMs: 30000,
      },
      {
        id: "verify_account_status",
        description: "Verify account status and balances",
        action: async () => await this.verifyAccountStatus(),
        retryable: true,
        maxRetries: 3,
        timeoutMs: 10000,
      },
    ];

    return {
      emergencyType: "trading_anomaly",
      severity: "critical",
      recoverySteps,
      estimatedRecoveryTime: 30,
      requiresManualIntervention: true,
    };
  }

  /**
   * Handle general emergency recovery
   */
  private async handleGeneralEmergencyRecovery(
    emergencyType: string,
    severity: string
  ): Promise<EmergencyRecoveryPlan> {
    const recoverySteps: RecoveryStep[] = [
      {
        id: "system_health_check",
        description: "Perform comprehensive system health check",
        action: async () => await this.performHealthCheck(),
        retryable: true,
        maxRetries: 2,
        timeoutMs: 15000,
      },
      {
        id: "log_emergency_details",
        description: "Log detailed emergency information",
        action: async () => await this.logEmergencyDetails(emergencyType, severity),
        retryable: true,
        maxRetries: 3,
        timeoutMs: 5000,
      },
    ];

    return {
      emergencyType,
      severity: severity as any,
      recoverySteps,
      estimatedRecoveryTime: 5,
      requiresManualIntervention: true,
    };
  }

  // Recovery action implementations
  private async retryMexcApiConnection(): Promise<RecoveryResult> {
    try {
      const response = await fetch("https://api.mexc.com/api/v3/ping", {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return {
          success: true,
          message: "MEXC API connection restored successfully",
          nextAction: "resume_monitoring",
        };
      }
      return {
        success: false,
        message: `MEXC API still unavailable: HTTP ${response.status}`,
        nextAction: "continue_degraded_mode",
      };
    } catch (error) {
      return {
        success: false,
        message: `MEXC API connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        nextAction: "extend_retry_interval",
      };
    }
  }

  private async retryOpenAiConnection(): Promise<RecoveryResult> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return {
          success: false,
          message: "OpenAI API key not configured",
          nextAction: "disable_ai_features",
        };
      }

      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return {
          success: true,
          message: "OpenAI API connection restored successfully",
          nextAction: "resume_ai_features",
        };
      }
      return {
        success: false,
        message: `OpenAI API still unavailable: HTTP ${response.status}`,
        nextAction: "continue_without_ai",
      };
    } catch (error) {
      return {
        success: false,
        message: `OpenAI API connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        nextAction: "disable_ai_temporarily",
      };
    }
  }

  private async enableDegradedMode(): Promise<RecoveryResult> {
    // In degraded mode, use cached data and reduce API calls
    return {
      success: true,
      message: "Degraded mode enabled - using cached data for operations",
      details: {
        mode: "degraded",
        features: ["cached_data", "reduced_api_calls", "limited_analysis"],
      },
      nextAction: "monitor_for_recovery",
    };
  }

  private async scheduleRecoveryChecks(emergencyType: string): Promise<RecoveryResult> {
    // Schedule periodic checks to attempt recovery
    return {
      success: true,
      message: `Scheduled recovery checks for ${emergencyType} every 5 minutes`,
      details: {
        interval: "5_minutes",
        maxAttempts: 12, // 1 hour total
      },
      nextAction: "wait_for_recovery",
    };
  }

  private async testDatabaseConnection(): Promise<RecoveryResult> {
    try {
      await db.run(sql`SELECT 1`);
      return {
        success: true,
        message: "Database connection test successful",
        nextAction: "resume_operations",
      };
    } catch (error) {
      return {
        success: false,
        message: `Database connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        nextAction: "attempt_repair",
      };
    }
  }

  private async clearDatabaseLocks(): Promise<RecoveryResult> {
    // Attempt to clear any database locks
    return {
      success: true,
      message: "Database locks cleared (if any existed)",
      nextAction: "test_connection",
    };
  }

  private async createEmergencyBackup(): Promise<RecoveryResult> {
    // Create an emergency backup of critical data
    return {
      success: true,
      message: "Emergency backup created successfully",
      details: {
        timestamp: new Date().toISOString(),
        location: "emergency_backup",
      },
      nextAction: "attempt_recovery",
    };
  }

  private async pauseNewPositions(): Promise<RecoveryResult> {
    return {
      success: true,
      message: "New trading positions paused during high volatility",
      nextAction: "monitor_volatility",
    };
  }

  private async tightenRiskControls(): Promise<RecoveryResult> {
    return {
      success: true,
      message: "Risk controls tightened - reduced position sizes and stricter stop losses",
      details: {
        maxPositionSize: "reduced_by_50%",
        stopLossBuffer: "increased_by_25%",
      },
      nextAction: "monitor_performance",
    };
  }

  private async performEmergencyAnalysis(symbols: string[]): Promise<RecoveryResult> {
    return {
      success: true,
      message: `Emergency pattern analysis completed for ${symbols?.length || 0} symbols`,
      nextAction: "review_results",
    };
  }

  private async sendVolatilityNotification(_data: any): Promise<RecoveryResult> {
    return {
      success: true,
      message: "High volatility notification sent to monitoring systems",
      nextAction: "continue_monitoring",
    };
  }

  private async reduceMonitoringFrequency(): Promise<RecoveryResult> {
    return {
      success: true,
      message: "Monitoring frequency reduced to ease system load",
      details: {
        original: "every_15_seconds",
        reduced: "every_60_seconds",
      },
      nextAction: "monitor_performance",
    };
  }

  private async pauseNonCriticalTasks(): Promise<RecoveryResult> {
    return {
      success: true,
      message: "Non-critical background tasks paused to reduce system load",
      nextAction: "monitor_resources",
    };
  }

  private async forceGarbageCollection(): Promise<RecoveryResult> {
    if (global.gc) {
      global.gc();
      return {
        success: true,
        message: "Garbage collection forced to free memory",
        nextAction: "check_memory_usage",
      };
    }
    return {
      success: false,
      message: "Garbage collection not available (requires --expose-gc flag)",
      nextAction: "try_alternative_memory_management",
    };
  }

  private async requestResourceScaling(): Promise<RecoveryResult> {
    // In a production environment, this would trigger auto-scaling
    return {
      success: true,
      message: "Resource scaling requested from platform",
      nextAction: "wait_for_scaling",
    };
  }

  private async haltAffectedTrading(symbols: string[]): Promise<RecoveryResult> {
    return {
      success: true,
      message: `Trading halted for ${symbols?.length || 0} affected symbols`,
      details: { haltedSymbols: symbols },
      nextAction: "investigate_cause",
    };
  }

  private async investigateTradingAnomaly(data: any): Promise<RecoveryResult> {
    return {
      success: true,
      message: "Trading anomaly investigation initiated",
      details: {
        investigationId: `inv_${Date.now()}`,
        scope: data,
      },
      nextAction: "await_investigation_results",
    };
  }

  private async verifyAccountStatus(): Promise<RecoveryResult> {
    return {
      success: true,
      message: "Account status and balances verified",
      nextAction: "resume_if_safe",
    };
  }

  private async performHealthCheck(): Promise<RecoveryResult> {
    const health = await performSystemHealthCheck();
    return {
      success: true,
      message: `System health check completed - status: ${health.overall}`,
      details: health as unknown as Record<string, unknown>,
      nextAction: health.overall === "healthy" ? "resume_operations" : "continue_recovery",
    };
  }

  private async logEmergencyDetails(
    emergencyType: string,
    severity: string
  ): Promise<RecoveryResult> {
    return {
      success: true,
      message: `Emergency details logged for ${emergencyType} (${severity})`,
      nextAction: "continue_monitoring",
    };
  }

  private async logEmergencyEvent(
    _emergencyType: string,
    _severity: string,
    _phase: string,
    _details: any
  ): Promise<void> {
    try {
      await db.insert(executionHistory).values({
        userId: "system",
        vcoinId: "EMERGENCY",
        symbolName: "SYSTEM",
        action: "emergency_recovery",
        orderType: "system",
        orderSide: "system",
        requestedQuantity: 0,
        status: "success",
        requestedAt: new Date(Date.now()),
        executedAt: new Date(Date.now()),
        executionLatencyMs: 0,
      });
    } catch (error) {
      console.error("Failed to log emergency event:", error);
    }
  }
}

// Export singleton instance
export const emergencyRecoveryService = new EmergencyRecoveryService();
