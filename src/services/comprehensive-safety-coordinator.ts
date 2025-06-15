/**
 * Comprehensive Safety Coordinator
 *
 * Central orchestration service that integrates all safety systems including:
 * - Safety Monitor Agent for AI behavior oversight
 * - Advanced Risk Engine for portfolio risk management
 * - Emergency Safety System for critical incident response
 * - Real-time WebSocket safety monitoring
 * - Multi-agent consensus enforcement
 *
 * Features:
 * - Unified safety dashboard
 * - Real-time safety alerts and notifications
 * - Automated safety protocol enforcement
 * - Cross-system safety data correlation
 * - Emergency response coordination
 */

import { EventEmitter } from "events";
import type { WebSocketMessage } from "../lib/websocket-types";
import {
  type AgentBehaviorMetrics,
  type AgentConsensusRequest,
  SafetyMonitorAgent,
} from "../mexc-agents/safety-monitor-agent";
import { AdvancedRiskEngine } from "./advanced-risk-engine";
import { EmergencySafetySystem } from "./emergency-safety-system";
import type { WebSocketServerService } from "./websocket-server";

// ======================
// Safety Coordinator Types
// ======================

export interface SafetyCoordinatorConfig {
  // Monitoring intervals
  agentMonitoringInterval: number; // milliseconds
  riskAssessmentInterval: number; // milliseconds
  systemHealthCheckInterval: number; // milliseconds

  // Safety thresholds
  criticalViolationThreshold: number; // max violations before emergency
  riskScoreThreshold: number; // 0-100 max acceptable risk
  agentAnomalyThreshold: number; // 0-100 max anomaly score

  // Emergency protocols
  autoEmergencyShutdown: boolean;
  emergencyContactEnabled: boolean;
  safetyOverrideRequired: boolean;

  // Integration settings
  websocketEnabled: boolean;
  realTimeAlertsEnabled: boolean;
  consensusEnforcementEnabled: boolean;
}

export interface ComprehensiveSafetyStatus {
  overall: {
    safetyLevel: "safe" | "warning" | "critical" | "emergency";
    safetyScore: number; // 0-100 overall safety score
    lastUpdate: string;
    systemStatus: "operational" | "degraded" | "critical" | "emergency";
  };

  agents: {
    totalMonitored: number;
    healthyCount: number;
    degradedCount: number;
    criticalCount: number;
    offlineCount: number;
    averagePerformance: number;
    recentViolations: number;
  };

  risk: {
    overallRiskScore: number;
    portfolioValue: number;
    exposureLevel: number;
    valueAtRisk: number;
    activeAlerts: number;
    riskTrend: "improving" | "stable" | "deteriorating";
  };

  emergency: {
    systemActive: boolean;
    activeIncidents: number;
    tradingHalted: boolean;
    lastEmergencyAction: string | null;
    emergencyLevel: "none" | "low" | "medium" | "high" | "critical";
  };

  consensus: {
    pendingRequests: number;
    recentDecisions: number;
    averageApprovalRate: number;
    consensusEfficiency: number;
  };

  realTime: {
    websocketConnected: boolean;
    activeSubscriptions: number;
    messageRate: number;
    alertsInLast5Min: number;
  };
}

export interface SafetyAlert {
  id: string;
  type:
    | "agent_anomaly"
    | "risk_breach"
    | "emergency_condition"
    | "consensus_failure"
    | "system_degradation";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  actions: string[];
  metadata: Record<string, unknown>;
}

export interface SafetyAction {
  id: string;
  type: "alert" | "restrict" | "shutdown" | "emergency_halt" | "consensus_override";
  target: string; // agent ID, system, etc.
  reason: string;
  executedAt: string;
  executedBy: string;
  success: boolean;
  impact: string;
}

export interface SafetyMetrics {
  agentMetrics: {
    averageResponseTime: number;
    averageSuccessRate: number;
    averageConfidenceScore: number;
    anomalyRate: number;
    violationRate: number;
  };

