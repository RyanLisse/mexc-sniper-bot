/**
 * Advanced Emergency Coordinator (Final Refactored)
 *
 * Lean orchestrator that coordinates specialized emergency management modules.
 * Reduced from 1372 lines to under 500 lines through complete modularization.
 *
 * Architecture:
 * - EmergencyProtocolManager: Protocol management and validation
 * - EmergencySessionManager: Session lifecycle and state tracking
 * - EmergencyRecoveryManager: Recovery procedures and verification
 * - EmergencyCommunicationManager: Notifications and communications
 * - EmergencyConfig: Configuration management
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { createTimer } from "@/src/lib/structured-logger";
import { EmergencyCommunicationManager } from "./emergency/emergency-communication";
import { EmergencyConfig } from "./emergency/emergency-config";
// Import all specialized modules
import { EmergencyProtocolManager } from "./emergency/emergency-protocol-manager";
import { EmergencyRecoveryManager } from "./emergency/emergency-recovery-manager";
import { EmergencySessionManager } from "./emergency/emergency-session-manager";

// Import types
import type {
  EmergencyMetrics,
  EmergencyProtocol,
  EmergencySession,
  SystemRecoveryPlan,
} from "./emergency/emergency-types";

// Legacy compatibility exports
export type {
  EmergencyAction,
  EmergencyLevel,
  EmergencyProtocol,
  EmergencySession,
  SystemRecoveryPlan,
} from "./emergency/emergency-types";

export interface AdvancedEmergencyConfig {
  maxConcurrentEmergencies: number;
  emergencySessionTimeout: number;
  autoEscalationEnabled: boolean;
  autoRecoveryEnabled: boolean;
  notificationChannels: string[];
  escalationDelayMs: number;
  maxRetryAttempts: number;
  recoveryVerificationRequired: boolean;
  recoveryTimeout: number;
  rollbackOnFailure: boolean;
  emergencyTestingEnabled: boolean;
  testingFrequencyDays: number;
  validationChecks: string[];
}

/**
 * Advanced Emergency Coordinator - Lean Orchestrator
 *
 * Coordinates emergency management through specialized modules
 */
