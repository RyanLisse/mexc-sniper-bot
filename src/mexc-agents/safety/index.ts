/**
 * Safety Monitor Module Exports
 */

// Component modules
export { BehaviorMonitor } from "./behavior-monitor";
export { ConsensusManager } from "./consensus-manager";
export { PatternValidator } from "./pattern-validator";
// Main agent
export { SafetyMonitorAgent } from "./safety-monitor-agent";

// Types
export type {
  AgentBehaviorMetrics,
  AgentConsensusRequest,
  AgentConsensusResponse,
  PatternValidationResult,
  SafetyMonitorConfig,
  SafetyProtocolViolation,
} from "./types";