  riskMetrics: {
    averageRiskScore: number;
    riskTrend: number; // positive = increasing risk
    breachFrequency: number;
    recoveryTime: number;
  };

  emergencyMetrics: {
    incidentCount: number;
    responseTime: number;
    resolutionTime: number;
    falsePositiveRate: number;
  };

  consensusMetrics: {
    averageProcessingTime: number;
    approvalRate: number;
    timeoutRate: number;
    consensusEffectiveness: number;
  };

  systemMetrics: {
    uptime: number;
    availability: number;
    reliability: number;
    performanceScore: number;
  };
}

// ======================
// Comprehensive Safety Coordinator
// ======================

/**
 * Comprehensive Safety Coordinator
 *
 * Central orchestration service that provides unified safety management
 * across all trading bot systems with real-time monitoring, automated
 * response, and emergency coordination capabilities.
 */
export class ComprehensiveSafetyCoordinator extends EventEmitter {
  private config: SafetyCoordinatorConfig;
  private safetyMonitor: SafetyMonitorAgent;
  private riskEngine: AdvancedRiskEngine;
  private emergencySystem: EmergencySafetySystem;
  private websocketService?: WebSocketServerService;

  // State management
  private isActive = false;
  private currentStatus: ComprehensiveSafetyStatus;
  private activeAlerts: Map<string, SafetyAlert> = new Map();
  private recentActions: SafetyAction[] = [];
  private metrics: SafetyMetrics;

  // Monitoring intervals
  private agentMonitoringTimer?: NodeJS.Timeout;
  private riskMonitoringTimer?: NodeJS.Timeout;
  private systemHealthTimer?: NodeJS.Timeout;

  // Performance tracking
  private lastAgentCheck = 0;
  private lastRiskCheck = 0;
  private lastSystemCheck = 0;
  private alertHistory: SafetyAlert[] = [];
  private actionHistory: SafetyAction[] = [];

  constructor(config: Partial<SafetyCoordinatorConfig> = {}) {
    super();

    this.config = {
      agentMonitoringInterval: 30000, // 30 seconds
      riskAssessmentInterval: 60000, // 1 minute
      systemHealthCheckInterval: 120000, // 2 minutes
      criticalViolationThreshold: 5,
      riskScoreThreshold: 80,
      agentAnomalyThreshold: 70,
      autoEmergencyShutdown: true,
      emergencyContactEnabled: false,
      safetyOverrideRequired: true,
      websocketEnabled: true,
      realTimeAlertsEnabled: true,
      consensusEnforcementEnabled: true,
      ...config,
    };

    // Initialize safety systems
    this.safetyMonitor = new SafetyMonitorAgent();
    this.riskEngine = new AdvancedRiskEngine();
    this.emergencySystem = new EmergencySafetySystem();

    // Set up integrations
    this.emergencySystem.setRiskEngine(this.riskEngine);
    this.safetyMonitor.setIntegrations(this.riskEngine, this.emergencySystem);

    // Initialize state
    this.currentStatus = this.initializeStatus();
    this.metrics = this.initializeMetrics();

    console.log(
      "[ComprehensiveSafetyCoordinator] Initialized with comprehensive safety monitoring"
    );
  }

