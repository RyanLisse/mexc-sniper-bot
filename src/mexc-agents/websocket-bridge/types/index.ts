/**
 * Type definitions for WebSocket Agent Bridge system
 */

export interface AgentStatusTracker {
  agentId: string;
  agentType: string;
  lastUpdate: number;
  status: "healthy" | "degraded" | "unhealthy" | "offline";
  metrics: {
    responseTime: number;
    errorCount: number;
    successRate: number;
    cacheHitRate: number;
    workflowsActive: number;
  };
  metadata: Record<string, any>;
}

export interface WorkflowTracker {
  workflowId: string;
  workflowType: string;
  status: "started" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  agentsInvolved: string[];
  currentAgent?: string;
  startTime: number;
  lastUpdate: number;
  metadata: Record<string, any>;
}

export interface PatternDiscoveryData {
  patternId: string;
  symbol: string;
  type: string;
  name: string;
  description: string;
  confidence: number;
  strength: number;
  detectedAt: number;
  estimatedExecution: number;
  criteria: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ReadyStateData {
  symbol: string;
  vcoinId: string;
  sts: number;
  st: number;
  tt: number;
  confidence: number;
  estimatedLaunchTime?: number;
  riskLevel: "low" | "medium" | "high";
  expectedVolatility: number;
  correlatedSymbols: string[];
  metadata?: Record<string, any>;
}

export interface TradingSignalData {
  signalId: string;
  symbol: string;
  type: "buy" | "sell" | "hold" | "monitor";
  strength: number;
  confidence: number;
  source: string;
  reasoning: string;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe: string;
  metadata?: Record<string, any>;
}

export interface WorkflowExecutionRequest {
  workflowId?: string;
  workflowType: string;
  request: any;
  action: string;
}

export interface BridgeStatus {
  initialized: boolean;
  running: boolean;
  connectedClients: number;
  dataStreaming: boolean;
}