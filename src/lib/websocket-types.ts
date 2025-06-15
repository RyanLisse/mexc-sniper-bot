/**
 * WebSocket Types and Message Definitions
 *
 * Type-safe WebSocket message definitions for the AI trading system.
 * Supports real-time communication between agents, trading data, and UI components.
 *
 * Features:
 * - Type-safe message schemas
 * - Agent status broadcasting
 * - Trading signal distribution
 * - Pattern discovery streaming
 * - User notifications
 */

// ======================
// Core WebSocket Types
// ======================

export interface WebSocketConnection {
  id: string;
  userId?: string;
  clientType: "dashboard" | "agent" | "admin" | "mobile";
  subscriptions: Set<string>;
  lastActivity: number;
  isAuthenticated: boolean;
  metadata?: Record<string, any>;
}

export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  channel: string;
  data: T;
  timestamp: number;
  messageId: string;
  userId?: string;
  acknowledgment?: boolean;
  error?: string;
}

export type WebSocketMessageType =
  // System Messages
  | "system:connect"
  | "system:disconnect"
  | "system:heartbeat"
  | "system:error"
  | "system:ack"

  // Agent Status Messages
  | "agent:status"
  | "agent:health"
  | "agent:performance"
  | "agent:workflow"
  | "agent:error"
  | "agent:cache"

  // Trading Data Messages
  | "trading:price"
  | "trading:signal"
  | "trading:execution"
  | "trading:balance"
  | "trading:portfolio"
  | "trading:orderbook"

  // Pattern Discovery Messages
  | "pattern:discovery"
  | "pattern:validation"
  | "pattern:confidence"
  | "pattern:alert"
  | "pattern:ready_state"

  // User Notifications
  | "notification:info"
  | "notification:warning"
  | "notification:error"
  | "notification:success"
  | "notification:trade"

  // Subscription Management
  | "subscription:subscribe"
  | "subscription:unsubscribe"
  | "subscription:list";

// ======================
// Agent Message Types
// ======================

export interface AgentStatusMessage {
  agentId: string;
  agentType: string;
  status: "healthy" | "degraded" | "unhealthy" | "offline";
  lastActivity: number;
  responseTime: number;
  errorCount: number;
  cacheHitRate: number;
  workflowsActive: number;
  metadata?: {
    version?: string;
    memory?: number;
    cpu?: number;
    uptime?: number;
  };
}

export interface AgentHealthMessage {
  agentId: string;
  health: {
    status: "healthy" | "degraded" | "unhealthy";
    issues: string[];
    recommendations: string[];
    performanceMetrics: {
      averageResponseTime: number;
      successRate: number;
      errorRate: number;
      cacheHitRate: number;
    };
  };
  coordination: {
    registryHealthy: boolean;
    workflowEngineHealthy: boolean;
    performanceCollectorHealthy: boolean;
    totalAgents: number;
    healthyAgents: number;
    degradedAgents: number;
    unhealthyAgents: number;
  };
}

export interface AgentPerformanceMessage {
  agentId: string;
  metrics: {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    errorRate: number;
    cacheHitRate: number;
    lastExecution: string;
  };
  workflow: {
    workflowsExecuted: number;
    averageWorkflowDuration: number;
    performanceSummary: any;
  };
}

export interface AgentWorkflowMessage {
  workflowId: string;
  workflowType: "calendar_discovery" | "symbol_analysis" | "pattern_analysis" | "trading_strategy";
  status: "started" | "running" | "completed" | "failed" | "cancelled";
  progress: number; // 0-100
  agentsInvolved: string[];
  currentAgent?: string;
  result?: any;
  error?: string;
  metadata: {
    startTime: number;
    duration?: number;
    requestId?: string;
    userId?: string;
  };
}

export interface AgentErrorMessage {
  agentId: string;
  error: {
    type: "api_error" | "timeout" | "rate_limit" | "network" | "validation" | "unknown";
    message: string;
    stack?: string;
    timestamp: number;
    severity: "low" | "medium" | "high" | "critical";
  };
  context?: {
    workflowId?: string;
    endpoint?: string;
    userId?: string;
    retryCount?: number;
  };
}

// ======================
// Trading Message Types
// ======================

export interface TradingPriceMessage {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
  source: "mexc_ws" | "mexc_api" | "cached";
  metadata?: {
    high24h?: number;
    low24h?: number;
    volume24h?: number;
    lastUpdate?: number;
  };
}

