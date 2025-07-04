/**
 * Protocol Management Module
 *
 * Handles emergency protocols, levels, actions, and validation.
 * Extracted from advanced-emergency-coordinator.ts for better modularity.
 */

export interface EmergencyLevel {
  id: string;
  name: string;
  severity: number; // 1-10 scale
  description: string;
  triggers: string[];
  autoActions: EmergencyAction[];
  escalationThreshold: number;
  deescalationThreshold: number;
  maxDuration: number; // milliseconds
}

export interface EmergencyAction {
  id: string;
  type:
    | "halt_trading"
    | "close_positions"
    | "reduce_exposure"
    | "notify_operators"
    | "system_shutdown"
    | "market_maker_pause";
  priority: number;
  description: string;
  timeout: number;
  retryCount: number;
  rollbackPossible: boolean;
  dependencies: string[];
  conditions: Record<string, any>;
}

export interface EmergencyProtocol {
  id: string;
  name: string;
  triggerConditions: string[];
  levels: EmergencyLevel[];
  coordinationSteps: string[];
  recoveryProcedures: string[];
  communicationPlan: {
    internal: string[];
    external: string[];
    escalation: string[];
  };
  testingSchedule: {
    frequency: string;
    lastTest: string;
    nextTest: string;
  };
}

export class ProtocolManagementModule {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[protocol-management-module]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[protocol-management-module]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[protocol-management-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[protocol-management-module]", message, context || ""),
  };

  private emergencyProtocols: Map<string, EmergencyProtocol> = new Map();

  constructor() {
    this.initializeDefaultProtocols();
  }

