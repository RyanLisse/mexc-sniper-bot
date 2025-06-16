/**
 * WebSocket Agent Bridge
 *
 * Bridges the 11-agent AI system with real-time WebSocket communication.
 * Provides live streaming of agent status, workflow progress, and results.
 *
 * Features:
 * - Real-time agent status broadcasting
 * - Live workflow execution updates
 * - Pattern discovery result streaming
 * - Agent health monitoring
 * - Performance metrics broadcasting
 * - Error and alert distribution
 */

import { EventEmitter } from "node:events";
import type {
  AgentErrorMessage,
  AgentHealthMessage,
  AgentStatusMessage,
  AgentWorkflowMessage,
  NotificationMessage,
  PatternDiscoveryMessage,
  PatternReadyStateMessage,
  TradingSignalMessage,
} from "@/src/lib/websocket-types";
import type { AgentRegistry } from "@/src/mexc-agents/coordination/agent-registry";
import type { EnhancedMexcOrchestrator } from "@/src/mexc-agents/coordination/enhanced-orchestrator";
import type { PerformanceCollector } from "@/src/mexc-agents/coordination/performance-collector";
import type { WorkflowEngine } from "@/src/mexc-agents/coordination/workflow-engine";
import type { MexcWorkflowResult } from "@/src/mexc-agents/orchestrator-types";
import { webSocketServer } from "@/src/services/websocket-server";

// ======================
// Agent Status Tracker
// ======================

interface AgentStatusTracker {
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

interface WorkflowTracker {
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

// ======================
// Real-time Data Streamer
// ======================

class RealTimeDataStreamer extends EventEmitter {
  private updateInterval?: NodeJS.Timeout;
  private agentTrackers = new Map<string, AgentStatusTracker>();
  private workflowTrackers = new Map<string, WorkflowTracker>();
  private isStreaming = false;

  constructor(private updateIntervalMs = 5000) {
    super();
  }

  start(): void {
    if (this.isStreaming) return;

    this.isStreaming = true;
    this.updateInterval = setInterval(() => {
      this.broadcastAgentStatuses();
      this.broadcastWorkflowStatuses();
    }, this.updateIntervalMs);

    console.log("[WebSocket Bridge] Real-time streaming started");
  }

  stop(): void {
    if (!this.isStreaming) return;

    this.isStreaming = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    console.log("[WebSocket Bridge] Real-time streaming stopped");
  }

  updateAgentStatus(agentId: string, agentType: string, metrics: any): void {
    const tracker: AgentStatusTracker = {
      agentId,
      agentType,
      lastUpdate: Date.now(),
      status: this.calculateAgentStatus(metrics),
      metrics: {
        responseTime: metrics.averageResponseTime || 0,
        errorCount: metrics.errorCount || 0,
        successRate: metrics.successRate || 1,
        cacheHitRate: metrics.cacheHitRate || 0,
        workflowsActive: metrics.workflowsActive || 0,
      },
      metadata: {
        version: metrics.version || "1.0.0",
        memory: metrics.memory || 0,
        cpu: metrics.cpu || 0,
        uptime: metrics.uptime || 0,
      },
    };

    this.agentTrackers.set(agentId, tracker);
    this.broadcastAgentStatus(tracker);
  }

  updateWorkflowStatus(
    workflowId: string,
    workflowType: string,
    status: WorkflowTracker["status"],
    progress: number,
    agentsInvolved: string[],
    currentAgent?: string,
    metadata: Record<string, any> = {}
  ): void {
    const existing = this.workflowTrackers.get(workflowId);

    const tracker: WorkflowTracker = {
      workflowId,
      workflowType,
      status,
      progress,
      agentsInvolved,
      currentAgent,
      startTime: existing?.startTime || Date.now(),
      lastUpdate: Date.now(),
      metadata: { ...existing?.metadata, ...metadata },
    };

    this.workflowTrackers.set(workflowId, tracker);
    this.broadcastWorkflowStatus(tracker);

    // Clean up completed workflows after 5 minutes
    if (status === "completed" || status === "failed" || status === "cancelled") {
      setTimeout(
        () => {
          this.workflowTrackers.delete(workflowId);
        },
        5 * 60 * 1000
      );
    }
  }

