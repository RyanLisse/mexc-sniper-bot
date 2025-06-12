// Core base classes
export { BaseAgent, type AgentConfig, type AgentResponse } from "./base-agent";
export { StrategyAgent, type StrategyRequest } from "./strategy-agent";

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

// Convenience function to create a pre-configured MEXC orchestrator
// export function createMexcOrchestrator(): MexcOrchestrator {
//   return new MexcOrchestrator();
// }

// MEXC agent factory functions for easy instantiation
// export const createMexcAgents = {
//   api: () => new MexcApiAgent(),
//   patternDiscovery: () => new PatternDiscoveryAgent(),
//   calendar: () => new CalendarAgent(),
//   symbolAnalysis: () => new SymbolAnalysisAgent(),
//   orchestrator: () => new MexcOrchestrator(),
// };

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

// MEXC event names for Inngest workflows
export const mexcEvents = {
  calendarPoll: "mexc/calendar.poll.requested",
  symbolWatch: "mexc/symbol.watch.requested",
  patternAnalysis: "mexc/pattern.analysis.requested",
  tradingStrategy: "mexc/trading.strategy.requested",
} as const;
