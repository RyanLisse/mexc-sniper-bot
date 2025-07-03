/**
 * Safety Domain Events
 * Events that represent important safety-related occurrences in the domain
 */

import type { DomainEvent } from "./domain-event";

// Base safety event interface
interface BaseSafetyEvent extends DomainEvent {
  readonly aggregateId: string; // EmergencyStop ID, RiskProfile ID, etc.
  readonly userId: string;
  readonly portfolioId?: string;
}

// Emergency Stop Events
export interface EmergencyStopCreated extends BaseSafetyEvent {
  readonly type: "emergency_stop.created";
  readonly data: {
    emergencyStopId: string;
    userId: string;
    portfolioId: string;
    triggerConditions: Array<{
      type: string;
      threshold: number;
      description: string;
      priority: string;
    }>;
    emergencyActions: Array<{
      type: string;
      priority: number;
      description: string;
      timeout: number;
      retryCount: number;
    }>;
    isActive: boolean;
    autoExecute: boolean;
  };
}

export interface EmergencyStopTriggered extends BaseSafetyEvent {
  readonly type: "emergency_stop.triggered";
  readonly data: {
    emergencyStopId: string;
    userId: string;
    portfolioId: string;
    reason: string;
    triggerData: Record<string, any>;
    triggeredAt: Date;
    scheduledActions: Array<{
      actionType: string;
      priority: number;
      timeout: number;
      retryCount: number;
    }>;
  };
}

export interface EmergencyStopCompleted extends BaseSafetyEvent {
  readonly type: "emergency_stop.completed";
  readonly data: {
    emergencyStopId: string;
    userId: string;
    portfolioId: string;
    triggeredAt: Date;
    completedAt: Date;
    executionSummary: {
      totalActions: number;
      successfulActions: number;
      failedActions: number;
      totalExecutionTime: number;
      averageActionTime: number;
      overallSuccess: boolean;
    };
    actionResults: Array<{
      actionType: string;
      success: boolean;
      duration: number;
      error?: string;
    }>;
  };
}

export interface EmergencyStopFailed extends BaseSafetyEvent {
  readonly type: "emergency_stop.failed";
  readonly data: {
    emergencyStopId: string;
    userId: string;
    portfolioId: string;
    triggeredAt: Date;
    failedAt: Date;
    failureReason: string;
    failedActions: Array<{
      actionType: string;
      error: string;
      attemptsCount: number;
    }>;
    partialResults?: Array<{
      actionType: string;
      success: boolean;
      duration: number;
    }>;
  };
}

// Risk Profile Events
export interface RiskProfileCreated extends BaseSafetyEvent {
  readonly type: "risk_profile.created";
  readonly data: {
    riskProfileId: string;
    userId: string;
    portfolioId: string;
    thresholds: {
      maxDrawdownPercent: number;
      maxPositionRiskPercent: number;
      maxPortfolioRiskPercent: number;
      maxConcentrationPercent: number;
      consecutiveLossThreshold: number;
      dailyLossThreshold: number;
      monthlyLossThreshold: number;
    };
    exposures: {
      totalExposure: number;
      longExposure: number;
      shortExposure: number;
      leveragedExposure: number;
      unrealizedPnL: number;
      realizedPnL: number;
    };
    riskToleranceLevel: string;
    isActive: boolean;
  };
}

export interface RiskProfileUpdated extends BaseSafetyEvent {
  readonly type: "risk_profile.updated";
  readonly data: {
    riskProfileId: string;
    userId: string;
    portfolioId: string;
    changeType: "thresholds" | "exposures" | "tolerance" | "status";
    previousValues: Record<string, any>;
    newValues: Record<string, any>;
    updatedBy: "USER" | "SYSTEM" | "AUTO_ADJUSTMENT";
    reason?: string;
  };
}

export interface RiskThresholdViolated extends BaseSafetyEvent {
  readonly type: "risk_threshold.violated";
  readonly data: {
    riskProfileId: string;
    userId: string;
    portfolioId: string;
    violationType: "drawdown_threshold" | "position_risk" | "portfolio_risk" | "concentration_risk" | "consecutive_losses" | "daily_loss_threshold" | "monthly_loss_threshold";
    threshold: number;
    currentValue: number;
    severity: "low" | "medium" | "high" | "critical";
    recommendedActions: string[];
    violationContext: {
      symbol?: string;
      positionId?: string;
      tradeId?: string;
      timeframe?: string;
      additionalMetrics?: Record<string, any>;
    };
    detectedAt: Date;
  };
}