  private calculateAgentStatus(metrics: any): AgentStatusTracker["status"] {
    const errorRate = metrics.errorRate || 0;
    const responseTime = metrics.averageResponseTime || 0;
    const successRate = metrics.successRate || 1;

    if (errorRate > 0.2 || responseTime > 5000 || successRate < 0.8) {
      return "unhealthy";
    }
    if (errorRate > 0.1 || responseTime > 3000 || successRate < 0.9) {
      return "degraded";
    }
    return "healthy";
  }

  private broadcastAgentStatuses(): void {
    for (const tracker of this.agentTrackers.values()) {
      this.broadcastAgentStatus(tracker);
    }
  }

  private broadcastWorkflowStatuses(): void {
    for (const tracker of this.workflowTrackers.values()) {
      this.broadcastWorkflowStatus(tracker);
    }
  }

  private broadcastAgentStatus(tracker: AgentStatusTracker): void {
    const message: AgentStatusMessage = {
      agentId: tracker.agentId,
      agentType: tracker.agentType,
      status: tracker.status,
      lastActivity: tracker.lastUpdate,
      responseTime: tracker.metrics.responseTime,
      errorCount: tracker.metrics.errorCount,
      cacheHitRate: tracker.metrics.cacheHitRate,
      workflowsActive: tracker.metrics.workflowsActive,
      metadata: tracker.metadata,
    };

    webSocketServer.broadcastAgentStatus(message);
  }

  private broadcastWorkflowStatus(tracker: WorkflowTracker): void {
    const message: AgentWorkflowMessage = {
      workflowId: tracker.workflowId,
      workflowType: tracker.workflowType as any,
      status: tracker.status,
      progress: tracker.progress,
      agentsInvolved: tracker.agentsInvolved,
      currentAgent: tracker.currentAgent,
      metadata: {
        startTime: tracker.startTime,
        duration: tracker.lastUpdate - tracker.startTime,
        ...tracker.metadata,
      },
    };

    webSocketServer.broadcast({
      type: "agent:workflow",
      channel: "agents:workflows",
      data: message,
    });
  }
}

// ======================
// Pattern Discovery Streamer
// ======================

class PatternDiscoveryStreamer {
  private patternBuffer = new Map<string, PatternDiscoveryMessage>();
  private readyStateBuffer = new Map<string, PatternReadyStateMessage>();

  broadcastPatternDiscovery(pattern: {
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
  }): void {
    const message: PatternDiscoveryMessage = {
      patternId: pattern.patternId,
      symbol: pattern.symbol,
      pattern: {
        type: pattern.type as any,
        name: pattern.name,
        description: pattern.description,
        confidence: pattern.confidence,
        strength: pattern.strength,
      },
      timing: {
        detectedAt: pattern.detectedAt,
        estimatedExecution: pattern.estimatedExecution,
        advanceNotice: pattern.estimatedExecution - pattern.detectedAt,
        timeframe: "1h", // Default timeframe
      },
      criteria: pattern.criteria,
      metadata: pattern.metadata,
    };

    this.patternBuffer.set(pattern.patternId, message);
    webSocketServer.broadcastPatternDiscovery(message);

    // Broadcast pattern alert if high confidence
    if (pattern.confidence > 0.8) {
      this.broadcastPatternAlert(message);
    }
  }

  broadcastReadyStatePattern(data: {
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
  }): void {
    const isReady = data.sts === 2 && data.st === 2 && data.tt === 4;
    const advanceNotice = data.estimatedLaunchTime ? data.estimatedLaunchTime - Date.now() : 0;

    const message: PatternReadyStateMessage = {
      symbol: data.symbol,
      vcoinId: data.vcoinId,
      readyState: {
        sts: data.sts,
        st: data.st,
        tt: data.tt,
        isReady,
        confidence: data.confidence,
        estimatedLaunchTime: data.estimatedLaunchTime,
      },
      analysis: {
        advanceNotice,
        riskLevel: data.riskLevel,
        expectedVolatility: data.expectedVolatility,
        correlatedSymbols: data.correlatedSymbols,
      },
      timestamp: Date.now(),
      metadata: data.metadata,
    };

    this.readyStateBuffer.set(data.symbol, message);

    webSocketServer.broadcast({
      type: "pattern:ready_state",
      channel: "patterns:ready_state",
      data: message,
    });

    // Also broadcast to symbol-specific channel
    webSocketServer.broadcast({
      type: "pattern:ready_state",
      channel: `patterns:${data.symbol}:ready_state`,
      data: message,
    });

    // Send high-priority notification if ready
    if (isReady) {
      this.broadcastReadyStateAlert(message);
    }
  }

