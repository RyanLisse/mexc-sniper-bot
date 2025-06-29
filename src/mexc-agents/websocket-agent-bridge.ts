/**
 * WebSocket Agent Bridge
 * 
 * This file has been refactored for maintainability.
 * The original 934-line implementation has been split into focused modules.
 * 
 * This file now serves as a backward-compatibility layer.
 */

// Re-export everything from the new modular structure
export { 
  WebSocketAgentBridge, 
  webSocketAgentBridge,
  RealTimeDataStreamer,
  PatternDiscoveryStreamer,
  TradingSignalStreamer
} from "./websocket-bridge";

export type {
  AgentStatusTracker,
  WorkflowTracker,
  PatternDiscoveryData,
  ReadyStateData,
  TradingSignalData,
  WorkflowExecutionRequest,
  BridgeStatus,
} from "./websocket-bridge";
