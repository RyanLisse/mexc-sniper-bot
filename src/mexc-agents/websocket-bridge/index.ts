/**
 * WebSocket Agent Bridge Module
 *
 * Refactored from a single 934-line file into focused modules
 *
 * Provides:
 * - Real-time agent status broadcasting
 * - Live workflow execution updates
 * - Pattern discovery result streaming
 * - Agent health monitoring
 * - Performance metrics broadcasting
 * - Error and alert distribution
 */

export { PatternDiscoveryStreamer } from "./streamers/pattern-discovery-streamer";

// Streamers
export { RealTimeDataStreamer } from "./streamers/real-time-data-streamer";
export { TradingSignalStreamer } from "./streamers/trading-signal-streamer";
// Types
export type {
  AgentStatusTracker,
  BridgeStatus,
  PatternDiscoveryData,
  ReadyStateData,
  TradingSignalData,
  WorkflowExecutionRequest,
  WorkflowTracker,
} from "./types";
// Main bridge class
export { WebSocketAgentBridge } from "./websocket-agent-bridge";

// Singleton instance for backward compatibility
import { WebSocketAgentBridge } from "./websocket-agent-bridge";
export const webSocketAgentBridge = WebSocketAgentBridge.getInstance();