  private broadcastPatternAlert(pattern: PatternDiscoveryMessage): void {
    const notification: NotificationMessage = {
      notificationId: crypto.randomUUID(),
      type: "info",
      title: "Pattern Discovered",
      message: `High confidence ${pattern.pattern.type} pattern detected for ${pattern.symbol}`,
      priority: "high",
      category: "pattern",
      timestamp: Date.now(),
      actionable: true,
      actions: [
        {
          label: "View Details",
          action: "navigate",
          params: { path: `/patterns/${pattern.patternId}` },
        },
        {
          label: "Create Strategy",
          action: "create_strategy",
          params: { symbol: pattern.symbol, patternId: pattern.patternId },
        },
      ],
      metadata: {
        symbol: pattern.symbol,
        patternId: pattern.patternId,
      },
    };

    webSocketServer.broadcastNotification(notification);
  }

  private broadcastReadyStateAlert(readyState: PatternReadyStateMessage): void {
    const notification: NotificationMessage = {
      notificationId: crypto.randomUUID(),
      type: "success",
      title: "Symbol Ready for Trading",
      message: `${readyState.symbol} is now ready for trading (sts:${readyState.readyState.sts}, st:${readyState.readyState.st}, tt:${readyState.readyState.tt})`,
      priority: "critical",
      category: "pattern",
      timestamp: Date.now(),
      actionable: true,
      actions: [
        {
          label: "Execute Trade",
          action: "execute_trade",
          params: { symbol: readyState.symbol, vcoinId: readyState.vcoinId },
        },
        {
          label: "Monitor Price",
          action: "monitor_price",
          params: { symbol: readyState.symbol },
        },
      ],
      metadata: {
        symbol: readyState.symbol,
        vcoinId: readyState.vcoinId,
      },
    };

    webSocketServer.broadcastNotification(notification);
  }
}

// ======================
// Trading Signal Streamer
// ======================

class TradingSignalStreamer {
  broadcastTradingSignal(signal: {
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
  }): void {
    const message: TradingSignalMessage = {
      signalId: signal.signalId,
      symbol: signal.symbol,
      type: signal.type,
      strength: signal.strength,
      confidence: signal.confidence,
      source: signal.source as any,
      reasoning: signal.reasoning,
      targetPrice: signal.targetPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      timeframe: signal.timeframe,
      timestamp: Date.now(),
      metadata: signal.metadata,
    };

    webSocketServer.broadcast({
      type: "trading:signal",
      channel: "trading:signals",
      data: message,
    });

    // Also broadcast to symbol-specific channel
    webSocketServer.broadcast({
      type: "trading:signal",
      channel: `trading:${signal.symbol}:signals`,
      data: message,
    });

    // Send notification for high-strength signals
    if (signal.strength > 80 && signal.confidence > 0.8) {
      this.broadcastSignalAlert(message);
    }
  }

