/**
 * Pattern Strategy Orchestrator Types
 *
 * Extracted types from pattern-strategy-orchestrator.ts to improve modularity
 */

import type { PatternAnalysisResult } from "@/src/core/pattern-detection";
import type { AgentResponse } from "@/src/mexc-agents/base-agent";
import type { CalendarEntry, SymbolEntry } from "../../api/mexc-unified-exports";

export interface PatternWorkflowRequest {
  type: "discovery" | "monitoring" | "validation" | "strategy_creation";
  input: {
    calendarEntries?: CalendarEntry[];
    symbolData?: SymbolEntry[];
    vcoinId?: string;
    symbols?: string[];
  };
  options?: {
    confidenceThreshold?: number;
    includeAdvanceDetection?: boolean;
    enableAgentAnalysis?: boolean;
    maxExecutionTime?: number;
  };
}

export interface PatternWorkflowResult {
  success: boolean;
  type: PatternWorkflowRequest["type"];
  results: {
    patternAnalysis?: PatternAnalysisResult;
    agentResponses?: Record<string, AgentResponse>;
    strategicRecommendations?: StrategicRecommendation[];
    monitoringPlan?: MonitoringPlan;
  };
  performance: {
    executionTime: number;
    agentsUsed: string[];
    cacheHitRate?: number;
    patternsProcessed: number;
  };
  error?: string;
}

export interface StrategicRecommendation {
  vcoinId: string;
  symbol: string;
  action: "immediate_trade" | "prepare_position" | "monitor_closely" | "wait" | "avoid";
  confidence: number;
  reasoning: string;
  timing: {
    optimalEntry?: Date;
    monitoringStart?: Date;
    deadline?: Date;
  };
  riskManagement: {
    positionSize?: number;
    stopLoss?: number;
    takeProfit?: number;
    maxRisk?: number;
  };
}

export interface MonitoringPlan {
  targets: MonitoringTarget[];
  schedules: MonitoringSchedule[];
  alerts: AlertConfiguration[];
  resources: ResourceAllocation;
}

export interface MonitoringTarget {
  vcoinId: string;
  symbol: string;
  priority: "critical" | "high" | "medium" | "low";
  expectedReadyTime?: Date;
  currentStatus: string;
  requiredActions: string[];
}

export interface MonitoringSchedule {
  vcoinId: string;
  intervals: {
    current: number; // minutes
    approaching: number; // minutes (when close to ready)
    critical: number; // minutes (when very close)
  };
  escalationTriggers: string[];
}

export interface AlertConfiguration {
  type: "ready_state" | "pattern_change" | "time_threshold" | "confidence_change";
  condition: string;
  urgency: "immediate" | "high" | "medium" | "low";
  recipients: string[];
}

export interface ResourceAllocation {
  apiCallsPerHour: number;
  concurrentMonitoring: number;
  agentUtilization: Record<string, number>;
  estimatedCosts: Record<string, number>;
}