export interface TradingSignalMessage {
  signalId: string;
  symbol: string;
  type: "buy" | "sell" | "hold" | "monitor";
  strength: number; // 0-100
  confidence: number; // 0-100
  source: "pattern_discovery" | "symbol_analysis" | "strategy_agent" | "manual";
  reasoning: string;
  targetPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe: string;
  timestamp: number;
  metadata?: {
    patterns?: string[];
    indicators?: Record<string, number>;
    riskLevel?: "low" | "medium" | "high";
    expectedDuration?: number;
  };
}

export interface TradingExecutionMessage {
  executionId: string;
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  status: "pending" | "filled" | "partially_filled" | "cancelled" | "rejected";
  quantity: number;
  price: number;
  executedQuantity: number;
  executedPrice: number;
  timestamp: number;
  fees?: {
    amount: number;
    currency: string;
  };
  metadata?: {
    strategy?: string;
    agentId?: string;
    workflowId?: string;
    reason?: string;
  };
}

export interface TradingBalanceMessage {
  userId: string;
  balances: Array<{
    asset: string;
    available: number;
    locked: number;
    total: number;
  }>;
  totalValue: {
    usd: number;
    btc: number;
  };
  lastUpdate: number;
  source: "mexc_api" | "calculated";
}

export interface TradingPortfolioMessage {
  userId: string;
  portfolio: {
    totalValue: number;
    dayChange: number;
    dayChangePercent: number;
    positions: Array<{
      symbol: string;
      quantity: number;
      averagePrice: number;
      currentPrice: number;
      unrealizedPnl: number;
      unrealizedPnlPercent: number;
    }>;
  };
  performance: {
    totalReturn: number;
    totalReturnPercent: number;
    bestPerformer: string;
    worstPerformer: string;
  };
  timestamp: number;
}

// ======================
// Pattern Discovery Message Types
// ======================

export interface PatternDiscoveryMessage {
  patternId: string;
  symbol: string;
  pattern: {
    type: "ready_state" | "breakout" | "reversal" | "continuation" | "custom";
    name: string;
    description: string;
    confidence: number; // 0-100
    strength: number; // 0-100
  };
  timing: {
    detectedAt: number;
    estimatedExecution: number;
    advanceNotice: number; // milliseconds
    timeframe: string;
  };
  criteria: {
    sts?: number; // Symbol Trading Status
    st?: number; // Status
    tt?: number; // Trading Time
    additional?: Record<string, any>;
  };
  metadata?: {
    agentId?: string;
    workflowId?: string;
    correlatedSymbols?: string[];
    riskFactors?: string[];
  };
}

export interface PatternValidationMessage {
  patternId: string;
  symbol: string;
  validation: {
    status: "validated" | "invalidated" | "pending" | "expired";
    confidence: number;
    score: number;
    reasons: string[];
  };
  execution: {
    executed: boolean;
    executionTime?: number;
    result?: "success" | "failure" | "partial";
    actualPrice?: number;
    expectedPrice?: number;
  };
  timestamp: number;
}

export interface PatternReadyStateMessage {
  symbol: string;
  vcoinId: string;
  readyState: {
    sts: number;
    st: number;
    tt: number;
    isReady: boolean;
    confidence: number;
    estimatedLaunchTime?: number;
  };
  analysis: {
    advanceNotice: number; // milliseconds
    riskLevel: "low" | "medium" | "high";
    expectedVolatility: number;
    correlatedSymbols: string[];
  };
  timestamp: number;
  metadata?: {
    agentId?: string;
    attempt?: number;
    launchTime?: string;
  };
}

// ======================
// Notification Message Types
// ======================

export interface NotificationMessage {
  notificationId: string;
  userId?: string;
  type: "info" | "warning" | "error" | "success" | "trade";
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "critical";
  category: "system" | "trading" | "agent" | "pattern" | "security";
  timestamp: number;
  expiresAt?: number;
  actionable?: boolean;
  actions?: Array<{
    label: string;
    action: string;
    params?: Record<string, any>;
  }>;
  metadata?: {
    symbol?: string;
    agentId?: string;
    workflowId?: string;
    amount?: number;
    relatedId?: string;
  };
}

// ======================
// Subscription Management
// ======================

export interface SubscriptionRequest {
  channel: string;
  filters?: Record<string, any>;
  options?: {
    throttleMs?: number;
    priority?: "low" | "medium" | "high";
    bufferSize?: number;
  };
}

