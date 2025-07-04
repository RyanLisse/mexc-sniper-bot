/**
 * WebSocket Server Service (Final Refactored Version)
 *
 * Minimal orchestrator using fully extracted modular components.
 * Reduced from 1206 lines to under 500 lines through complete modularization.
 *
 * Architecture:
 * - ServerConnectionManager: Connection lifecycle and subscriptions
 * - WebSocketRateLimiter: Rate limiting and abuse prevention
 * - WebSocketMessageRouter: Message routing and handler management
 * - WebSocketConnectionHandler: Connection establishment and message processing
 * - AgentBroadcastManager: Specialized broadcasting for agent integration
 */

import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  BrowserCompatibleEventEmitter,
  UniversalCrypto as crypto,
} from "@/src/lib/browser-compatible-events";
// Types
import type {
  AgentStatusMessage,
  MessageHandler,
  NotificationMessage,
  PatternDiscoveryMessage,
  ServerMetrics,
  TradingPriceMessage,
  WebSocketChannel,
  WebSocketMessage,
  WebSocketServerConfig,
} from "@/src/lib/websocket-types";
import { AgentBroadcastManager } from "./websocket/agent-broadcast-manager";
import { WebSocketConnectionHandler } from "./websocket/connection-handler";
import { WebSocketMessageRouter } from "./websocket/message-router";
import { WebSocketRateLimiter } from "./websocket/rate-limiter";
// Import all extracted components
import { ServerConnectionManager } from "./websocket/server-connection-manager";

export class WebSocketServerService extends BrowserCompatibleEventEmitter {
  private static instance: WebSocketServerService;
  private wss: WebSocketServer | null = null;

  // Component managers (all extracted)
  private connectionManager: ServerConnectionManager;
  private rateLimiter: WebSocketRateLimiter;
  private messageRouter: WebSocketMessageRouter;
  private connectionHandler: WebSocketConnectionHandler;
  private agentBroadcastManager: AgentBroadcastManager;

  private config: WebSocketServerConfig;
  private isRunning = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private serverMetrics: ServerMetrics = {
    totalConnections: 0,
    authenticatedConnections: 0,
    totalChannels: 0,
    totalSubscriptions: 0,
    messagesPerSecond: 0,
    averageLatency: 0,
    errorRate: 0,
    uptime: 0,
  };

  constructor(config: Partial<WebSocketServerConfig> = {}) {
    super();

    this.config = {
      port: 8080,
      host: "localhost",
      path: "/ws",
      authentication: {
        required: true,
        tokenValidation: this.defaultTokenValidation.bind(this),
      },
      rateLimiting: {
        enabled: true,
        maxConnections: 10,
        maxMessagesPerMinute: 100,
        blockDuration: 60000,
      },
      performance: {
        heartbeatInterval: 30000,
        pingTimeout: 10000,
        maxPayloadSize: 1024 * 1024, // 1MB
        compressionEnabled: true,
      },
      monitoring: {
        metricsEnabled: true,
        loggingLevel: "info",
        healthCheckInterval: 10000,
      },
      ...config,
    };

    this.initializeComponents();
  }

  private initializeComponents(): void {
    // Initialize core components
    this.connectionManager = new ServerConnectionManager();
    this.rateLimiter = new WebSocketRateLimiter({
      maxConnectionsPerIP: this.config.rateLimiting.maxConnections,
      maxMessagesPerMinute: this.config.rateLimiting.maxMessagesPerMinute,
    });
    this.messageRouter = new WebSocketMessageRouter();

    // Initialize connection handler with dependencies
    this.connectionHandler = new WebSocketConnectionHandler({
      connectionManager: this.connectionManager,
      rateLimiter: this.rateLimiter,
      messageRouter: this.messageRouter,
      config: this.config,
      sendMessage: this.sendMessage.bind(this),
      sendError: this.sendError.bind(this),
      emit: this.emit.bind(this),
    });

    // Initialize agent broadcast manager
    this.agentBroadcastManager = new AgentBroadcastManager({
      broadcast: this.broadcast.bind(this),
      broadcastToUser: this.broadcastToUser.bind(this),
    });

    this.setupMessageHandlers();
  }

  static getInstance(
    config?: Partial<WebSocketServerConfig>
  ): WebSocketServerService {
    if (!WebSocketServerService.instance) {
      WebSocketServerService.instance = new WebSocketServerService(config);
    }
    return WebSocketServerService.instance;
  }

