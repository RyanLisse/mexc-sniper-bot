/**
 * Safety System Types and Interfaces
 * 
 * Comprehensive type definitions for the safety coordination system.
 * Provides type safety for all safety-related operations and configurations.
 */

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

  // Operational limits
  maxConcurrentPositions?: number; // maximum concurrent trading positions
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
// Safety Level Enums
// ======================

export type SafetyLevel = "safe" | "warning" | "critical" | "emergency";
export type SystemStatus = "operational" | "degraded" | "critical" | "emergency";
export type RiskTrend = "improving" | "stable" | "deteriorating";
export type EmergencyLevel = "none" | "low" | "medium" | "high" | "critical";
export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertType = "agent_anomaly" | "risk_breach" | "emergency_condition" | "consensus_failure" | "system_degradation";
export type ActionType = "alert" | "restrict" | "shutdown" | "emergency_halt" | "consensus_override";

// ======================
// Safety Constants
// ======================

export const SAFETY_CONSTANTS = {
  DEFAULT_CONFIG: {
    agentMonitoringInterval: 30000, // 30 seconds
    riskAssessmentInterval: 60000, // 1 minute
    systemHealthCheckInterval: 120000, // 2 minutes
    criticalViolationThreshold: 5,
    riskScoreThreshold: 85,
    agentAnomalyThreshold: 75,
    autoEmergencyShutdown: true,
    emergencyContactEnabled: true,
    safetyOverrideRequired: false,
    websocketEnabled: true,
    realTimeAlertsEnabled: true,
    consensusEnforcementEnabled: true,
  } as SafetyCoordinatorConfig,

  ALERT_PRIORITIES: {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  },

  SAFETY_SCORE_THRESHOLDS: {
    SAFE: 80,
    WARNING: 60,
    CRITICAL: 40,
    EMERGENCY: 20,
  },

  RISK_SCORE_THRESHOLDS: {
    LOW: 30,
    MEDIUM: 60,
    HIGH: 80,
    CRITICAL: 95,
  },

  EMERGENCY_LEVELS: {
    NONE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  },
} as const;

// ======================
// Utility Types
// ======================

export interface SafetyCheckResult {
  passed: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
  metadata?: Record<string, unknown>;
}

export interface MonitoringResult {
  timestamp: string;
  source: string;
  metrics: Record<string, number>;
  alerts: SafetyAlert[];
  status: SystemStatus;
}

export interface EmergencyProtocol {
  id: string;
  name: string;
  triggers: string[];
  actions: string[];
  priority: number;
  autoExecute: boolean;
}

export interface ConsensusRequest {
  id: string;
  type: string;
  requester: string;
  data: Record<string, unknown>;
  timestamp: string;
  timeout: number;
  requiredApprovals: number;
}

export interface ConsensusResponse {
  requestId: string;
  approved: boolean;
  reason: string;
  respondent: string;
  timestamp: string;
}