// Safety Alert Events
export interface SafetyAlertCreated extends BaseSafetyEvent {
  readonly type: "safety_alert.created";
  readonly data: {
    alertId: string;
    userId: string;
    portfolioId: string;
    alertType: "RISK_WARNING" | "THRESHOLD_BREACH" | "EMERGENCY_TRIGGER" | "SYSTEM_ANOMALY";
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    sourceEntity: string; // "emergency_stop" | "risk_profile" | "trading_engine"
    sourceEntityId: string;
    requiresAction: boolean;
    suggestedActions?: string[];
    metadata: Record<string, any>;
  };
}

export interface SafetyAlertResolved extends BaseSafetyEvent {
  readonly type: "safety_alert.resolved";
  readonly data: {
    alertId: string;
    userId: string;
    portfolioId: string;
    resolvedAt: Date;
    resolvedBy: "USER" | "SYSTEM" | "AUTO_RESOLUTION";
    resolutionMethod: string;
    actionsTaken: string[];
    outcome: "SUCCESSFUL" | "PARTIAL" | "FAILED";
    notes?: string;
  };
}

// Union type of all safety events
export type SafetyDomainEvent =
  | EmergencyStopCreated
  | EmergencyStopTriggered
  | EmergencyStopCompleted
  | EmergencyStopFailed
  | RiskProfileCreated
  | RiskProfileUpdated
  | RiskThresholdViolated
  | SafetyAlertCreated
  | SafetyAlertResolved;

// Event creation helpers
export class SafetyEventFactory {
  static createEmergencyStopCreated(
    emergencyStopId: string,
    userId: string,
    data: EmergencyStopCreated["data"]
  ): EmergencyStopCreated {
    return {
      type: "emergency_stop.created",
      aggregateId: emergencyStopId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `emergency-stop-created-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }

  static createEmergencyStopTriggered(
    emergencyStopId: string,
    userId: string,
    data: EmergencyStopTriggered["data"]
  ): EmergencyStopTriggered {
    return {
      type: "emergency_stop.triggered",
      aggregateId: emergencyStopId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `emergency-stop-triggered-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }

  static createEmergencyStopCompleted(
    emergencyStopId: string,
    userId: string,
    data: EmergencyStopCompleted["data"]
  ): EmergencyStopCompleted {
    return {
      type: "emergency_stop.completed",
      aggregateId: emergencyStopId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `emergency-stop-completed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }

  static createEmergencyStopFailed(
    emergencyStopId: string,
    userId: string,
    data: EmergencyStopFailed["data"]
  ): EmergencyStopFailed {
    return {
      type: "emergency_stop.failed",
      aggregateId: emergencyStopId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `emergency-stop-failed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }

  static createRiskProfileCreated(
    riskProfileId: string,
    userId: string,
    data: RiskProfileCreated["data"]
  ): RiskProfileCreated {
    return {
      type: "risk_profile.created",
      aggregateId: riskProfileId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `risk-profile-created-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }

  static createRiskProfileUpdated(
    riskProfileId: string,
    userId: string,
    data: RiskProfileUpdated["data"]
  ): RiskProfileUpdated {
    return {
      type: "risk_profile.updated",
      aggregateId: riskProfileId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `risk-profile-updated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }

  static createRiskThresholdViolated(
    riskProfileId: string,
    userId: string,
    data: RiskThresholdViolated["data"]
  ): RiskThresholdViolated {
    return {
      type: "risk_threshold.violated",
      aggregateId: riskProfileId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `risk-threshold-violated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }

  static createSafetyAlertCreated(
    alertId: string,
    userId: string,
    data: SafetyAlertCreated["data"]
  ): SafetyAlertCreated {
    return {
      type: "safety_alert.created",
      aggregateId: alertId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `safety-alert-created-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }

  static createSafetyAlertResolved(
    alertId: string,
    userId: string,
    data: SafetyAlertResolved["data"]
  ): SafetyAlertResolved {
    return {
      type: "safety_alert.resolved",
      aggregateId: alertId,
      userId,
      payload: data,
      occurredAt: new Date(),
      eventId: `safety-alert-resolved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
    };
  }
}