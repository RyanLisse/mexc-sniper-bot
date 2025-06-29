/**
 * Main WebSocket Agent Bridge
 * 
 * Orchestrates real-time communication between the agent system and WebSocket clients
 */

import { EventEmitter } from "node:events";
import type {
  AgentErrorMessage,
  AgentHealthMessage,
  NotificationMessage,
} from "@/src/lib/websocket-types";
import { webSocketServer } from "@/src/services/data/websocket-server";
import type { AgentRegistry } from "../coordination/agent-registry";
import type { EnhancedMexcOrchestrator } from "../coordination/enhanced-orchestrator";
import type { PerformanceCollector } from "../coordination/performance-collector";
import type { WorkflowEngine } from "../coordination/workflow-engine";
import type { MexcWorkflowResult } from "../orchestrator-types";
import { PatternDiscoveryStreamer } from "./streamers/pattern-discovery-streamer";
import { RealTimeDataStreamer } from "./streamers/real-time-data-streamer";
import { TradingSignalStreamer } from "./streamers/trading-signal-streamer";
import type { 
  BridgeStatus, 
  PatternDiscoveryData,
  ReadyStateData,
  TradingSignalData, 
  WorkflowExecutionRequest
} from "./types";

export class WebSocketAgentBridge extends EventEmitter {
  private static instance: WebSocketAgentBridge;
  private dataStreamer: RealTimeDataStreamer;
  private patternStreamer: PatternDiscoveryStreamer;
  private signalStreamer: TradingSignalStreamer;
  private orchestrator?: EnhancedMexcOrchestrator;
  private agentRegistry?: AgentRegistry;
  private isInitialized = false;
  private _isRunning = false;

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

    console.info("[WebSocket Bridge] Initializing...");

    this.orchestrator = orchestrator;
    this.agentRegistry = agentRegistry;

    // Set up event listeners for agent system
    this.setupAgentEventListeners(agentRegistry, workflowEngine, performanceCollector);

    // Set up WebSocket server message handlers
    this.setupWebSocketHandlers();

    this.isInitialized = true;
    console.info("[WebSocket Bridge] Initialization complete");
  }

  start(): void {
    if (!this.isInitialized || this._isRunning) return;

    console.info("[WebSocket Bridge] Starting real-time communication...");

    this.dataStreamer.start();
    this._isRunning = true;

    // Start periodic agent health broadcasts
    this.startHealthBroadcasts();

    console.info("[WebSocket Bridge] Real-time communication started");
    this.emit("started");
  }

  stop(): void {
    if (!this._isRunning) return;

    console.info("[WebSocket Bridge] Stopping real-time communication...");

    this.dataStreamer.stop();
    this._isRunning = false;

    console.info("[WebSocket Bridge] Real-time communication stopped");
    this.emit("stopped");
  }

  // ======================
  // Public Broadcasting Methods
  // ======================

  broadcastAgentUpdate(agentId: string, agentType: string, data: any): void {
    if (!this._isRunning) return;
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
    if (!this._isRunning) return;

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
    if (!this._isRunning) return;

    const patternData: PatternDiscoveryData = {
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
    };

    this.patternStreamer.broadcastPatternDiscovery(patternData);
  }

  broadcastReadyStatePattern(symbol: string, data: any): void {
    if (!this._isRunning) return;

    const readyStateData: ReadyStateData = {
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
    };

    this.patternStreamer.broadcastReadyStatePattern(readyStateData);
  }

  broadcastTradingSignal(signal: any): void {
    if (!this._isRunning) return;

    const signalData: TradingSignalData = {
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
    };

    this.signalStreamer.broadcastTradingSignal(signalData);
  }

  broadcastAgentError(agentId: string, error: any): void {
    if (!this._isRunning) return;

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
        } as any,
      };

      webSocketServer.broadcastNotification(notification);
    }
  }

  // ======================
  // Public Status Methods
  // ======================

  isRunning(): boolean {
    return this._isRunning;
  }

  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  getStatus(): BridgeStatus {
    const serverMetrics = webSocketServer.getServerMetrics();

    return {
      initialized: this.isInitialized,
      running: this._isRunning,
      connectedClients: serverMetrics.totalConnections,
      dataStreaming: this.dataStreamer.getIsStreaming(),
    };
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
    (agentRegistry as any).on?.("agent:status_changed", (data: any) => {
      this.broadcastAgentUpdate(data.agentId, data.agentType, data.status);
    });

    (agentRegistry as any).on?.("agent:error", (data: any) => {
      this.broadcastAgentError(data.agentId, data.error);
    });

    // Listen for workflow events
    (workflowEngine as any).on?.("workflow:started", (data: any) => {
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

    (workflowEngine as any).on?.("workflow:progress", (data: any) => {
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

    (workflowEngine as any).on?.("workflow:completed", (data: any) => {
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

    (workflowEngine as any).on?.("workflow:failed", (data: any) => {
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
    (performanceCollector as any).on?.("metrics:updated", (data: any) => {
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

  private async handleWorkflowExecutionRequest(data: WorkflowExecutionRequest): Promise<void> {
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
}