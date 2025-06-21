// Core base classes
export { BaseAgent, type AgentConfig, type AgentResponse } from "./base-agent";

// Multi-agent orchestration
export {
  MultiAgentOrchestrator,
  type AgentWorkflowRequest,
  type AgentWorkflowResult,
} from "./multi-agent-orchestrator";

// MEXC-specific agents
export {
  MexcApiAgent,
  type MexcApiRequest,
  type MexcSymbolData,
  type MexcCalendarEntry,
} from "./mexc-api-agent";
export {
  PatternDiscoveryAgent,
  type PatternAnalysisRequest,
  type PatternMatch,
} from "./pattern-discovery-agent";
export {
  CalendarAgent,
  type CalendarMonitoringRequest,
  type NewListingData,
} from "./calendar-agent";
export {
  SymbolAnalysisAgent,
  type SymbolAnalysisRequest,
  type SymbolStatus,
} from "./symbol-analysis-agent";
export {
  MexcOrchestrator,
  type CalendarDiscoveryWorkflowRequest,
  type SymbolAnalysisWorkflowRequest,
  type PatternAnalysisWorkflowRequest,
  type TradingStrategyWorkflowRequest,
  type MexcWorkflowResult,
} from "./orchestrator";

// Workflow presets for common MEXC operations
export const mexcWorkflowPresets = {
  calendarDiscovery: {
    trigger: "automated",
    force: false,
  },
  symbolMonitoring: {
    analysisDepth: "standard" as const,
    attempt: 1,
  },
  patternAnalysis: {
    analysisType: "discovery" as const,
    confidenceThreshold: 70,
  },
  tradingStrategy: {
    riskLevel: "medium" as const,
    capital: 1000,
  },
};

// Safety agents and types
export {
  SafetyBaseAgent,
  type SafetyConfig,
  type SafetyEvent,
  type SafetyMetrics,
} from "./safety-base-agent";
export {
  SimulationAgent,
  type SimulationSession,
  type SimulatedTrade,
  type SimulationConfig,
} from "./simulation-agent";
export {
  RiskManagerAgent,
  type RiskMetrics,
  type TradeRiskAssessment,
  type CircuitBreaker,
  type RiskEvent,
} from "./risk-manager-agent";
export {
  ReconciliationAgent,
  type ReconciliationReport,
  type Position,
  type BalanceSnapshot,
} from "./reconciliation-agent";
export {
  ErrorRecoveryAgent,
  type SystemHealth,
  type ErrorPattern,
  type ErrorIncident,
} from "./error-recovery-agent";

// Agent Manager
export { AgentManager } from "./agent-manager";

// MEXC event names for Inngest workflows
export const mexcEvents = {
  calendarPoll: "mexc/calendar.poll.requested",
  symbolWatch: "mexc/symbol.watch.requested",
  patternAnalysis: "mexc/pattern.analysis.requested",
  tradingStrategy: "mexc/trading.strategy.requested",
} as const;
