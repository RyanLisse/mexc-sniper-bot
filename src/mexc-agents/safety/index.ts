/**
 * Safety Monitor Module Exports
 */

// Main agent
export { SafetyMonitorAgent } from "./safety-monitor-agent";

// Component modules
export { BehaviorMonitor } from "./behavior-monitor";
export { PatternValidator } from "./pattern-validator";
export { ConsensusManager } from "./consensus-manager";

// Types
export type {
  AgentBehaviorMetrics,
  PatternValidationResult,
  AgentConsensusRequest,
  AgentConsensusResponse,
  SafetyProtocolViolation,
  SafetyMonitorConfig,
} from "./types";