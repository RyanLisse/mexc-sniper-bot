/**
 * Emergency Management Module
 *
 * Handles emergency protocols, shutdown procedures, and crisis response.
 * Provides centralized emergency coordination with automated responses.
 */

import { EventEmitter } from "events";
import type {
  AgentConsensusRequest,
  SafetyMonitorAgent,
} from "../../mexc-agents/safety-monitor-agent";
import type { EmergencySafetySystem } from "../emergency-safety-system";
import type { SafetyAlertsManager } from "./safety-alerts";
import type { EmergencyLevel, SafetyCoordinatorConfig, SafetyMetrics } from "./safety-types";

export interface EmergencyProcedure {
  id: string;
  name: string;
  description: string;
  triggerConditions: string[];
  automaticExecution: boolean;
  requiredApprovals: string[];
  steps: EmergencyStep[];
  priority: number;
}

export interface EmergencyStep {
  id: string;
  name: string;
  action: string;
  timeout: number;
  critical: boolean;
  rollbackPossible: boolean;
}

export interface EmergencyState {
  level: EmergencyLevel;
  activeIncidents: number;
  tradingHalted: boolean;
  lastAction: string | null;
  timestamp: string;
  procedures: string[];
}

export class EmergencyManager extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[emergency-management]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[emergency-management]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[emergency-management]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[emergency-management]", message, context || ""),
  };

  private emergencyState: EmergencyState;
  private activeProcedures: Map<string, EmergencyProcedure> = new Map();
  private procedureHistory: any[] = [];

  constructor(
    private config: SafetyCoordinatorConfig,
    private emergencySystem: EmergencySafetySystem,
    private safetyMonitor: SafetyMonitorAgent,
    private alertsManager: SafetyAlertsManager,
    private metrics: SafetyMetrics
  ) {
    super();

    this.emergencyState = {
      level: "none",
      activeIncidents: 0,
      tradingHalted: false,
      lastAction: null,
      timestamp: new Date().toISOString(),
      procedures: [],
    };

    this.setupEmergencyProcedures();
  }

  /**
   * Get current emergency state
   */
  getEmergencyState(): EmergencyState {
    return { ...this.emergencyState };
  }

  /**
   * Execute emergency shutdown
   */
  async executeEmergencyShutdown(reason: string, userId: string): Promise<boolean> {
    console.info(`[EmergencyManager] Executing emergency shutdown: ${reason}`);

    try {
      // Update emergency state
      this.emergencyState.level = "critical";
      this.emergencyState.activeIncidents += 1;
      this.emergencyState.tradingHalted = true;
      this.emergencyState.lastAction = `Emergency shutdown: ${reason}`;
      this.emergencyState.timestamp = new Date().toISOString();

      // Trigger emergency system
      await this.emergencySystem.forceEmergencyHalt(reason);

      // Create critical alert
      await this.alertsManager.createAlert({
        type: "emergency_condition",
        severity: "critical",
        title: "Emergency Shutdown Executed",
        message: `Emergency shutdown initiated: ${reason}`,
        source: "emergency_manager",
        actions: ["All trading halted", "Manual intervention required"],
        metadata: { reason, executedBy: userId },
      });

      // Record emergency action
      await this.recordEmergencyAction({
        type: "emergency_shutdown",
        reason,
        executedBy: userId,
        success: true,
        impact: "All trading operations halted",
        timestamp: new Date().toISOString(),
      });

      // Emit emergency event
      this.emit("emergency_shutdown", {
        reason,
        userId,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error("[EmergencyManager] Emergency shutdown failed:", error);

      await this.alertsManager.createAlert({
        type: "system_degradation",
        severity: "critical",
        title: "Emergency Shutdown Failed",
        message: `Failed to execute emergency shutdown: ${error}`,
        source: "emergency_manager",
        actions: ["Manual intervention required"],
        metadata: { error: String(error) },
      });

      return false;
    }
  }

  /**
   * Request agent consensus for critical decision
   */
  async requestConsensus(request: AgentConsensusRequest): Promise<any> {
    try {
      const response = await this.safetyMonitor.requestAgentConsensus(request);

      // Update consensus metrics
      this.metrics.consensusMetrics.averageProcessingTime =
        (this.metrics.consensusMetrics.averageProcessingTime + response.processingTime) / 2;
      this.metrics.consensusMetrics.approvalRate =
        (this.metrics.consensusMetrics.approvalRate + response.consensus.approvalRate) / 2;

      // Create alert if consensus failed
      if (!response.consensus.achieved) {
        await this.alertsManager.createAlert({
          type: "consensus_failure",
          severity: "high",
          title: "Consensus Failed",
          message: `Failed to achieve consensus for ${request.type}`,
          source: "consensus_system",
          actions: ["Review consensus requirements", "Manual approval may be required"],
          metadata: { request, response },
        });
      }

      return response;
    } catch (error) {
      console.error("[EmergencyManager] Consensus request failed:", error);
      throw error;
    }
  }

  /**
   * Escalate emergency level
   */
  async escalateEmergency(currentLevel: EmergencyLevel, reason: string): Promise<EmergencyLevel> {
    const levels: EmergencyLevel[] = ["none", "low", "medium", "high", "critical"];
    const currentIndex = levels.indexOf(currentLevel);
    const newLevel = levels[Math.min(currentIndex + 1, levels.length - 1)];

    if (newLevel !== currentLevel) {
      this.emergencyState.level = newLevel;
      this.emergencyState.timestamp = new Date().toISOString();

      await this.alertsManager.createAlert({
        type: "emergency_condition",
        severity: newLevel === "critical" ? "critical" : "high",
        title: `Emergency Level Escalated to ${newLevel.toUpperCase()}`,
        message: `Emergency level escalated from ${currentLevel} to ${newLevel}: ${reason}`,
        source: "emergency_manager",
        actions: ["Review emergency procedures", "Consider additional safety measures"],
        metadata: { previousLevel: currentLevel, newLevel, reason },
      });

      this.emit("emergency_escalated", {
        previousLevel: currentLevel,
        newLevel,
        reason,
        timestamp: new Date().toISOString(),
      });
    }

    return newLevel;
  }

  /**
   * De-escalate emergency level
   */
  async deescalateEmergency(currentLevel: EmergencyLevel, reason: string): Promise<EmergencyLevel> {
    const levels: EmergencyLevel[] = ["none", "low", "medium", "high", "critical"];
    const currentIndex = levels.indexOf(currentLevel);
    const newLevel = levels[Math.max(currentIndex - 1, 0)];

    if (newLevel !== currentLevel) {
      this.emergencyState.level = newLevel;
      this.emergencyState.timestamp = new Date().toISOString();

      if (newLevel === "none") {
        this.emergencyState.activeIncidents = 0;
        this.emergencyState.tradingHalted = false;
      }

      await this.alertsManager.createAlert({
        type: "emergency_condition",
        severity: "medium",
        title: `Emergency Level Reduced to ${newLevel.toUpperCase()}`,
        message: `Emergency level reduced from ${currentLevel} to ${newLevel}: ${reason}`,
        source: "emergency_manager",
        actions: ["Continue monitoring", "Review system stability"],
        metadata: { previousLevel: currentLevel, newLevel, reason },
      });

      this.emit("emergency_deescalated", {
        previousLevel: currentLevel,
        newLevel,
        reason,
        timestamp: new Date().toISOString(),
      });
    }

    return newLevel;
  }

  /**
   * Execute emergency procedure by ID
   */
  async executeProcedure(procedureId: string, executedBy: string): Promise<boolean> {
    const procedure = this.getEmergencyProcedure(procedureId);
    if (!procedure) {
      throw new Error(`Emergency procedure not found: ${procedureId}`);
    }

    console.info(`[EmergencyManager] Executing procedure: ${procedure.name}`);

    try {
      // Check if consensus is required
      if (procedure.requiredApprovals.length > 0) {
        const consensusRequest: AgentConsensusRequest = {
          id: `emergency-${procedureId}-${Date.now()}`,
          type: "emergency_procedure",
          priority: "critical",
          requester: "emergency_manager",
          data: { procedure, executedBy },
          timeoutMs: 30000, // 30 seconds for emergency decisions
        };

        const consensus = await this.requestConsensus(consensusRequest);
        if (!consensus.consensus.achieved) {
          throw new Error("Emergency procedure consensus not achieved");
        }
      }

      // Execute procedure steps
      for (const step of procedure.steps) {
        await this.executeEmergencyStep(step, procedure.id);
      }

      // Record successful execution
      await this.recordEmergencyAction({
        type: "procedure_execution",
        reason: `Executed procedure: ${procedure.name}`,
        executedBy,
        success: true,
        impact: `Procedure ${procedure.name} completed successfully`,
        timestamp: new Date().toISOString(),
      });

      this.emit("procedure_executed", {
        procedure,
        executedBy,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error(`[EmergencyManager] Procedure execution failed:`, error);

      await this.alertsManager.createAlert({
        type: "emergency_condition",
        severity: "critical",
        title: `Emergency Procedure Failed: ${procedure.name}`,
        message: `Failed to execute emergency procedure: ${error}`,
        source: "emergency_manager",
        actions: ["Manual intervention required", "Review procedure configuration"],
        metadata: { procedure, error: String(error) },
      });

      return false;
    }
  }

  /**
   * Get available emergency procedures
   */
  getEmergencyProcedures(): EmergencyProcedure[] {
    return Array.from(this.activeProcedures.values());
  }

  /**
   * Get emergency procedure by ID
   */
  getEmergencyProcedure(id: string): EmergencyProcedure | undefined {
    return this.activeProcedures.get(id);
  }

  /**
   * Check if emergency conditions are met
   */
  assessEmergencyConditions(): {
    emergencyTriggered: boolean;
    level: EmergencyLevel;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let level: EmergencyLevel = "none";

    // Check for critical system conditions
    if (this.metrics.systemMetrics.availability < 0.95) {
      reasons.push("System availability below 95%");
      level = "medium";
    }

    if (this.metrics.riskMetrics.averageRiskScore > 90) {
      reasons.push("Risk score above critical threshold");
      level = "high";
    }

    if (this.metrics.agentMetrics.anomalyRate > 0.5) {
      reasons.push("High agent anomaly rate detected");
      level = "high";
    }

    if (this.alertsManager.getAlertsBySeverity("critical").length > 3) {
      reasons.push("Multiple critical alerts active");
      level = "critical";
    }

    return {
      emergencyTriggered: level !== "none",
      level,
      reasons,
    };
  }

  /**
   * Setup default emergency procedures
   */
  private setupEmergencyProcedures(): void {
    const procedures: EmergencyProcedure[] = [
      {
        id: "immediate_halt",
        name: "Immediate Trading Halt",
        description: "Immediately halt all trading operations",
        triggerConditions: ["critical_risk_breach", "system_failure"],
        automaticExecution: true,
        requiredApprovals: [],
        steps: [
          {
            id: "halt_trading",
            name: "Halt Trading",
            action: "emergency_system.haltTrading",
            timeout: 5000,
            critical: true,
            rollbackPossible: false,
          },
        ],
        priority: 1,
      },
      {
        id: "controlled_shutdown",
        name: "Controlled System Shutdown",
        description: "Gracefully shutdown all system components",
        triggerConditions: ["maintenance_required", "security_breach"],
        automaticExecution: false,
        requiredApprovals: ["safety_officer", "system_admin"],
        steps: [
          {
            id: "stop_new_orders",
            name: "Stop New Orders",
            action: "trading_system.stopNewOrders",
            timeout: 10000,
            critical: false,
            rollbackPossible: true,
          },
          {
            id: "close_positions",
            name: "Close Open Positions",
            action: "trading_system.closePositions",
            timeout: 30000,
            critical: true,
            rollbackPossible: false,
          },
        ],
        priority: 2,
      },
    ];

    for (const procedure of procedures) {
      this.activeProcedures.set(procedure.id, procedure);
    }
  }

  /**
   * Execute an emergency step
   */
  private async executeEmergencyStep(step: EmergencyStep, procedureId: string): Promise<void> {
    console.info(`[EmergencyManager] Executing step: ${step.name}`);

    // Add timeout wrapper
    const executeWithTimeout = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Step timeout: ${step.name}`));
      }, step.timeout);

      // Execute the actual step action
      this.executeStepAction(step.action)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });

    await executeWithTimeout;
  }

  /**
   * Execute a step action (placeholder implementation)
   */
  private async executeStepAction(action: string): Promise<void> {
    // This would contain the actual implementation of various emergency actions
    console.info(`[EmergencyManager] Executing action: ${action}`);

    // For now, just simulate the action
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Record emergency action
   */
  private async recordEmergencyAction(action: {
    type: string;
    reason: string;
    executedBy: string;
    success: boolean;
    impact: string;
    timestamp: string;
  }): Promise<void> {
    this.procedureHistory.push(action);

    // Keep only last 100 actions
    if (this.procedureHistory.length > 100) {
      this.procedureHistory = this.procedureHistory.slice(-100);
    }

    console.info(`[EmergencyManager] Recorded action: ${action.type} - ${action.reason}`);
  }
}