export class AdvancedEmergencyCoordinator extends BrowserCompatibleEventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info(
        "[advanced-emergency-coordinator-final]",
        message,
        context || ""
      ),
    warn: (message: string, context?: any) =>
      console.warn(
        "[advanced-emergency-coordinator-final]",
        message,
        context || ""
      ),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[advanced-emergency-coordinator-final]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug(
        "[advanced-emergency-coordinator-final]",
        message,
        context || ""
      ),
  };

  // Specialized managers (all extracted)
  private protocolManager: EmergencyProtocolManager;
  private sessionManager: EmergencySessionManager;
  private recoveryManager: EmergencyRecoveryManager;
  private communicationManager: EmergencyCommunicationManager;
  private configManager: EmergencyConfig;

  // System integration
  private emergencySystem: any; // EmergencySafetySystem
  private safetyCoordinator: any; // ComprehensiveSafetyCoordinator

  // State tracking
  private isInitialized = false;
  private coordinatorMetrics = {
    totalEmergencies: 0,
    successfulResolutions: 0,
    averageResolutionTime: 0,
    autoRecoveries: 0,
    manualInterventions: 0,
  };

  constructor(
    config: Partial<AdvancedEmergencyConfig>,
    emergencySystem?: any,
    safetyCoordinator?: any
  ) {
    super();

    // Initialize configuration manager
    this.configManager = new EmergencyConfig(config);

    // Initialize all specialized managers
    this.initializeManagers();

    // Store system dependencies
    this.emergencySystem = emergencySystem;
    this.safetyCoordinator = safetyCoordinator;

    this.logger.info("Advanced emergency coordinator initialized", {
      config: this.configManager.getConfig(),
      managersCount: 5,
    });
  }

  /**
   * Initialize all specialized managers
   */
  private initializeManagers(): void {
    const config = this.configManager.getConfig();

    // Initialize protocol manager
    this.protocolManager = new EmergencyProtocolManager();

    // Initialize session manager
    this.sessionManager = new EmergencySessionManager();

    // Initialize recovery manager
    this.recoveryManager = new EmergencyRecoveryManager();

    // Initialize communication manager
    this.communicationManager = new EmergencyCommunicationManager({
      channels: config.notificationChannels,
      escalationDelayMs: config.escalationDelayMs,
      maxRetryAttempts: config.maxRetryAttempts,
    });

    // Setup inter-manager event handling
    this.setupManagerEventHandling();
  }

  /**
   * Setup event handling between managers
   */
  private setupManagerEventHandling(): void {
    // Session events
    this.sessionManager.on("session_created", (session: EmergencySession) => {
      this.communicationManager.sendEmergencyNotification(
        "Emergency session activated",
        session.protocolId,
        "info"
      );
      this.emit("emergency_activated", session);
    });

    this.sessionManager.on("session_escalated", (session: EmergencySession) => {
      this.communicationManager.sendEmergencyNotification(
        "Emergency escalated",
        session.protocolId,
        "warning"
      );
      this.emit("emergency_escalated", session);
    });

    this.sessionManager.on("session_resolved", (session: EmergencySession) => {
      this.coordinatorMetrics.successfulResolutions++;
      this.communicationManager.sendEmergencyNotification(
        "Emergency resolved",
        session.protocolId,
        "success"
      );
      this.emit("emergency_resolved", session);
    });

    // Recovery events
    this.recoveryManager.on("recovery_started", (sessionId: string) => {
      this.emit("recovery_started", sessionId);
    });

    this.recoveryManager.on("recovery_completed", (sessionId: string) => {
      this.coordinatorMetrics.autoRecoveries++;
      this.emit("recovery_completed", sessionId);
    });
  }

  /**
   * Initialize the emergency coordinator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn("Emergency coordinator already initialized");
      return;
    }

    try {
      // Validate all protocols through protocol manager
      const validation = await this.protocolManager.validateAllProtocols();
      if (!validation.valid) {
        throw new Error(
          `Protocol validation failed: ${validation.errors.join(", ")}`
        );
      }

      // Initialize system integration if available
      if (this.emergencySystem && this.safetyCoordinator) {
        await this.setupSystemIntegration();
      }

      // Start periodic testing if enabled
      if (this.configManager.getConfig().emergencyTestingEnabled) {
        this.schedulePeriodicTesting();
      }

      this.isInitialized = true;

      this.logger.info(
        "Advanced emergency coordinator initialization completed",
        {
          protocolsValidated: this.protocolManager.getMetrics().totalProtocols,
          testingEnabled:
            this.configManager.getConfig().emergencyTestingEnabled,
        }
      );

      this.emit("coordinator_initialized");
    } catch (error) {
      this.logger.error(
        "Emergency coordinator initialization failed",
        { error },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Activate emergency protocol
   */
  async activateEmergencyProtocol(
    protocolId: string,
    triggeredBy: string,
    reason: string,
    context?: Record<string, any>
  ): Promise<string> {
    const timer = createTimer(
      "activate_emergency_protocol",
      "advanced-emergency-coordinator-final"
    );

    try {
      // Validate protocol exists through protocol manager
      const protocol = this.protocolManager.getProtocol(protocolId);
      if (!protocol) {
        throw new Error(`Emergency protocol not found: ${protocolId}`);
      }

      // Check concurrent emergency limit
      const config = this.configManager.getConfig();
      const activeSessions = this.sessionManager.getActiveSessions();
      if (activeSessions.length >= config.maxConcurrentEmergencies) {
        throw new Error("Maximum concurrent emergencies reached");
      }

      // Create emergency session through session manager
      const sessionId = await this.sessionManager.createSession({
        protocolId,
        triggeredBy,
        reason,
        context,
      });

      this.coordinatorMetrics.totalEmergencies++;

      this.logger.info("Emergency protocol activated", {
        sessionId,
        protocolId,
        triggeredBy,
        reason,
        activeEmergencies: activeSessions.length + 1,
      });

      timer.stop();
      return sessionId;
    } catch (error) {
      timer.stop();
      this.logger.error(
        "Failed to activate emergency protocol",
        { protocolId, error },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Escalate emergency session
   */
  async escalateEmergency(sessionId: string, reason?: string): Promise<void> {
    try {
      await this.sessionManager.escalateSession(sessionId, reason);

      this.logger.info("Emergency escalated", { sessionId, reason });
    } catch (error) {
      this.logger.error(
        "Failed to escalate emergency",
        { sessionId, error },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Resolve emergency session
   */
  async resolveEmergency(
    sessionId: string,
    method: "automatic" | "manual",
    verifiedBy: string,
    notes?: string
  ): Promise<void> {
    try {
      // Resolve session through session manager
      await this.sessionManager.resolveSession(sessionId, {
        method,
        verifiedBy,
        notes: notes || "",
      });

      // Start recovery if auto-recovery is enabled
      const config = this.configManager.getConfig();
      if (config.autoRecoveryEnabled) {
        await this.recoveryManager.startRecovery(sessionId);
      }

      this.logger.info("Emergency resolved", { sessionId, method, verifiedBy });
    } catch (error) {
      this.logger.error(
        "Failed to resolve emergency",
        { sessionId, error },
        error as Error
      );
      throw error;
    }
  }

  /**
   * Execute emergency drill
   */
  async executeEmergencyDrill(protocolId: string): Promise<{
    success: boolean;
    duration: number;
    issues: string[];
  }> {
    const startTime = Date.now();

    try {
      // Test protocol through protocol manager
      const protocolTest = await this.protocolManager.testProtocol(protocolId);

      // Test communication systems
      const commTest =
        await this.communicationManager.testCommunicationSystems();

      const duration = Date.now() - startTime;
      const issues = [...protocolTest.issues];

      if (!commTest.success) {
        issues.push("Communication system test failed");
      }

      const success = protocolTest.success && commTest.success;

      this.logger.info("Emergency drill completed", {
        protocolId,
        success,
        duration,
        issuesCount: issues.length,
      });

      return { success, duration, issues };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        "Emergency drill failed",
        { protocolId, error },
        error as Error
      );

      return {
        success: false,
        duration,
        issues: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Setup system integration
   */
  private async setupSystemIntegration(): Promise<void> {
    if (this.emergencySystem?.on) {
      this.emergencySystem.on("emergency-triggered", async (emergency: any) => {
        // Map emergency to protocol through protocol manager
        const protocols = this.protocolManager.getAllProtocols();
        let protocolId: string | null = null;

        for (const [id, protocol] of protocols) {
          if (
            protocol.triggerConditions.some((condition) =>
              emergency.triggers?.includes(condition)
            )
          ) {
            protocolId = id;
            break;
          }
        }

        if (protocolId) {
          await this.activateEmergencyProtocol(
            protocolId,
            "system_integration",
            emergency.reason || "System-triggered emergency"
          );
        }
      });
    }
  }

  /**
   * Schedule periodic testing
   */
  private schedulePeriodicTesting(): void {
    const config = this.configManager.getConfig();
    const interval = config.testingFrequencyDays * 24 * 60 * 60 * 1000;

    setInterval(async () => {
      try {
        const protocols = this.protocolManager.getAllProtocols();
        for (const [protocolId] of protocols) {
          await this.executeEmergencyDrill(protocolId);
        }
      } catch (error) {
        this.logger.error("Periodic testing failed", { error }, error as Error);
      }
    }, interval);
  }

  // ============================================================================
  // Public API (Delegated to Managers)
  // ============================================================================

  /**
   * Get emergency protocols
   */
  getEmergencyProtocols(): Map<string, EmergencyProtocol> {
    return this.protocolManager.getAllProtocols();
  }

  /**
   * Get active emergency sessions
   */
  getActiveEmergencySessions(): EmergencySession[] {
    return this.sessionManager.getActiveSessions();
  }

  /**
   * Get coordinator metrics
   */
  getCoordinatorMetrics(): typeof this.coordinatorMetrics & {
    protocolMetrics: ReturnType<EmergencyProtocolManager["getMetrics"]>;
    sessionMetrics: EmergencyMetrics;
  } {
    return {
      ...this.coordinatorMetrics,
      protocolMetrics: this.protocolManager.getMetrics(),
      sessionMetrics: this.sessionManager.getGlobalMetrics(),
    };
  }

  /**
   * Get recovery plans
   */
  getRecoveryPlans(): Map<string, SystemRecoveryPlan> {
    return this.recoveryManager.getRecoveryPlans();
  }

  /**
   * Test communication systems
   */
  async testCommunicationSystems(): Promise<{
    success: boolean;
    results: any[];
  }> {
    return await this.communicationManager.testCommunicationSystems();
  }

  /**
   * Emergency system lifecycle
   */
  async startEmergencySystem(): Promise<void> {
    await this.initialize();
  }

  async stopEmergencySystem(): Promise<void> {
    // Gracefully stop all active sessions
    const activeSessions = this.sessionManager.getActiveSessions();
    for (const session of activeSessions) {
      await this.resolveEmergency(
        session.id,
        "manual",
        "system_shutdown",
        "System shutdown initiated"
      );
    }

    this.logger.info("Emergency system stopped");
    this.emit("coordinator_stopped");
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return (
      this.isInitialized &&
      this.protocolManager !== null &&
      this.sessionManager !== null &&
      this.recoveryManager !== null &&
      this.communicationManager !== null
    );
  }
}