  private broadcastSignalAlert(signal: TradingSignalMessage): void {
    const notification: NotificationMessage = {
      notificationId: crypto.randomUUID(),
      type: signal.type === "buy" ? "success" : signal.type === "sell" ? "warning" : "info",
      title: "High-Strength Trading Signal",
      message: `${signal.type.toUpperCase()} signal for ${signal.symbol} (Strength: ${signal.strength}%, Confidence: ${Math.round(signal.confidence * 100)}%)`,
      priority: "high",
      category: "trading",
      timestamp: Date.now(),
      actionable: true,
      actions: [
        {
          label: "View Signal",
          action: "navigate",
          params: { path: `/signals/${signal.signalId}` },
        },
        {
          label: "Execute Trade",
          action: "execute_trade",
          params: {
            symbol: signal.symbol,
            type: signal.type,
            signalId: signal.signalId,
          },
        },
      ],
      metadata: {
        symbol: signal.symbol,
        signalId: signal.signalId,
        strength: signal.strength,
        confidence: signal.confidence,
      },
    };

    webSocketServer.broadcastNotification(notification);
  }
}

// ======================
// Main WebSocket Agent Bridge
// ======================

export class WebSocketAgentBridge extends EventEmitter {
  private static instance: WebSocketAgentBridge;
  private dataStreamer: RealTimeDataStreamer;
  private patternStreamer: PatternDiscoveryStreamer;
  private signalStreamer: TradingSignalStreamer;
  private orchestrator?: EnhancedMexcOrchestrator;
  private agentRegistry?: AgentRegistry;
  private isInitialized = false;
  private isRunning = false;

  constructor() {
    super();
    this.dataStreamer = new RealTimeDataStreamer();
    this.patternStreamer = new PatternDiscoveryStreamer();
    this.signalStreamer = new TradingSignalStreamer();
  }

  static getInstance(): WebSocketAgentBridge {
    if (!WebSocketAgentBridge.instance) {
      WebSocketAgentBridge.instance = new WebSocketAgentBridge();
    }
    return WebSocketAgentBridge.instance;
  }

  async initialize(
    orchestrator: EnhancedMexcOrchestrator,
    agentRegistry: AgentRegistry,
    workflowEngine: WorkflowEngine,
    performanceCollector: PerformanceCollector
  ): Promise<void> {
    if (this.isInitialized) return;

    console.log("[WebSocket Bridge] Initializing...");

    this.orchestrator = orchestrator;
    this.agentRegistry = agentRegistry;

    // Set up event listeners for agent system
    this.setupAgentEventListeners(agentRegistry, workflowEngine, performanceCollector);

    // Set up WebSocket server message handlers
    this.setupWebSocketHandlers();

    this.isInitialized = true;
    console.log("[WebSocket Bridge] Initialization complete");
  }

  start(): void {
    if (!this.isInitialized || this.isRunning) return;

    console.log("[WebSocket Bridge] Starting real-time communication...");

    this.dataStreamer.start();
    this.isRunning = true;

    // Start periodic agent health broadcasts
    this.startHealthBroadcasts();

    console.log("[WebSocket Bridge] Real-time communication started");
    this.emit("started");
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log("[WebSocket Bridge] Stopping real-time communication...");

    this.dataStreamer.stop();
    this.isRunning = false;

    console.log("[WebSocket Bridge] Real-time communication stopped");
    this.emit("stopped");
  }

  // ======================
  // Public Broadcasting Methods
  // ======================

  broadcastAgentUpdate(agentId: string, agentType: string, data: any): void {
    if (!this.isRunning) return;

    this.dataStreamer.updateAgentStatus(agentId, agentType, data);
  }

  broadcastWorkflowProgress(
    workflowId: string,
    workflowType: string,
    status: string,
    progress: number,
    agentsInvolved: string[],
    currentAgent?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.isRunning) return;

    this.dataStreamer.updateWorkflowStatus(
      workflowId,
      workflowType,
      status as any,
      progress,
      agentsInvolved,
      currentAgent,
      metadata
    );
  }

  broadcastPatternDiscovery(pattern: any): void {
    if (!this.isRunning) return;

    this.patternStreamer.broadcastPatternDiscovery({
      patternId: pattern.id || crypto.randomUUID(),
      symbol: pattern.symbol,
      type: pattern.type || "ready_state",
      name: pattern.name || "Pattern Discovery",
      description: pattern.description || "Automated pattern detection",
      confidence: pattern.confidence || 0.8,
      strength: pattern.strength || 0.7,
      detectedAt: Date.now(),
      estimatedExecution: pattern.estimatedExecution || Date.now() + 3600000, // 1 hour
      criteria: pattern.criteria || {},
      metadata: pattern.metadata,
    });
  }

