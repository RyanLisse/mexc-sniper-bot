/**
 * Emergency Protocol Manager
 * 
 * Manages emergency protocol definitions, initialization, and validation.
 * Handles the complex protocol configurations extracted from the main coordinator.
 */

import type { 
  CommunicationPlan,
  EmergencyAction,
  EmergencyLevel, 
  EmergencyProtocol, 
  EscalationRule,
  RecoveryCheckpoint
} from './emergency-types';

/**
 * Protocol manager for emergency response procedures
 */
export class EmergencyProtocolManager {
  private protocols: Map<string, EmergencyProtocol> = new Map();
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[emergency-protocol-manager]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[emergency-protocol-manager]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[emergency-protocol-manager]", message, context || "", error || ""),
  };

  constructor() {
    this.initializeDefaultProtocols();
  }

  /**
   * Get all protocols
   */
  getAllProtocols(): Map<string, EmergencyProtocol> {
    return new Map(this.protocols);
  }

  /**
   * Get specific protocol
   */
  getProtocol(protocolId: string): EmergencyProtocol | undefined {
    return this.protocols.get(protocolId);
  }

  /**
   * Add or update protocol
   */
  setProtocol(protocol: EmergencyProtocol): void {
    const validation = this.validateProtocol(protocol);
    if (!validation.valid) {
      throw new Error(`Invalid protocol: ${validation.errors.join(', ')}`);
    }

    this.protocols.set(protocol.id, protocol);
    this.logger.info("Protocol added/updated", { protocolId: protocol.id });
  }

  /**
   * Remove protocol
   */
  removeProtocol(protocolId: string): boolean {
    const removed = this.protocols.delete(protocolId);
    if (removed) {
      this.logger.info("Protocol removed", { protocolId });
    }
    return removed;
  }

  /**
   * Validate all protocols
   */
  async validateAllProtocols(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const [id, protocol] of this.protocols) {
      const validation = this.validateProtocol(protocol);
      if (!validation.valid) {
        errors.push(`Protocol ${id}: ${validation.errors.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate individual protocol
   */
  private validateProtocol(protocol: EmergencyProtocol): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!protocol.id) errors.push("Protocol ID is required");
    if (!protocol.name) errors.push("Protocol name is required");
    if (!protocol.triggerConditions || protocol.triggerConditions.length === 0) {
      errors.push("Protocol must have trigger conditions");
    }

    // Validate emergency levels
    if (!protocol.emergencyLevels || protocol.emergencyLevels.length === 0) {
      errors.push("Protocol must have at least one emergency level");
    } else {
      protocol.emergencyLevels.forEach((level, index) => {
        const levelErrors = this.validateEmergencyLevel(level);
        if (levelErrors.length > 0) {
          errors.push(`Level ${index}: ${levelErrors.join(', ')}`);
        }
      });
    }

    // Validate escalation rules
    if (protocol.escalationRules) {
      protocol.escalationRules.forEach((rule, index) => {
        const ruleErrors = this.validateEscalationRule(rule, protocol.emergencyLevels);
        if (ruleErrors.length > 0) {
          errors.push(`Escalation rule ${index}: ${ruleErrors.join(', ')}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate emergency level
   */
  private validateEmergencyLevel(level: EmergencyLevel): string[] {
    const errors: string[] = [];

    if (!level.id) errors.push("Level ID is required");
    if (!level.name) errors.push("Level name is required");
    if (typeof level.severity !== 'number' || level.severity < 1 || level.severity > 10) {
      errors.push("Severity must be a number between 1 and 10");
    }

    // Validate actions
    if (level.autoActions) {
      level.autoActions.forEach((action, index) => {
        const actionErrors = this.validateEmergencyAction(action);
        if (actionErrors.length > 0) {
          errors.push(`Action ${index}: ${actionErrors.join(', ')}`);
        }
      });
    }

    return errors;
  }

  /**
   * Validate emergency action
   */
  private validateEmergencyAction(action: EmergencyAction): string[] {
    const errors: string[] = [];

    if (!action.id) errors.push("Action ID is required");
    if (!action.type) errors.push("Action type is required");
    if (typeof action.priority !== 'number') errors.push("Priority must be a number");
    if (typeof action.timeout !== 'number' || action.timeout <= 0) {
      errors.push("Timeout must be a positive number");
    }

    const validTypes = [
      "halt_trading",
      "close_positions", 
      "reduce_exposure",
      "notify_operators",
      "system_shutdown",
      "market_maker_pause"
    ];
    
    if (!validTypes.includes(action.type)) {
      errors.push(`Invalid action type: ${action.type}`);
    }

    return errors;
  }

  /**
   * Validate escalation rule
   */
  private validateEscalationRule(rule: EscalationRule, levels: EmergencyLevel[]): string[] {
    const errors: string[] = [];

    if (!rule.fromLevel) errors.push("From level is required");
    if (!rule.toLevel) errors.push("To level is required");

    // Check if levels exist
    const levelIds = levels.map(l => l.id);
    if (!levelIds.includes(rule.fromLevel)) {
      errors.push(`From level '${rule.fromLevel}' does not exist`);
    }
    if (!levelIds.includes(rule.toLevel)) {
      errors.push(`To level '${rule.toLevel}' does not exist`);
    }

    if (typeof rule.timeout !== 'number' || rule.timeout <= 0) {
      errors.push("Timeout must be a positive number");
    }

    return errors;
  }

  /**
   * Initialize default emergency protocols
   */
  private initializeDefaultProtocols(): void {
    // System Failure Protocol
    this.protocols.set("system_failure", {
      id: "system_failure",
      name: "System Failure Response",
      triggerConditions: ["system_error", "service_unavailable", "timeout_exceeded"],
      requiredApprovals: ["operations_manager"],
      emergencyLevels: [
        {
          id: "level_1_assessment",
          name: "Initial Assessment",
          severity: 3,
          description: "Assess the failure and begin containment",
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
      escalationRules: [
        {
          fromLevel: "level_1_assessment",
          toLevel: "level_2_containment",
          conditions: ["timeout_exceeded", "failure_spreading"],
          timeout: 600000,
          autoEscalate: true,
        },
      ],
      communicationPlan: {
        channels: ["slack", "email"],
        stakeholders: ["operations_team", "engineering_team"],
        templates: {
          activated: "System failure protocol activated. Level: {level}. Reason: {reason}",
          escalated: "Emergency escalated to {level}. Action required.",
          resolved: "System failure resolved. Recovery verified."
        },
        escalationContacts: ["senior_management", "board"],
      },
      recoveryChecklist: [
        {
          id: "system_health_verification",
          name: "System Health Check",
          description: "Verify all systems are operational",
          verificationMethod: "automated_health_check",
          autoVerifiable: true,
          priority: 1,
          dependencies: [],
        },
        {
          id: "data_integrity_check",
          name: "Data Integrity Verification",
          description: "Ensure data consistency and integrity",
          verificationMethod: "data_validation_suite",
          autoVerifiable: true,
          priority: 2,
          dependencies: ["system_health_verification"],
        },
      ],
      testingSchedule: {
        frequency: "monthly",
        lastTest: Date.now(),
        nextTest: Date.now() + 30 * 24 * 60 * 60 * 1000,
      },
    });

    // Market Crisis Protocol
    this.protocols.set("market_crisis", {
      id: "market_crisis",
      name: "Market Crisis Response",
      triggerConditions: ["market_volatility > 50%", "liquidity_crisis", "flash_crash_detected"],
      requiredApprovals: ["risk_manager", "cto"],
      emergencyLevels: [
        {
          id: "level_1_monitoring",
          name: "Enhanced Monitoring",
          severity: 2,
          description: "Increase monitoring and reduce exposure",
          triggers: ["volatility_spike", "unusual_market_activity"],
          autoActions: [
            {
              id: "reduce_exposure",
              type: "reduce_exposure",
              priority: 1,
              description: "Reduce market exposure by 50%",
              timeout: 120000,
              retryCount: 2,
              rollbackPossible: true,
              dependencies: [],
              conditions: { reduction_percentage: 50 },
            },
          ],
          escalationThreshold: 300000, // 5 minutes
          deescalationThreshold: 900000, // 15 minutes
          maxDuration: 1800000, // 30 minutes
        },
        {
          id: "level_2_protection",
          name: "Portfolio Protection",
          severity: 5,
          description: "Close positions and halt trading",
          triggers: ["continued_volatility", "major_market_event"],
          autoActions: [
            {
              id: "close_positions",
              type: "close_positions",
              priority: 1,
              description: "Close all open positions",
              timeout: 180000,
              retryCount: 3,
              rollbackPossible: false,
              dependencies: ["reduce_exposure"],
              conditions: { position_type: "all" },
            },
            {
              id: "halt_trading",
              type: "halt_trading",
              priority: 2,
              description: "Halt all trading activities",
              timeout: 60000,
              retryCount: 1,
              rollbackPossible: true,
              dependencies: ["close_positions"],
              conditions: {},
            },
          ],
          escalationThreshold: 600000, // 10 minutes
          deescalationThreshold: 1800000, // 30 minutes
          maxDuration: 7200000, // 2 hours
        },
      ],
      escalationRules: [
        {
          fromLevel: "level_1_monitoring",
          toLevel: "level_2_protection",
          conditions: ["continued_volatility", "position_losses_exceed_threshold"],
          timeout: 300000,
          autoEscalate: true,
        },
      ],
      communicationPlan: {
        channels: ["slack", "email", "sms"],
        stakeholders: ["trading_team", "risk_team", "management"],
        templates: {
          activated: "Market crisis protocol activated. Market conditions: {conditions}",
          escalated: "Market crisis escalated to {level}. Portfolio protection engaged.",
          resolved: "Market crisis resolved. Normal operations resumed."
        },
        escalationContacts: ["cfo", "ceo"],
      },
      recoveryChecklist: [
        {
          id: "market_stabilization",
          name: "Market Condition Check",
          description: "Verify market conditions have stabilized",
          verificationMethod: "volatility_analysis",
          autoVerifiable: true,
          priority: 1,
          dependencies: [],
        },
        {
          id: "portfolio_review",
          name: "Portfolio Impact Assessment",
          description: "Review portfolio impact and losses",
          verificationMethod: "manual_review",
          autoVerifiable: false,
          priority: 2,
          dependencies: ["market_stabilization"],
        },
      ],
      testingSchedule: {
        frequency: "weekly",
        lastTest: Date.now(),
        nextTest: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
    });

    // Security Breach Protocol
    this.protocols.set("security_breach", {
      id: "security_breach",
      name: "Security Breach Response",
      triggerConditions: ["unauthorized_access", "suspicious_activity", "data_breach_detected"],
      requiredApprovals: ["security_officer", "cto", "legal"],
      emergencyLevels: [
        {
          id: "level_1_containment",
          name: "Immediate Containment",
          severity: 7,
          description: "Contain the breach and assess impact",
          triggers: ["breach_detected", "security_alert"],
          autoActions: [
            {
              id: "halt_all_operations",
              type: "system_shutdown",
              priority: 1,
              description: "Immediately halt all system operations",
              timeout: 30000,
              retryCount: 0,
              rollbackPossible: false,
              dependencies: [],
              conditions: {},
            },
            {
              id: "notify_security_team",
              type: "notify_operators",
              priority: 2,
              description: "Immediately notify security team",
              timeout: 10000,
              retryCount: 1,
              rollbackPossible: false,
              dependencies: [],
              conditions: { urgency: "critical" },
            },
          ],
          escalationThreshold: 180000, // 3 minutes
          deescalationThreshold: 0, // No auto de-escalation for security
          maxDuration: 86400000, // 24 hours
        },
      ],
      escalationRules: [],
      communicationPlan: {
        channels: ["secure_channel", "phone"],
        stakeholders: ["security_team", "incident_response", "legal", "management"],
        templates: {
          activated: "SECURITY BREACH DETECTED. All systems halted. Incident ID: {incident_id}",
          escalated: "Security breach requires immediate attention. Contact: {contact}",
          resolved: "Security breach contained and resolved. Post-incident review scheduled."
        },
        escalationContacts: ["ciso", "ceo", "legal_counsel"],
      },
      recoveryChecklist: [
        {
          id: "breach_assessment",
          name: "Breach Impact Assessment",
          description: "Assess the scope and impact of the security breach",
          verificationMethod: "security_audit",
          autoVerifiable: false,
          priority: 1,
          dependencies: [],
        },
        {
          id: "vulnerability_patching",
          name: "Vulnerability Remediation",
          description: "Patch identified vulnerabilities",
          verificationMethod: "penetration_test",
          autoVerifiable: false,
          priority: 2,
          dependencies: ["breach_assessment"],
        },
        {
          id: "security_verification",
          name: "Security Posture Verification",
          description: "Verify security measures are in place",
          verificationMethod: "security_scan",
          autoVerifiable: true,
          priority: 3,
          dependencies: ["vulnerability_patching"],
        },
      ],
      testingSchedule: {
        frequency: "quarterly",
        lastTest: Date.now(),
        nextTest: Date.now() + 90 * 24 * 60 * 60 * 1000,
      },
    });

    this.logger.info("Default emergency protocols initialized", {
      protocolCount: this.protocols.size,
      protocols: Array.from(this.protocols.keys()),
    });
  }

  /**
   * Test protocol execution (dry run)
   */
  async testProtocol(protocolId: string): Promise<{ success: boolean; issues: string[] }> {
    const protocol = this.protocols.get(protocolId);
    if (!protocol) {
      return { success: false, issues: [`Protocol not found: ${protocolId}`] };
    }

    const issues: string[] = [];

    // Test protocol validation
    const validation = this.validateProtocol(protocol);
    if (!validation.valid) {
      issues.push(...validation.errors);
    }

    // Test action dependencies
    for (const level of protocol.emergencyLevels) {
      for (const action of level.autoActions) {
        // Check if all dependencies exist
        for (const depId of action.dependencies) {
          const depExists = protocol.emergencyLevels.some(l => 
            l.autoActions.some(a => a.id === depId)
          );
          if (!depExists) {
            issues.push(`Action ${action.id} has missing dependency: ${depId}`);
          }
        }
      }
    }

    return {
      success: issues.length === 0,
      issues
    };
  }

  /**
   * Get protocol metrics
   */
  getMetrics(): {
    totalProtocols: number;
    protocolsByComplexity: Record<string, number>;
    averageLevelsPerProtocol: number;
    actionTypes: Record<string, number>;
  } {
    const actionTypes: Record<string, number> = {};
    let totalLevels = 0;
    let totalActions = 0;

    for (const protocol of this.protocols.values()) {
      totalLevels += protocol.emergencyLevels.length;
      
      for (const level of protocol.emergencyLevels) {
        totalActions += level.autoActions.length;
        
        for (const action of level.autoActions) {
          actionTypes[action.type] = (actionTypes[action.type] || 0) + 1;
        }
      }
    }

    const protocolsByComplexity: Record<string, number> = {
      simple: 0,
      medium: 0,
      complex: 0
    };

    for (const protocol of this.protocols.values()) {
      const complexity = protocol.emergencyLevels.length <= 2 ? 'simple' :
                        protocol.emergencyLevels.length <= 4 ? 'medium' : 'complex';
      protocolsByComplexity[complexity]++;
    }

    return {
      totalProtocols: this.protocols.size,
      protocolsByComplexity,
      averageLevelsPerProtocol: this.protocols.size > 0 ? totalLevels / this.protocols.size : 0,
      actionTypes
    };
  }
}