export interface SubscriptionResponse {
  channel: string;
  subscribed: boolean;
  error?: string;
  subscriberCount?: number;
}

// ======================
// Channel Definitions
// ======================

export type WebSocketChannel =
  // System Channels
  | "system"
  | "system:health"

  // Agent Channels
  | "agents:status"
  | "agents:health"
  | "agents:performance"
  | "agents:workflows"
  | "agents:errors"

  // Specific Agent Channels
  | `agent:${string}:status`
  | `agent:${string}:workflow`
  | `agent:${string}:performance`

  // Trading Channels
  | "trading:prices"
  | "trading:signals"
  | "trading:executions"
  | "trading:balance"
  | "trading:portfolio"

  // Symbol-specific Trading Channels
  | `trading:${string}:price`
  | `trading:${string}:signals`
  | `trading:${string}:orderbook`

  // Pattern Discovery Channels
  | "patterns:discovery"
  | "patterns:validation"
  | "patterns:ready_state"
  | "patterns:alerts"

  // Symbol-specific Pattern Channels
  | `patterns:${string}:discovery`
  | `patterns:${string}:ready_state`

  // User-specific Channels
  | `user:${string}:notifications`
  | `user:${string}:trading`
  | `user:${string}:portfolio`
  | `user:${string}:alerts`

  // Notification Channels
  | "notifications:global"
  | "notifications:trading"
  | "notifications:system"
  | "notifications:agents";

// ======================
// WebSocket Events
// ======================

export interface WebSocketEventMap {
  // Connection Events
  "connection:open": { connectionId: string; userId?: string };
  "connection:close": { connectionId: string; reason: string };
  "connection:error": { connectionId: string; error: string };

  // Message Events
  "message:received": { message: WebSocketMessage; connectionId: string };
  "message:sent": { message: WebSocketMessage; connectionId: string };
  "message:error": { error: string; connectionId: string; messageId?: string };

  // Subscription Events
  "subscription:added": { channel: string; connectionId: string };
  "subscription:removed": { channel: string; connectionId: string };

  // System Events
  "system:health_check": { timestamp: number; healthy: boolean };
  "system:agent_status": { agentId: string; status: string };
  "system:performance": { metrics: any };
}

// ======================
// Configuration Types
// ======================

export interface WebSocketServerConfig {
  port: number;
  host?: string;
  path?: string;
  authentication: {
    required: boolean;
    tokenValidation: (token: string) => Promise<{ valid: boolean; userId?: string }>;
  };
  rateLimiting: {
    enabled: boolean;
    maxConnections: number;
    maxMessagesPerMinute: number;
    blockDuration: number;
  };
  performance: {
    heartbeatInterval: number;
    pingTimeout: number;
    maxPayloadSize: number;
    compressionEnabled: boolean;
  };
  monitoring: {
    metricsEnabled: boolean;
    loggingLevel: "debug" | "info" | "warn" | "error";
    healthCheckInterval: number;
  };
}

export interface WebSocketClientConfig {
  url: string;
  authentication?: {
    token: string;
    autoRefresh: boolean;
  };
  reconnection: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
    maxDelay: number;
  };
  performance: {
    heartbeatEnabled: boolean;
    compressionEnabled: boolean;
    bufferSize: number;
  };
  debug: boolean;
}

// ======================
// Utility Types
// ======================

export type MessageHandler<T = any> = (message: WebSocketMessage<T>) => void | Promise<void>;

export type ChannelFilter = (data: any) => boolean;

export interface ConnectionMetrics {
  connectionId: string;
  userId?: string;
  connectedAt: number;
  lastActivity: number;
  messagesSent: number;
  messagesReceived: number;
  subscriptions: string[];
  latency?: number;
}

export interface ServerMetrics {
  totalConnections: number;
  authenticatedConnections: number;
  totalChannels: number;
  totalSubscriptions: number;
  messagesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  uptime: number;
}

// ======================
// Error Types
// ======================

export interface WebSocketError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  connectionId?: string;
  recoverable: boolean;
}

export type WebSocketErrorCode =
  | "AUTH_FAILED"
  | "AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "INVALID_MESSAGE"
  | "CHANNEL_NOT_FOUND"
  | "SUBSCRIPTION_FAILED"
  | "CONNECTION_LOST"
  | "SERVER_ERROR"
  | "CLIENT_ERROR"
  | "TIMEOUT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_OPERATION";