  // ============================================================================
  // Server Lifecycle (Minimal Implementation)
  // ============================================================================

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[WebSocket] Server is already running");
      return;
    }

    try {
      this.wss = new WebSocketServer({
        port: this.config.port,
        host: this.config.host,
        path: this.config.path,
        maxPayload: this.config.performance.maxPayloadSize,
      });

      this.wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
        this.connectionHandler.handleConnection(ws, request);
      });

      this.wss.on("error", (error) => {
        console.error("[WebSocket] Server error:", error);
        this.emit("error", error);
      });

      this.startHeartbeat();
      this.startMetricsCollection();

      this.isRunning = true;
      console.info(
        `[WebSocket] Server started on ${this.config.host}:${this.config.port}${this.config.path}`
      );
      this.emit("server:started");
    } catch (error) {
      console.error("[WebSocket] Failed to start server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.info("[WebSocket] Stopping server...");

    // Stop intervals
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Close all connections gracefully
    const connections = this.connectionManager.getAllConnections();
    for (const connection of connections) {
      connection.ws.close(1001, "Server shutting down");
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.isRunning = false;
    console.info("[WebSocket] Server stopped");
    this.emit("server:stopped");
  }

  // ============================================================================
  // Message Broadcasting (Delegated to Components)
  // ============================================================================

  broadcast<T>(
    message: Omit<WebSocketMessage<T>, "messageId" | "timestamp">
  ): void {
    const fullMessage: WebSocketMessage<T> = {
      ...message,
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.broadcastToChannel(message.channel as WebSocketChannel, fullMessage);
  }

  broadcastToChannel<T>(
    channel: WebSocketChannel,
    message: WebSocketMessage<T>
  ): void {
    const subscribers = this.connectionManager.getChannelSubscribers(channel);
    for (const connection of subscribers) {
      this.sendMessage(connection.id, message);
    }
    console.info(
      `[WebSocket] Broadcasted to ${channel}: ${subscribers.length} subscribers`
    );
  }

  broadcastToUser<T>(userId: string, message: WebSocketMessage<T>): void {
    const connections = this.connectionManager.getUserConnections(userId);
    for (const connection of connections) {
      this.sendMessage(connection.id, message);
    }
    console.info(
      `[WebSocket] Broadcasted to user ${userId}: ${connections.length} connections`
    );
  }

  sendMessage<T>(connectionId: string, message: WebSocketMessage<T>): boolean {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const serialized = JSON.stringify(message);
      connection.ws.send(serialized);
      this.connectionManager.updateActivity(connectionId);
      this.connectionManager.incrementMessageCount(connectionId, "sent");
      return true;
    } catch (error) {
      console.error(
        `[WebSocket] Failed to send message to ${connectionId}:`,
        error
      );
      return false;
    }
  }

  // ============================================================================
  // Agent Integration (Fully Delegated)
  // ============================================================================

  broadcastAgentStatus(agentStatus: AgentStatusMessage): void {
    this.agentBroadcastManager.broadcastAgentStatus(agentStatus);
  }

  broadcastTradingPrice(priceData: TradingPriceMessage): void {
    this.agentBroadcastManager.broadcastTradingPrice(priceData);
  }

  broadcastPatternDiscovery(pattern: PatternDiscoveryMessage): void {
    this.agentBroadcastManager.broadcastPatternDiscovery(pattern);
  }

  broadcastNotification(notification: NotificationMessage): void {
    this.agentBroadcastManager.broadcastNotification(notification);
  }

  // ============================================================================
  // Utility Methods (Minimal Implementation)
  // ============================================================================

  private sendError(connectionId: string, code: string, message: string): void {
    this.sendMessage(connectionId, {
      type: "system:error",
      channel: "system",
      data: {
        code,
        message,
        timestamp: Date.now(),
        recoverable: code !== "AUTH_FAILED",
      },
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
      error: message,
    });
  }

  private async defaultTokenValidation(
    token: string
  ): Promise<{ valid: boolean; userId?: string }> {
    try {
      if (!token) return { valid: false };
      // In a real implementation, this would validate the JWT token
      return { valid: true, userId: "test-user" };
    } catch (error) {
      console.error("[WebSocket] Token validation error:", error);
      return { valid: false };
    }
  }

  private setupMessageHandlers(): void {
    // Add global message logging handler
    this.messageRouter.addGlobalHandler(async (message) => {
      if (this.config.monitoring.loggingLevel === "debug") {
        console.info(`[WebSocket] Message routed:`, {
          type: message.type,
          channel: message.channel,
          timestamp: message.timestamp,
        });
      }
    });

    // Add heartbeat handler
    this.messageRouter.addHandler("system", async (message) => {
      if (message.type === "system:heartbeat") {
        // Heartbeat response is handled automatically
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const connections = this.connectionManager.getAllConnections();
      const now = Date.now();
      const timeout = this.config.performance.pingTimeout;

      for (const connection of connections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
          if (now - connection.lastActivity > timeout * 2) {
            console.info(
              `[WebSocket] Closing stale connection: ${connection.id}`
            );
            connection.ws.close(1001, "Connection timeout");
          }
        }
      }
    }, this.config.performance.heartbeatInterval);
  }

  private startMetricsCollection(): void {
    if (!this.config.monitoring.metricsEnabled) return;

    this.metricsInterval = setInterval(() => {
      const connectionMetrics = this.connectionManager.getMetrics();
      this.serverMetrics = {
        ...connectionMetrics,
        messagesPerSecond: 0, // Would need to track this properly
        averageLatency: 0, // Would need to measure latency
        errorRate: 0, // Would need to track errors
        uptime: this.isRunning
          ? Date.now() - (this.serverMetrics.uptime || Date.now())
          : 0,
      };
      this.emit("system:performance", { metrics: this.serverMetrics });
    }, this.config.monitoring.healthCheckInterval);
  }

  // ============================================================================
  // Public API (Minimal Delegation)
  // ============================================================================

  getServerMetrics(): ServerMetrics {
    return { ...this.serverMetrics };
  }

  getConnectionMetrics() {
    return this.connectionManager.getMetrics().connectionMetrics;
  }

  isHealthy(): boolean {
    return this.isRunning && !!this.wss;
  }

  addMessageHandler(channel: string, handler: MessageHandler): void {
    this.messageRouter.addHandler(channel, handler);
  }

  addGlobalMessageHandler(handler: MessageHandler): void {
    this.messageRouter.addGlobalHandler(handler);
  }
}

// Export singleton instance
export const webSocketServer = WebSocketServerService.getInstance();