  /**
   * Start comprehensive safety monitoring
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.warn("[ComprehensiveSafetyCoordinator] Already active");
      return;
    }

    console.log("[ComprehensiveSafetyCoordinator] Starting comprehensive safety monitoring...");

    try {
      // Start monitoring intervals
      this.startMonitoringTimers();

      // Perform initial safety assessment
      await this.performComprehensiveAssessment();

      // Set up event listeners
      this.setupEventListeners();

      this.isActive = true;

      // Emit startup event
      this.emit("safety_coordinator_started", {
        timestamp: new Date().toISOString(),
        config: this.config,
        status: this.currentStatus,
      });

      // Send real-time notification if WebSocket enabled
      if (this.config.websocketEnabled && this.websocketService) {
        await this.broadcastSafetyUpdate("system_status", {
          type: "coordinator_started",
          message: "Comprehensive safety coordinator is now active",
          status: this.currentStatus,
        });
      }

      console.log("[ComprehensiveSafetyCoordinator] Started successfully");
    } catch (error) {
      console.error("[ComprehensiveSafetyCoordinator] Failed to start:", error);
      throw new Error(`Failed to start safety coordinator: ${error}`);
    }
  }

  /**
   * Stop comprehensive safety monitoring
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      console.warn("[ComprehensiveSafetyCoordinator] Not active");
      return;
    }

    console.log("[ComprehensiveSafetyCoordinator] Stopping comprehensive safety monitoring...");

    // Clear monitoring timers
    this.clearMonitoringTimers();

    // Remove event listeners
    this.removeAllListeners();

    this.isActive = false;

    console.log("[ComprehensiveSafetyCoordinator] Stopped successfully");
  }

  /**
   * Set WebSocket service for real-time notifications
   */
  setWebSocketService(websocketService: WebSocketServerService): void {
    this.websocketService = websocketService;
    console.log("[ComprehensiveSafetyCoordinator] WebSocket service connected");

    // Listen for WebSocket events
    if (this.config.websocketEnabled) {
      this.websocketService.on("client_connected", this.handleWebSocketConnection.bind(this));
      this.websocketService.on("client_disconnected", this.handleWebSocketDisconnection.bind(this));
    }
  }

  /**
   * Get current comprehensive safety status
   */
  getCurrentStatus(): ComprehensiveSafetyStatus {
    return { ...this.currentStatus };
  }

  /**
   * Get active safety alerts
   */
  getActiveAlerts(): SafetyAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get recent safety actions
   */
  getRecentActions(limit = 50): SafetyAction[] {
    return this.recentActions.slice(-limit);
  }

  /**
   * Get safety metrics
   */
  getMetrics(): SafetyMetrics {
    return { ...this.metrics };
  }

  /**
   * Acknowledge a safety alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;

    await this.recordSafetyAction({
      type: "alert",
      target: alertId,
      reason: "Alert acknowledged by user",
      executedBy: userId,
      success: true,
      impact: "Alert marked as acknowledged",
    });

    // Broadcast update
    if (this.config.websocketEnabled && this.websocketService) {
      await this.broadcastSafetyUpdate("alert_acknowledged", {
        alertId,
        acknowledgedBy: userId,
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }

  /**
   * Resolve a safety alert
   */
  async resolveAlert(alertId: string, userId: string, resolution: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.metadata.resolution = resolution;
    alert.metadata.resolvedBy = userId;
    alert.metadata.resolvedAt = new Date().toISOString();

    // Move to history
    this.alertHistory.push(alert);
    this.activeAlerts.delete(alertId);

    await this.recordSafetyAction({
      type: "alert",
      target: alertId,
      reason: `Alert resolved: ${resolution}`,
      executedBy: userId,
      success: true,
      impact: "Alert resolved and moved to history",
    });

    // Update status
    await this.updateSafetyStatus();

    return true;
  }