  broadcastReadyStatePattern(symbol: string, data: any): void {
    if (!this.isRunning) return;

    this.patternStreamer.broadcastReadyStatePattern({
      symbol,
      vcoinId: data.vcoinId || symbol,
      sts: data.sts || 0,
      st: data.st || 0,
      tt: data.tt || 0,
      confidence: data.confidence || 0.8,
      estimatedLaunchTime: data.estimatedLaunchTime,
      riskLevel: data.riskLevel || "medium",
      expectedVolatility: data.expectedVolatility || 0.1,
      correlatedSymbols: data.correlatedSymbols || [],
      metadata: data.metadata,
    });
  }

  broadcastTradingSignal(signal: any): void {
    if (!this.isRunning) return;

    this.signalStreamer.broadcastTradingSignal({
      signalId: signal.id || crypto.randomUUID(),
      symbol: signal.symbol,
      type: signal.type || "hold",
      strength: signal.strength || 50,
      confidence: signal.confidence || 0.5,
      source: signal.source || "ai_agent",
      reasoning: signal.reasoning || "Automated signal generation",
      targetPrice: signal.targetPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      timeframe: signal.timeframe || "1h",
      metadata: signal.metadata,
    });
  }

  broadcastAgentError(agentId: string, error: any): void {
    if (!this.isRunning) return;

    const errorMessage: AgentErrorMessage = {
      agentId,
      error: {
        type: error.type || "unknown",
        message: error.message || "Unknown error",
        stack: error.stack,
        timestamp: Date.now(),
        severity: error.severity || "medium",
      },
      context: error.context,
    };

    webSocketServer.broadcast({
      type: "agent:error",
      channel: "agents:errors",
      data: errorMessage,
    });

    // Send error notification for critical errors
    if (error.severity === "critical" || error.severity === "high") {
      const notification: NotificationMessage = {
        notificationId: crypto.randomUUID(),
        type: "error",
        title: "Agent Error",
        message: `${agentId}: ${error.message}`,
        priority: error.severity === "critical" ? "critical" : "high",
        category: "agent",
        timestamp: Date.now(),
        metadata: {
          agentId,
          errorType: error.type,
        },
      };

      webSocketServer.broadcastNotification(notification);
    }
  }

  // ======================
  // Private Methods
  // ======================

  private setupAgentEventListeners(
    agentRegistry: AgentRegistry,
    workflowEngine: WorkflowEngine,
    performanceCollector: PerformanceCollector
  ): void {
    // Listen for agent status changes
    agentRegistry.on?.("agent:status_changed", (data) => {
      this.broadcastAgentUpdate(data.agentId, data.agentType, data.status);
    });

    agentRegistry.on?.("agent:error", (data) => {
      this.broadcastAgentError(data.agentId, data.error);
    });

    // Listen for workflow events
    workflowEngine.on?.("workflow:started", (data) => {
      this.broadcastWorkflowProgress(
        data.workflowId,
        data.workflowType,
        "started",
        0,
        data.agentsInvolved,
        undefined,
        { requestId: data.requestId }
      );
    });

    workflowEngine.on?.("workflow:progress", (data) => {
      this.broadcastWorkflowProgress(
        data.workflowId,
        data.workflowType,
        "running",
        data.progress,
        data.agentsInvolved,
        data.currentAgent,
        data.metadata
      );
    });

    workflowEngine.on?.("workflow:completed", (data) => {
      this.broadcastWorkflowProgress(
        data.workflowId,
        data.workflowType,
        "completed",
        100,
        data.agentsInvolved,
        undefined,
        { result: data.result, duration: data.duration }
      );
    });

    workflowEngine.on?.("workflow:failed", (data) => {
      this.broadcastWorkflowProgress(
        data.workflowId,
        data.workflowType,
        "failed",
        data.progress || 0,
        data.agentsInvolved,
        undefined,
        { error: data.error, duration: data.duration }
      );
    });

    // Listen for performance updates
    performanceCollector.on?.("metrics:updated", (data) => {
      for (const [agentId, metrics] of Object.entries(data.agentMetrics || {})) {
        this.broadcastAgentUpdate(agentId, "unknown", metrics);
      }
    });
  }

