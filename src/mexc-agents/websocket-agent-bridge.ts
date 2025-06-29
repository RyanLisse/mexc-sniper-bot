/**
 * WebSocket Agent Bridge
 * 
 * This file has been refactored for maintainability.
 * The original 934-line implementation has been split into focused modules.
 * 
 * This file now serves as a backward-compatibility layer.
 */


export type {
  AgentStatusTracker,
  BridgeStatus,
  PatternDiscoveryData,
  ReadyStateData,
  TradingSignalData,
  WorkflowExecutionRequest,
  WorkflowTracker,
} from "./websocket-bridge";
// Re-export everything from the new modular structure
export { 
  PatternDiscoveryStreamer,
  RealTimeDataStreamer,
  TradingSignalStreamer, 
  WebSocketAgentBridge, 
  webSocketAgentBridge
} from "./websocket-bridge";
