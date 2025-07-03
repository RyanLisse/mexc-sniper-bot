/**
 * Emergency Management Types and Interfaces
 * 
 * Core type definitions for the advanced emergency management system.
 * Extracted from advanced-emergency-coordinator.ts for better maintainability.
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
  requiredApprovals: string[];
  emergencyLevels: EmergencyLevel[];
  escalationRules: EscalationRule[];
  communicationPlan: CommunicationPlan;
  recoveryChecklist: RecoveryCheckpoint[];
  testingSchedule: {
    frequency: string;
    lastTest: number;
    nextTest: number;
  };
}

export interface EscalationRule {
  fromLevel: string;
  toLevel: string;
  conditions: string[];
  timeout: number;
  autoEscalate: boolean;
}

export interface CommunicationPlan {
  channels: string[];
  stakeholders: string[];
  templates: Record<string, string>;
  escalationContacts: string[];
}

export interface RecoveryCheckpoint {
  id: string;
  name: string;
  description: string;
  verificationMethod: string;
  autoVerifiable: boolean;
  priority: number;
  dependencies: string[];
}

export interface EmergencySession {
  id: string;
  protocolId: string;
  currentLevel: string;
  status: "active" | "resolved" | "escalated" | "failed";
  startTime: number;
  endTime?: number;
  triggeredBy: string;
  triggerReason: string;
  actionsExecuted: string[];
  actionResults: Record<string, any>;
  approvals: Record<string, boolean>;
  communicationLog: CommunicationEntry[];
  metrics: EmergencyMetrics;
  recoveryProgress: RecoveryProgress;
  lessons: string[];
}

export interface CommunicationEntry {
  timestamp: number;
  channel: string;
  message: string;
  recipient: string;
  status: "sent" | "delivered" | "acknowledged";
}

export interface EmergencyMetrics {
  responseTime: number;
  resolutionTime: number;
  actionsSuccessful: number;
  actionsFailed: number;
  escalations: number;
  communicationsSent: number;
  systemsAffected: string[];
  financialImpact: number;
}

export interface RecoveryProgress {
  checkpointsCompleted: string[];
  checkpointsFailed: string[];
  currentPhase: string;
  estimatedCompletion: number;
  verificationResults: Record<string, boolean>;
}

export interface SystemRecoveryPlan {
  id: string;
  name: string;
  description: string;
  triggerConditions: string[];
  phases: RecoveryPhase[];
  estimatedDuration: number;
  prerequisites: string[];
  rollbackPossible: boolean;
  verificationCriteria: string[];
}

export interface RecoveryPhase {
  id: string;
  name: string;
  description: string;
  actions: RecoveryAction[];
  parallelExecution: boolean;
  timeout: number;
  prerequisites: string[];
  successCriteria: string[];
}

export interface RecoveryAction {
  id: string;
  type: string;
  description: string;
  timeout: number;
  retryCount: number;
  rollbackAction?: string;
  verificationMethod: string;
  conditions: Record<string, any>;
}

export interface AdvancedEmergencyConfig {
  enabled: boolean;
  testMode: boolean;
  autoEscalation: boolean;
  maxConcurrentSessions: number;
  sessionTimeoutMs: number;
  communicationTimeoutMs: number;
  actionTimeoutMs: number;
  recoveryTimeoutMs: number;
  approvalTimeoutMs: number;
  metricsSyncInterval: number;
  testingInterval: number;
  notificationChannels: string[];
  emergencyContacts: EmergencyContact[];
  systemIntegrations: SystemIntegration[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  channels: ContactChannel[];
  escalationLevel: number;
  timezone: string;
  availability: AvailabilityWindow[];
}

export interface ContactChannel {
  type: "email" | "sms" | "phone" | "slack" | "teams";
  value: string;
  priority: number;
  verified: boolean;
}

export interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface SystemIntegration {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
  healthEndpoint: string;
  emergencyEndpoint: string;
  priority: number;
}

export interface EmergencyEvent {
  type: string;
  sessionId: string;
  level: string;
  data: Record<string, any>;
  timestamp: number;
}

export interface CoordinatorMetrics {
  totalSessions: number;
  activeSessionsCount: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  successRate: number;
  escalationRate: number;
  testSuccess: number;
  lastTestDate: number;
  systemHealthScore: number;
  protocolCoverage: number;
}

export type EmergencyEventType = 
  | "protocol_activated"
  | "level_escalated" 
  | "level_deescalated"
  | "action_executed"
  | "action_failed"
  | "session_resolved"
  | "session_failed"
  | "recovery_started"
  | "recovery_completed"
  | "test_completed";

export interface EmergencyContext {
  sessionId: string;
  protocolId: string;
  currentLevel: string;
  metadata: Record<string, any>;
  timestamp: number;
}