  private setupWebSocketHandlers(): void {
    // Handle workflow execution requests from WebSocket clients
    webSocketServer.addMessageHandler("agents:workflows", async (message) => {
      if (message.type === "agent:workflow" && message.data.action === "execute") {
        await this.handleWorkflowExecutionRequest(message.data);
      }
    });

    // Handle agent command requests
    webSocketServer.addMessageHandler("agents:status", async (message) => {
      if (message.data.action === "health_check") {
        await this.broadcastAgentHealthStatus();
      }
    });
  }

  private async handleWorkflowExecutionRequest(data: any): Promise<void> {
    if (!this.orchestrator) {
      console.error("[WebSocket Bridge] Orchestrator not available for workflow execution");
      return;
    }

    try {
      const { workflowType, request } = data;

      let result: MexcWorkflowResult;

      switch (workflowType) {
        case "calendar_discovery":
          result = await this.orchestrator.executeCalendarDiscoveryWorkflow(request);
          break;
        case "symbol_analysis":
          result = await this.orchestrator.executeSymbolAnalysisWorkflow(request);
          break;
        case "pattern_analysis":
          result = await this.orchestrator.executePatternAnalysisWorkflow(request);
          break;
        case "trading_strategy":
          result = await this.orchestrator.executeTradingStrategyWorkflow(request);
          break;
        default:
          throw new Error(`Unknown workflow type: ${workflowType}`);
      }

      // Broadcast result
      webSocketServer.broadcast({
        type: "agent:workflow",
        channel: "agents:workflows",
        data: {
          workflowId: data.workflowId || crypto.randomUUID(),
          workflowType,
          status: result.success ? "completed" : "failed",
          progress: 100,
          result: result.data,
          error: result.error,
        },
      });
    } catch (error) {
      console.error("[WebSocket Bridge] Workflow execution failed:", error);

      webSocketServer.broadcast({
        type: "agent:workflow",
        channel: "agents:workflows",
        data: {
          workflowId: data.workflowId || crypto.randomUUID(),
          workflowType: data.workflowType,
          status: "failed",
          progress: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  private async broadcastAgentHealthStatus(): Promise<void> {
    if (!this.orchestrator) return;

    try {
      const health = await this.orchestrator.getAgentHealth();
      const metrics = this.orchestrator.getOrchestrationMetrics();

      const healthMessage: AgentHealthMessage = {
        agentId: "orchestrator",
        health: {
          status: health.coordination.registryHealthy ? "healthy" : "unhealthy",
          issues: [],
          recommendations: [],
          performanceMetrics: {
            averageResponseTime: metrics.averageDuration,
            successRate: metrics.successRate,
            errorRate: metrics.errorRate,
            cacheHitRate: 0.8, // Default value
          },
        },
        coordination: health.coordination,
      };

      webSocketServer.broadcast({
        type: "agent:health",
        channel: "agents:health",
        data: healthMessage,
      });
    } catch (error) {
      console.error("[WebSocket Bridge] Failed to broadcast health status:", error);
    }
  }

  private startHealthBroadcasts(): void {
    // Broadcast health status every 30 seconds
    setInterval(() => {
      this.broadcastAgentHealthStatus();
    }, 30000);

    // Initial broadcast
    setTimeout(() => {
      this.broadcastAgentHealthStatus();
    }, 1000);
  }

  // ======================
  // Public Status Methods
  // ======================

  isRunning(): boolean {
    return this.isRunning;
  }

  isInitialized(): boolean {
    return this.isInitialized;
  }

  getStatus(): {
    initialized: boolean;
    running: boolean;
    connectedClients: number;
    dataStreaming: boolean;
  } {
    const serverMetrics = webSocketServer.getServerMetrics();

    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      connectedClients: serverMetrics.totalConnections,
      dataStreaming: this.dataStreamer.isStreaming,
    };
  }
}

// Export singleton instance
export const webSocketAgentBridge = WebSocketAgentBridge.getInstance();
