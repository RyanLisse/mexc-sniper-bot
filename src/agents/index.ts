// Export all agent classes and types for easy importing
export { BaseAgent, type AgentConfig, type AgentResponse } from "./base-agent";
export { ResearchAgent, type ResearchRequest } from "./research-agent";
export { FormattingAgent, type FormattingRequest } from "./formatting-agent";
export { AnalysisAgent, type AnalysisRequest } from "./analysis-agent";
export { StrategyAgent, type StrategyRequest } from "./strategy-agent";
export {
  AgentOrchestrator,
  type NewsletterWorkflowRequest,
  type WorkflowResult,
} from "./orchestrator";

// Enhanced multi-agent system exports
export {
  EnhancedBaseAgent,
  type EnhancedAgentConfig,
  type EnhancedAgentResponse,
  type AgentHandoff,
} from "./enhanced-base-agent";
export {
  EnhancedCalendarAgent,
  type CalendarMonitoringRequest,
  type NewListingData,
} from "./enhanced-calendar-agent";
export {
  EnhancedPatternAgent,
  type PatternAnalysisRequest,
  type PatternResult,
} from "./enhanced-pattern-agent";
export {
  MultiAgentOrchestrator,
  type AgentWorkflowRequest,
  type AgentWorkflowResult,
} from "./multi-agent-orchestrator";

// Convenience function to create a pre-configured orchestrator
// export function createOrchestrator(): AgentOrchestrator {
//   return new AgentOrchestrator();
// }

// Agent factory functions for easy instantiation
// export const createAgents = {
//   research: () => new ResearchAgent(),
//   formatting: () => new FormattingAgent(),
//   analysis: () => new AnalysisAgent(),
//   strategy: () => new StrategyAgent(),
//   orchestrator: () => new AgentOrchestrator(),
// };

// Enhanced agent factory functions
// export const createEnhancedAgents = {
//   calendar: () => new EnhancedCalendarAgent(),
//   pattern: () => new EnhancedPatternAgent(),
//   multiAgent: () => new MultiAgentOrchestrator(),
// };

// Workflow presets for common use cases
export const workflowPresets = {
  quickNewsletter: {
    analysisDepth: "quick" as const,
    includeStrategy: false,
    targetAudience: "general" as const,
  },
  tradingNewsletter: {
    analysisDepth: "standard" as const,
    includeStrategy: true,
    targetAudience: "traders" as const,
  },
  investmentReport: {
    analysisDepth: "comprehensive" as const,
    includeStrategy: true,
    targetAudience: "investors" as const,
  },
};
