/**
 * Safety Monitor Types and Interfaces
 */

import type { SafetyConfig } from "../safety-base-agent";

export interface AgentBehaviorMetrics {
  agentId: string;
  agentType: string;
  responseTime: number; // milliseconds
  successRate: number; // percentage
  errorRate: number; // percentage
  confidenceScore: number; // 0-100
  memoryUsage: number; // MB
  cacheHitRate: number; // percentage
  lastActivity: string;
  anomalyScore: number; // 0-100 (higher = more anomalous)
}

export interface PatternValidationResult {
  patternId: string;
  symbol: string;
  confidence: number; // 0-100
  riskScore: number; // 0-100
  validationSteps: Array<{
    step: string;
    passed: boolean;
    details: string;
    confidence: number;
  }>;
  consensus: {
    required: boolean;
    agentsConsulted: string[];
    agreementLevel: number; // 0-100
    dissenting: string[];
  };
  safetyChecks: {
    marketConditions: boolean;
    riskLimits: boolean;
    correlationCheck: boolean;
    liquidityCheck: boolean;
  };
  recommendation: "proceed" | "caution" | "reject";
  reasoning: string[];
}

export interface AgentConsensusRequest {
  requestId: string;
  type:
    | "trade_approval"
    | "pattern_validation"
    | "risk_assessment"
    | "emergency_response";
  data: Record<string, unknown>;
  requiredAgents: string[];
  consensusThreshold: number; // percentage (50-100)
  timeout: number; // milliseconds
  priority: "low" | "medium" | "high" | "critical";
}

export interface AgentConsensusResponse {
  requestId: string;
  agentResponses: Array<{
    agentId: string;
    response: "approve" | "reject" | "abstain";
    confidence: number;
    reasoning: string;
    timestamp: string;
  }>;
  consensus: {
    achieved: boolean;
    approvalRate: number;
    finalDecision: "approve" | "reject";
    confidence: number;
  };
  processingTime: number;
  warnings: string[];
}

export interface SafetyProtocolViolation {
  id: string;
  type:
    | "behavior_anomaly"
    | "consensus_failure"
    | "validation_failure"
    | "performance_degradation";
  severity: "low" | "medium" | "high" | "critical";
  agentId?: string;
  description: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
  resolved: boolean;
  action: "monitor" | "warn" | "restrict" | "shutdown";
}

export interface SafetyMonitorConfig extends SafetyConfig {
  // Behavior Monitoring
  behaviorAnomalyThreshold: number; // 0-100
  performanceDegradationThreshold: number; // percentage drop
  responseTimeThreshold: number; // milliseconds

  // Consensus Requirements
  consensusEnabled: boolean;
  highRiskConsensusThreshold: number; // percentage
  patternValidationThreshold: number; // minimum confidence

  // Safety Protocols
  autoShutdownEnabled: boolean;
  violationEscalationThreshold: number;
  safetyOverrideRequired: boolean;

  // Monitoring Intervals
  behaviorCheckInterval: number; // minutes
  performanceCheckInterval: number; // minutes
  consensusTimeout: number; // milliseconds
}