  /**
   * Initialize default emergency protocols
   */
  private initializeDefaultProtocols(): void {
    // Critical System Failure Protocol
    this.emergencyProtocols.set("critical_system_failure", {
      id: "critical_system_failure",
      name: "Critical System Failure Response",
      triggerConditions: [
        "system_health < 20%",
        "multiple_service_failures",
        "data_corruption_detected",
      ],
      levels: [
        {
          id: "level_1_assessment",
          name: "Initial Assessment",
          severity: 3,
          description: "Assess system status and contain immediate issues",
          triggers: ["system_health < 50%"],
          autoActions: [
            {
              id: "halt_new_operations",
              type: "halt_trading",
              priority: 1,
              description: "Halt new trading operations",
              timeout: 30000,
              retryCount: 0,
              rollbackPossible: true,
              dependencies: [],
              conditions: {},
            },
          ],
          escalationThreshold: 600000, // 10 minutes
          deescalationThreshold: 300000, // 5 minutes
          maxDuration: 1800000, // 30 minutes
        },
        {
          id: "level_2_containment",
          name: "System Containment",
          severity: 6,
          description: "Contain the failure and prevent spread",
          triggers: ["failure_spreading", "timeout_level_1"],
          autoActions: [
            {
              id: "emergency_shutdown",
              type: "system_shutdown",
              priority: 1,
              description: "Emergency system shutdown",
              timeout: 60000,
              retryCount: 1,
              rollbackPossible: false,
              dependencies: ["halt_new_operations"],
              conditions: {},
            },
          ],
          escalationThreshold: 900000, // 15 minutes
          deescalationThreshold: 600000, // 10 minutes
          maxDuration: 3600000, // 1 hour
        },
      ],
      coordinationSteps: [
        "Assess system impact",
        "Notify stakeholders",
        "Execute containment",
        "Begin recovery procedures",
      ],
      recoveryProcedures: [
        "System health verification",
        "Service restart sequence",
        "Data integrity check",
        "Gradual service restoration",
      ],
      communicationPlan: {
        internal: ["ops_team", "engineering", "management"],
        external: ["customers", "partners"],
        escalation: ["cto", "ceo"],
      },
      testingSchedule: {
        frequency: "monthly",
        lastTest: new Date().toISOString(),
        nextTest: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    // Market Disruption Protocol
    this.emergencyProtocols.set("market_disruption", {
      id: "market_disruption",
      name: "Market Disruption Response",
      triggerConditions: [
        "abnormal_volatility",
        "liquidity_crisis",
        "exchange_issues",
      ],
      levels: [
        {
          id: "level_1_monitoring",
          name: "Enhanced Monitoring",
          severity: 2,
          description: "Increase monitoring and reduce exposure",
          triggers: ["volatility > 15%"],
          autoActions: [
            {
              id: "reduce_position_sizes",
              type: "reduce_exposure",
              priority: 1,
              description: "Reduce position sizes by 50%",
              timeout: 60000,
              retryCount: 2,
              rollbackPossible: true,
              dependencies: [],
              conditions: { max_reduction: 0.5 },
            },
          ],
          escalationThreshold: 300000, // 5 minutes
          deescalationThreshold: 180000, // 3 minutes
          maxDuration: 900000, // 15 minutes
        },
      ],
      coordinationSteps: [
        "Assess market conditions",
        "Reduce exposure",
        "Monitor for stabilization",
      ],
      recoveryProcedures: [
        "Market condition verification",
        "Gradual re-exposure",
        "Performance analysis",
      ],
      communicationPlan: {
        internal: ["trading_team", "risk_management"],
        external: ["key_clients"],
        escalation: ["head_of_trading"],
      },
      testingSchedule: {
        frequency: "quarterly",
        lastTest: new Date().toISOString(),
        nextTest: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    this.logger.info("Default emergency protocols initialized", {
      protocolCount: this.emergencyProtocols.size,
    });
  }

  /**
   * Get emergency protocol by ID
   */
  getProtocol(protocolId: string): EmergencyProtocol | undefined {
    return this.emergencyProtocols.get(protocolId);
  }

  /**
   * Get all emergency protocols
   */
  getAllProtocols(): EmergencyProtocol[] {
    return Array.from(this.emergencyProtocols.values());
  }

  /**
   * Add new emergency protocol
   */
  addProtocol(protocol: EmergencyProtocol): void {
    this.emergencyProtocols.set(protocol.id, protocol);
    this.logger.info("Emergency protocol added", {
      protocolId: protocol.id,
      name: protocol.name,
    });
  }

  /**
   * Remove emergency protocol
   */
  removeProtocol(protocolId: string): boolean {
    const removed = this.emergencyProtocols.delete(protocolId);
    if (removed) {
      this.logger.info("Emergency protocol removed", { protocolId });
    }
    return removed;
  }

  /**
   * Validate emergency protocol
   */
  validateProtocol(protocol: EmergencyProtocol): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (!protocol.id || !protocol.name) {
      errors.push("Protocol must have id and name");
    }

    if (!protocol.levels || protocol.levels.length === 0) {
      errors.push("Protocol must have at least one emergency level");
    }

    // Validate levels
    protocol.levels?.forEach((level, index) => {
      if (!level.id || !level.name) {
        errors.push(`Level ${index} must have id and name`);
      }

      if (level.severity < 1 || level.severity > 10) {
        errors.push(`Level ${index} severity must be between 1 and 10`);
      }

      // Validate actions
      level.autoActions?.forEach((action, actionIndex) => {
        if (!action.id || !action.type) {
          errors.push(
            `Level ${index} action ${actionIndex} must have id and type`
          );
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate all protocols
   */
  async validateAllProtocols(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    for (const [protocolId, protocol] of this.emergencyProtocols) {
      const validation = this.validateProtocol(protocol);
      if (!validation.isValid) {
        issues.push(`Protocol ${protocolId}: ${validation.errors.join(", ")}`);
      }
    }

    this.logger.info("Protocol validation completed", {
      totalProtocols: this.emergencyProtocols.size,
      issuesFound: issues.length,
    });

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get protocol statistics
   */
  getProtocolStatistics(): {
    totalProtocols: number;
    averageLevelsPerProtocol: number;
    totalActions: number;
    protocolsBySeverity: Record<string, number>;
  } {
    const protocols = Array.from(this.emergencyProtocols.values());
    const totalActions = protocols.reduce(
      (sum, protocol) =>
        sum +
        protocol.levels.reduce(
          (levelSum, level) => levelSum + level.autoActions.length,
          0
        ),
      0
    );

    const severityGroups = protocols.reduce(
      (acc, protocol) => {
        const maxSeverity = Math.max(...protocol.levels.map((l) => l.severity));
        const severityRange =
          maxSeverity <= 3 ? "low" : maxSeverity <= 6 ? "medium" : "high";
        acc[severityRange] = (acc[severityRange] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalProtocols: protocols.length,
      averageLevelsPerProtocol:
        protocols.length > 0
          ? protocols.reduce((sum, p) => sum + p.levels.length, 0) /
            protocols.length
          : 0,
      totalActions,
      protocolsBySeverity: severityGroups,
    };
  }

  /**
   * Get protocols by trigger condition
   */
  getProtocolsByTrigger(trigger: string): EmergencyProtocol[] {
    return Array.from(this.emergencyProtocols.values()).filter((protocol) =>
      protocol.triggerConditions.some((condition) =>
        condition.toLowerCase().includes(trigger.toLowerCase())
      )
    );
  }

  /**
   * Get next emergency level for a protocol
   */
  getNextLevel(
    protocolId: string,
    currentLevelId: string
  ): EmergencyLevel | null {
    const protocol = this.emergencyProtocols.get(protocolId);
    if (!protocol) return null;

    const currentIndex = protocol.levels.findIndex(
      (level) => level.id === currentLevelId
    );
    if (currentIndex === -1 || currentIndex >= protocol.levels.length - 1) {
      return null;
    }

    return protocol.levels[currentIndex + 1];
  }

  /**
   * Check if protocol can be escalated
   */
  canEscalate(protocolId: string, currentLevelId: string): boolean {
    return this.getNextLevel(protocolId, currentLevelId) !== null;
  }
}