  /**
   * Execute emergency shutdown
   */
  async executeEmergencyShutdown(reason: string, userId: string): Promise<boolean> {
    console.log(`[ComprehensiveSafetyCoordinator] Executing emergency shutdown: ${reason}`);

    try {
      // Trigger emergency system
      await this.emergencySystem.forceEmergencyHalt(reason);

      // Create critical alert
      await this.createAlert({
        type: "emergency_condition",
        severity: "critical",
        title: "Emergency Shutdown Executed",
        message: `Emergency shutdown initiated: ${reason}`,
        source: "safety_coordinator",
        actions: ["All trading halted", "Manual intervention required"],
        metadata: { reason, executedBy: userId },
      });

      // Record action
      await this.recordSafetyAction({
        type: "emergency_halt",
        target: "system",
        reason,
        executedBy: userId,
        success: true,
        impact: "All trading operations halted",
      });

      // Update status
      await this.updateSafetyStatus();

      return true;
    } catch (error) {
      console.error("[ComprehensiveSafetyCoordinator] Emergency shutdown failed:", error);

      await this.createAlert({
        type: "system_degradation",
        severity: "critical",
        title: "Emergency Shutdown Failed",
        message: `Failed to execute emergency shutdown: ${error}`,
        source: "safety_coordinator",
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
        await this.createAlert({
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
      console.error("[ComprehensiveSafetyCoordinator] Consensus request failed:", error);
      throw error;
    }
  }

  // Private helper methods

  private initializeStatus(): ComprehensiveSafetyStatus {
    return {
      overall: {
        safetyLevel: "safe",
        safetyScore: 100,
        lastUpdate: new Date().toISOString(),
        systemStatus: "operational",
      },
      agents: {
        totalMonitored: 0,
        healthyCount: 0,
        degradedCount: 0,
        criticalCount: 0,
        offlineCount: 0,
        averagePerformance: 100,
        recentViolations: 0,
      },
      risk: {
        overallRiskScore: 0,
        portfolioValue: 0,
        exposureLevel: 0,
        valueAtRisk: 0,
        activeAlerts: 0,
        riskTrend: "stable",
      },
      emergency: {
        systemActive: false,
        activeIncidents: 0,
        tradingHalted: false,
        lastEmergencyAction: null,
        emergencyLevel: "none",
      },
      consensus: {
        pendingRequests: 0,
        recentDecisions: 0,
        averageApprovalRate: 0,
        consensusEfficiency: 100,
      },
      realTime: {
        websocketConnected: false,
        activeSubscriptions: 0,
        messageRate: 0,
        alertsInLast5Min: 0,
      },
    };
  }

  private initializeMetrics(): SafetyMetrics {
    return {
      agentMetrics: {
        averageResponseTime: 0,
        averageSuccessRate: 100,
        averageConfidenceScore: 100,
        anomalyRate: 0,
        violationRate: 0,
      },
      riskMetrics: {
        averageRiskScore: 0,
        riskTrend: 0,
        breachFrequency: 0,
        recoveryTime: 0,
      },
      emergencyMetrics: {
        incidentCount: 0,
        responseTime: 0,
        resolutionTime: 0,
        falsePositiveRate: 0,
      },
      consensusMetrics: {
        averageProcessingTime: 0,
        approvalRate: 100,
        timeoutRate: 0,
        consensusEffectiveness: 100,
      },
      systemMetrics: {
        uptime: 100,
        availability: 100,
        reliability: 100,
        performanceScore: 100,
      },
    };
  }

  private startMonitoringTimers(): void {
    // Agent monitoring
    this.agentMonitoringTimer = setInterval(
      () => this.performAgentMonitoring(),
      this.config.agentMonitoringInterval
    );

    // Risk assessment
    this.riskMonitoringTimer = setInterval(
      () => this.performRiskAssessment(),
      this.config.riskAssessmentInterval
    );

    // System health check
    this.systemHealthTimer = setInterval(
      () => this.performSystemHealthCheck(),
      this.config.systemHealthCheckInterval
    );
  }

  private clearMonitoringTimers(): void {
    if (this.agentMonitoringTimer) {
      clearInterval(this.agentMonitoringTimer);
    }
    if (this.riskMonitoringTimer) {
      clearInterval(this.riskMonitoringTimer);
    }
    if (this.systemHealthTimer) {
      clearInterval(this.systemHealthTimer);
    }
  }

  private setupEventListeners(): void {
    // Listen to safety monitor events
    this.safetyMonitor.on("safety_event", this.handleSafetyEvent.bind(this));

    // Listen to risk engine events
    this.riskEngine.on("risk_alert", this.handleRiskAlert.bind(this));

    // Listen to emergency system events
    this.emergencySystem.on("emergency_activated", this.handleEmergencyActivation.bind(this));
    this.emergencySystem.on("emergency_resolved", this.handleEmergencyResolution.bind(this));
  }

  private async performComprehensiveAssessment(): Promise<void> {
    console.log("[ComprehensiveSafetyCoordinator] Performing comprehensive safety assessment...");

    try {
      // Run all monitoring tasks in parallel
      await Promise.all([
        this.performAgentMonitoring(),
        this.performRiskAssessment(),
        this.performSystemHealthCheck(),
      ]);

      // Update overall status
      await this.updateSafetyStatus();
    } catch (error) {
      console.error("[ComprehensiveSafetyCoordinator] Comprehensive assessment failed:", error);

      await this.createAlert({
        type: "system_degradation",
        severity: "high",
        title: "Safety Assessment Failed",
        message: `Comprehensive safety assessment failed: ${error}`,
        source: "safety_coordinator",
        actions: ["Check system health", "Review safety system status"],
        metadata: { error: String(error) },
      });
    }
  }

  private async performAgentMonitoring(): Promise<void> {
    try {
      // Mock agent metrics (in production, would get from actual agent manager)
      const mockMetrics: AgentBehaviorMetrics[] = [
        {
          agentId: "pattern-discovery-agent",
          agentType: "Pattern Discovery",
          responseTime: 1200 + Math.random() * 500,
          successRate: 94 + Math.random() * 4,
          errorRate: 2 + Math.random() * 3,
          confidenceScore: 85 + Math.random() * 10,
          memoryUsage: 128 + Math.random() * 64,
          cacheHitRate: 75 + Math.random() * 20,
          lastActivity: new Date().toISOString(),
          anomalyScore: Math.random() * 30,
        },
        // Add more mock agents...
      ];

      // Monitor agent behavior
      const behaviorAnalysis = await this.safetyMonitor.monitorAgentBehavior(mockMetrics);

      // Check performance degradation
      const performanceCheck = await this.safetyMonitor.checkPerformanceDegradation();

      // Update agent status
      this.currentStatus.agents = {
        totalMonitored: mockMetrics.length,
        healthyCount: mockMetrics.filter((m) => m.anomalyScore < 30).length,
        degradedCount: mockMetrics.filter((m) => m.anomalyScore >= 30 && m.anomalyScore < 60)
          .length,
        criticalCount: mockMetrics.filter((m) => m.anomalyScore >= 60).length,
        offlineCount: 0,
        averagePerformance:
          mockMetrics.reduce((sum, m) => sum + m.successRate, 0) / mockMetrics.length,
        recentViolations: behaviorAnalysis.violations.length,
      };

      // Create alerts for violations
      for (const violation of behaviorAnalysis.violations) {
        await this.createAlert({
          type: "agent_anomaly",
          severity: violation.severity,
          title: `Agent Violation: ${violation.agentId}`,
          message: violation.description,
          source: "agent_monitor",
          actions: [violation.action],
          metadata: { violation },
        });
      }

      this.lastAgentCheck = Date.now();
    } catch (error) {
      console.error("[ComprehensiveSafetyCoordinator] Agent monitoring failed:", error);
    }
  }

  private async performRiskAssessment(): Promise<void> {
    try {
      // Get risk metrics
      const portfolioMetrics = await this.riskEngine.getPortfolioRiskMetrics();
      const healthStatus = this.riskEngine.getHealthStatus();
      const activeAlerts = this.riskEngine.getActiveAlerts();

      // Update risk status
      this.currentStatus.risk = {
        overallRiskScore: healthStatus.metrics.riskScore,
        portfolioValue: portfolioMetrics.totalValue,
        exposureLevel: portfolioMetrics.totalExposure,
        valueAtRisk: portfolioMetrics.valueAtRisk95,
        activeAlerts: activeAlerts.length,
        riskTrend: "stable", // Would calculate based on historical data
      };

      // Check for risk threshold breaches
      if (healthStatus.metrics.riskScore > this.config.riskScoreThreshold) {
        await this.createAlert({
          type: "risk_breach",
          severity: "high",
          title: "Risk Threshold Exceeded",
          message: `Portfolio risk score (${healthStatus.metrics.riskScore}) exceeds threshold (${this.config.riskScoreThreshold})`,
          source: "risk_engine",
          actions: ["Review position sizes", "Consider position reduction"],
          metadata: { portfolioMetrics, healthStatus },
        });
      }

      this.lastRiskCheck = Date.now();
    } catch (error) {
      console.error("[ComprehensiveSafetyCoordinator] Risk assessment failed:", error);
    }
  }

  private async performSystemHealthCheck(): Promise<void> {
    try {
      // Check emergency system status
      const emergencyStatus = await this.emergencySystem.getEmergencyStatus();
      const systemHealth = await this.emergencySystem.performSystemHealthCheck();

      // Update emergency status
      this.currentStatus.emergency = {
        systemActive: emergencyStatus.active,
        activeIncidents: emergencyStatus.activeCount,
        tradingHalted: emergencyStatus.tradingHalted,
        lastEmergencyAction: null, // Would track from history
        emergencyLevel:
          systemHealth.overall === "critical"
            ? "critical"
            : systemHealth.overall === "degraded"
              ? "medium"
              : "none",
      };

      // Update WebSocket status
      if (this.websocketService) {
        const wsMetrics = this.websocketService.getConnectionMetrics();
        this.currentStatus.realTime = {
          websocketConnected: wsMetrics.activeConnections > 0,
          activeSubscriptions: wsMetrics.totalSubscriptions,
          messageRate: wsMetrics.messagesPerSecond,
          alertsInLast5Min: this.getRecentAlertsCount(5),
        };
      }

      this.lastSystemCheck = Date.now();
    } catch (error) {
      console.error("[ComprehensiveSafetyCoordinator] System health check failed:", error);
    }
  }

  private async updateSafetyStatus(): Promise<void> {
    // Calculate overall safety score
    let safetyScore = 100;

    // Deduct for agent issues
    safetyScore -= this.currentStatus.agents.criticalCount * 15;
    safetyScore -= this.currentStatus.agents.degradedCount * 5;
    safetyScore -= this.currentStatus.agents.recentViolations * 3;

    // Deduct for risk issues
    safetyScore -= Math.max(
      0,
      this.currentStatus.risk.overallRiskScore - this.config.riskScoreThreshold
    );
    safetyScore -= this.currentStatus.risk.activeAlerts * 2;

    // Deduct for emergency conditions
    if (this.currentStatus.emergency.systemActive) safetyScore -= 30;
    if (this.currentStatus.emergency.tradingHalted) safetyScore -= 20;

    // Deduct for active alerts
    const criticalAlerts = Array.from(this.activeAlerts.values()).filter(
      (a) => a.severity === "critical"
    ).length;
    const highAlerts = Array.from(this.activeAlerts.values()).filter(
      (a) => a.severity === "high"
    ).length;
    safetyScore -= criticalAlerts * 10;
    safetyScore -= highAlerts * 5;

    safetyScore = Math.max(0, Math.min(100, safetyScore));

    // Determine safety level
    let safetyLevel: ComprehensiveSafetyStatus["overall"]["safetyLevel"];
    if (safetyScore >= 80) safetyLevel = "safe";
    else if (safetyScore >= 60) safetyLevel = "warning";
    else if (safetyScore >= 30) safetyLevel = "critical";
    else safetyLevel = "emergency";

    // Determine system status
    let systemStatus: ComprehensiveSafetyStatus["overall"]["systemStatus"];
    if (this.currentStatus.emergency.systemActive) systemStatus = "emergency";
    else if (safetyLevel === "critical") systemStatus = "critical";
    else if (safetyLevel === "warning") systemStatus = "degraded";
    else systemStatus = "operational";

    // Update overall status
    this.currentStatus.overall = {
      safetyLevel,
      safetyScore,
      lastUpdate: new Date().toISOString(),
      systemStatus,
    };

    // Update consensus status
    const safetyStatus = this.safetyMonitor.getSafetyStatus();
    this.currentStatus.consensus = {
      pendingRequests: safetyStatus.consensusRequests,
      recentDecisions: 0, // Would track from history
      averageApprovalRate: this.metrics.consensusMetrics.approvalRate,
      consensusEfficiency: this.metrics.consensusMetrics.consensusEffectiveness,
    };

    // Emit status update event
    this.emit("status_updated", this.currentStatus);

    // Broadcast real-time update
    if (this.config.websocketEnabled && this.websocketService) {
      await this.broadcastSafetyUpdate("status_update", {
        status: this.currentStatus,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async createAlert(
    alertData: Omit<SafetyAlert, "id" | "timestamp" | "acknowledged" | "resolved">
  ): Promise<string> {
    const alert: SafetyAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false,
      ...alertData,
    };

    this.activeAlerts.set(alert.id, alert);

    // Emit alert event
    this.emit("alert_created", alert);

    // Broadcast real-time alert
    if (this.config.realTimeAlertsEnabled && this.websocketService) {
      await this.broadcastSafetyUpdate("alert", alert);
    }

    console.log(`[ComprehensiveSafetyCoordinator] Created ${alert.severity} alert: ${alert.title}`);

    return alert.id;
  }

  private async recordSafetyAction(
    actionData: Omit<SafetyAction, "id" | "executedAt">
  ): Promise<void> {
    const action: SafetyAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      executedAt: new Date().toISOString(),
      ...actionData,
    };

    this.recentActions.push(action);
    this.actionHistory.push(action);

    // Keep only last 100 recent actions
    if (this.recentActions.length > 100) {
      this.recentActions = this.recentActions.slice(-100);
    }

    // Emit action event
    this.emit("action_executed", action);

    console.log(
      `[ComprehensiveSafetyCoordinator] Executed ${action.type} action: ${action.reason}`
    );
  }

  private async broadcastSafetyUpdate(type: string, data: any): Promise<void> {
    if (!this.websocketService) return;

    const message: WebSocketMessage = {
      type: "safety_update" as any,
      channel: "safety",
      data: {
        updateType: type,
        ...data,
      },
      timestamp: Date.now(),
      messageId: `safety-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.websocketService.broadcast(message);
  }

  private getRecentAlertsCount(minutes: number): number {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return Array.from(this.activeAlerts.values()).filter(
      (alert) => new Date(alert.timestamp).getTime() > cutoff
    ).length;
  }

  private handleSafetyEvent(event: any): void {
    // Handle events from safety monitor
    console.log("[ComprehensiveSafetyCoordinator] Safety event received:", event);
  }

  private handleRiskAlert(alert: any): void {
    // Handle alerts from risk engine
    console.log("[ComprehensiveSafetyCoordinator] Risk alert received:", alert);
  }

  private handleEmergencyActivation(event: any): void {
    // Handle emergency activation
    console.log("[ComprehensiveSafetyCoordinator] Emergency activated:", event);
  }

  private handleEmergencyResolution(event: any): void {
    // Handle emergency resolution
    console.log("[ComprehensiveSafetyCoordinator] Emergency resolved:", event);
  }

  private handleWebSocketConnection(connectionId: string): void {
    console.log(`[ComprehensiveSafetyCoordinator] WebSocket client connected: ${connectionId}`);
  }

  private handleWebSocketDisconnection(connectionId: string): void {
    console.log(`[ComprehensiveSafetyCoordinator] WebSocket client disconnected: ${connectionId}`);
  }
}
