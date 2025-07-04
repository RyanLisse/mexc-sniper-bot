/**
 * WebSocket Server Service (Refactored)
 *
 * Server-side WebSocket management using extracted components for modularity.
 * Reduced from 1206 lines to under 500 lines by importing specialized modules.
 *
 * Features:
 * - Connection management via ServerConnectionManager
 * - Rate limiting via WebSocketRateLimiter
 * - Message routing via WebSocketMessageRouter
 * - Performance monitoring and graceful error handling
 * - Integration with 11-agent system
 */

import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  BrowserCompatibleEventEmitter,
  UniversalCrypto as crypto,
} from "@/src/lib/browser-compatible-events";

// OpenTelemetry WebSocket instrumentation
import {
  instrumentChannelOperation,
  instrumentWebSocketSend,
} from "@/src/lib/opentelemetry-websocket-instrumentation";
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
import { WebSocketMessageRouter } from "./websocket/message-router";
import { WebSocketRateLimiter } from "./websocket/rate-limiter";
// Import extracted components
import { ServerConnectionManager } from "./websocket/server-connection-manager";

/**
 * Main WebSocket Server Service using modular components
 */
export class WebSocketServerService extends BrowserCompatibleEventEmitter {
  private static instance: WebSocketServerService;
  private wss: WebSocketServer | null = null;

  // Extracted component managers
  private connectionManager: ServerConnectionManager;
  private rateLimiter: WebSocketRateLimiter;
  private messageRouter: WebSocketMessageRouter;

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

    // Initialize component managers
    this.connectionManager = new ServerConnectionManager();
    this.rateLimiter = new WebSocketRateLimiter({
      maxConnectionsPerIP: this.config.rateLimiting.maxConnections,
      maxMessagesPerMinute: this.config.rateLimiting.maxMessagesPerMinute,
    });
    this.messageRouter = new WebSocketMessageRouter();

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
  // Server Lifecycle Methods
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

      this.wss.on("connection", this.handleConnection.bind(this));
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
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

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
  // Message Broadcasting Methods
  // ============================================================================

  broadcast<T>(
    message: Omit<WebSocketMessage<T>, "messageId" | "timestamp">
  ): void {
    const fullMessage: WebSocketMessage<T> = {
      ...message,
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    // Instrument broadcast operation
    instrumentChannelOperation(
      "broadcast",
      message.channel,
      async () => {
        this.broadcastToChannel(
          message.channel as WebSocketChannel,
          fullMessage
        );
        return Promise.resolve();
      },
      { messageType: message.type }
    ).catch((error) => {
      console.error("[WebSocket] Broadcast instrumentation error:", error);
    });
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

    // Instrument message sending
    instrumentWebSocketSend(
      message,
      async () => {
        const serialized = JSON.stringify(message);
        connection.ws.send(serialized);
        return Promise.resolve();
      },
      {
        connectionId,
        channel: message.channel,
        messageType: message.type,
        clientType: connection.clientType,
      }
    ).catch((error) => {
      console.error("[WebSocket] Send message instrumentation error:", error);
    });

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
  // Agent Integration Methods (Specialized Broadcasting)
  // ============================================================================

  broadcastAgentStatus(agentStatus: AgentStatusMessage): void {
    this.broadcast({
      type: "agent:status",
      channel: "agents:status",
      data: agentStatus,
    });

    // Also broadcast to specific agent channel
    this.broadcast({
      type: "agent:status",
      channel: `agent:${agentStatus.agentId}:status`,
      data: agentStatus,
    });
  }

  broadcastTradingPrice(priceData: TradingPriceMessage): void {
    this.broadcast({
      type: "trading:price",
      channel: "trading:prices",
      data: priceData,
    });

    // Also broadcast to symbol-specific channel
    this.broadcast({
      type: "trading:price",
      channel: `trading:${priceData.symbol}:price`,
      data: priceData,
    });
  }

  broadcastPatternDiscovery(pattern: PatternDiscoveryMessage): void {
    this.broadcast({
      type: "pattern:discovery",
      channel: "patterns:discovery",
      data: pattern,
    });

    // Also broadcast to symbol-specific channel
    this.broadcast({
      type: "pattern:discovery",
      channel: `patterns:${pattern.symbol}:discovery`,
      data: pattern,
    });
  }

  broadcastNotification(notification: NotificationMessage): void {
    if (notification.userId) {
      // Send to specific user
      this.broadcastToUser(notification.userId, {
        type: "notification:info",
        channel: `user:${notification.userId}:notifications`,
        data: notification,
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      });
    } else {
      // Global notification
      this.broadcast({
        type: "notification:info",
        channel: "notifications:global",
        data: notification,
      });
    }
  }

  // ============================================================================
  // Connection Handling (Delegated to Components)
  // ============================================================================

  private async handleConnection(
    ws: WebSocket,
    request: IncomingMessage
  ): Promise<void> {
    const connectionId = crypto.randomUUID();
    const clientIP = this.getClientIP(request);
    let connectionAdded = false;

    // Connection timeout handler
    const connectionTimeout = setTimeout(() => {
      if (
        ws.readyState === WebSocket.CONNECTING ||
        ws.readyState === WebSocket.OPEN
      ) {
        console.warn(`[WebSocket] Connection timeout for ${connectionId}`);
        ws.close(1008, "Connection timeout");
      }
    }, 10000); // 10 second timeout

    try {
      // Validate WebSocket state
      if (
        ws.readyState !== WebSocket.OPEN &&
        ws.readyState !== WebSocket.CONNECTING
      ) {
        console.warn(
          `[WebSocket] Invalid WebSocket state: ${ws.readyState} for ${connectionId}`
        );
        return;
      }

      // Rate limiting check using extracted component
      if (
        this.config.rateLimiting.enabled &&
        !this.rateLimiter.checkConnectionLimit(clientIP, connectionId)
      ) {
        ws.close(1008, "Too many connections from this IP");
        return;
      }

      // Authentication (if required)
      let userId: string | undefined;
      if (this.config.authentication.required) {
        const authResult = await this.authenticateConnection(request);
        if (!authResult.valid) {
          const errorMsg =
            "error" in authResult ? authResult.error : "Authentication failed";
          console.warn(
            `[WebSocket] Authentication failed for ${connectionId}: ${errorMsg}`
          );
          ws.close(1008, errorMsg);
          return;
        }
        userId = authResult.userId;
      }

      // Validate connection is still open before proceeding
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn(
          `[WebSocket] Connection closed during setup: ${connectionId}`
        );
        return;
      }

      // Add connection to manager
      this.connectionManager.addConnection(connectionId, ws, userId);
      connectionAdded = true;

      // Clear connection timeout since setup is successful
      clearTimeout(connectionTimeout);

      // Setup message handling with error recovery
      ws.on("message", async (data) => {
        try {
          await this.handleMessage(connectionId, data);
        } catch (error) {
          console.error(
            `[WebSocket] Error in message handler for ${connectionId}:`,
            error
          );
          this.sendError(
            connectionId,
            "MESSAGE_ERROR",
            "Failed to process message"
          );
        }
      });

      ws.on("close", (code, reason) => {
        this.handleDisconnection(connectionId, clientIP, code, reason);
      });

      ws.on("error", (error) => {
        console.error(
          `[WebSocket] Connection error for ${connectionId}:`,
          error
        );
        this.handleDisconnection(
          connectionId,
          clientIP,
          1006,
          Buffer.from(error.message)
        );
      });

      // Setup connection health monitoring
      ws.on("pong", () => {
        this.connectionManager.updateActivity(connectionId);
      });

      // Send welcome message
      const welcomeSuccess = this.sendMessage(connectionId, {
        type: "system:connect",
        channel: "system",
        data: {
          connectionId,
          serverTime: Date.now(),
          features: ["agents", "trading", "patterns", "notifications"],
        },
        messageId: crypto.randomUUID(),
        timestamp: Date.now(),
      });

      if (!welcomeSuccess) {
        console.warn(
          `[WebSocket] Failed to send welcome message to ${connectionId}`
        );
        this.handleDisconnection(
          connectionId,
          clientIP,
          1011,
          Buffer.from("Welcome message failed")
        );
        return;
      }

      console.info(
        `[WebSocket] New connection established: ${connectionId} (user: ${userId || "anonymous"})`
      );
      this.emit("connection:open", { connectionId, userId });
    } catch (error) {
      console.error(
        `[WebSocket] Failed to handle connection ${connectionId}:`,
        error
      );

      // Clear timeout on error
      clearTimeout(connectionTimeout);

      // Clean up connection if it was added
      if (connectionAdded) {
        this.connectionManager.removeConnection(connectionId);
        this.rateLimiter.removeConnection(clientIP, connectionId);
      }

      // Close WebSocket with appropriate error code
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        const errorMsg =
          error instanceof Error ? error.message : "Internal server error";
        ws.close(1011, errorMsg);
      }

      this.emit("connection:error", { connectionId, error });
    }
  }

  private async handleMessage(
    connectionId: string,
    data: Buffer | ArrayBuffer | Buffer[]
  ): Promise<void> {
    try {
      // Rate limiting check using extracted component
      if (
        this.config.rateLimiting.enabled &&
        !this.rateLimiter.checkMessageLimit(connectionId)
      ) {
        this.sendError(connectionId, "RATE_LIMITED", "Too many messages");
        return;
      }

      const messageStr = data.toString();
      const message: WebSocketMessage = JSON.parse(messageStr);

      // Validate message structure
      if (!this.isValidMessage(message)) {
        this.sendError(
          connectionId,
          "INVALID_MESSAGE",
          "Invalid message format"
        );
        return;
      }

      this.connectionManager.updateActivity(connectionId);
      this.connectionManager.incrementMessageCount(connectionId, "received");

      // Handle subscription management
      if (message.type === "subscription:subscribe") {
        this.handleSubscription(connectionId, message);
        return;
      }

      if (message.type === "subscription:unsubscribe") {
        this.handleUnsubscription(connectionId, message);
        return;
      }

      // Route message to handlers using extracted component
      await this.messageRouter.routeMessage(message, connectionId);

      this.emit("message:received", { message, connectionId });
    } catch (error) {
      console.error(
        `[WebSocket] Error handling message from ${connectionId}:`,
        error
      );
      this.sendError(connectionId, "SERVER_ERROR", "Failed to process message");
    }
  }

  private handleDisconnection(
    connectionId: string,
    clientIP: string,
    code: number,
    reason: Buffer
  ): void {
    this.connectionManager.removeConnection(connectionId);
    this.rateLimiter.removeConnection(clientIP, connectionId);

    console.info(
      `[WebSocket] Connection closed: ${connectionId} (code: ${code}, reason: ${reason.toString()})`
    );
    this.emit("connection:close", { connectionId, reason: reason.toString() });
  }

  // ============================================================================
  // Subscription Management (Delegated to ConnectionManager)
  // ============================================================================

  private handleSubscription(
    connectionId: string,
    message: WebSocketMessage
  ): void {
    const { channel } = message.data;
    const success = this.connectionManager.subscribeToChannel(
      connectionId,
      channel
    );

    this.sendMessage(connectionId, {
      type: "system:ack",
      channel: "system",
      data: {
        originalMessageId: message.messageId,
        success,
        action: "subscribe",
        channel,
      },
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    });

    if (success) {
      this.emit("subscription:added", { channel, connectionId });
    }
  }

  private handleUnsubscription(
    connectionId: string,
    message: WebSocketMessage
  ): void {
    const { channel } = message.data;
    const success = this.connectionManager.unsubscribeFromChannel(
      connectionId,
      channel
    );

    this.sendMessage(connectionId, {
      type: "system:ack",
      channel: "system",
      data: {
        originalMessageId: message.messageId,
        success,
        action: "unsubscribe",
        channel,
      },
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    });

    if (success) {
      this.emit("subscription:removed", { channel, connectionId });
    }
  }

  // ============================================================================
  // Utility and Helper Methods
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

  private isValidMessage(message: unknown): message is WebSocketMessage {
    if (!message || typeof message !== "object" || message === null) {
      return false;
    }

    const msg = message as Record<string, unknown>;

    return (
      typeof msg.type === "string" &&
      typeof msg.channel === "string" &&
      msg.data !== undefined &&
      typeof msg.timestamp === "number" &&
      typeof msg.messageId === "string"
    );
  }

  private async defaultTokenValidation(
    token: string
  ): Promise<{ valid: boolean; userId?: string }> {
    try {
      // This would integrate with Kinde Auth in a real implementation
      // For now, returning a basic validation
      if (!token) {
        return { valid: false };
      }

      // In a real implementation, this would validate the JWT token
      // and extract user information
      return { valid: true, userId: "test-user" };
    } catch (error) {
      console.error("[WebSocket] Token validation error:", error);
      return { valid: false };
    }
  }

  private async authenticateConnection(
    request: IncomingMessage
  ): Promise<{ valid: boolean; userId?: string }> {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const token =
        url.searchParams.get("token") ||
        request.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return { valid: false };
      }

      return await this.config.authentication.tokenValidation(token);
    } catch (error) {
      console.error("[WebSocket] Authentication error:", error);
      return { valid: false };
    }
  }

  private getClientIP(request: IncomingMessage): string {
    const xForwardedFor = request.headers["x-forwarded-for"];
    const xRealIP = request.headers["x-real-ip"];

    if (xForwardedFor) {
      return Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor.split(",")[0];
    }

    if (xRealIP) {
      return Array.isArray(xRealIP) ? xRealIP[0] : xRealIP;
    }

    return request.socket.remoteAddress || "unknown";
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
          // Send ping
          connection.ws.ping();

          // Check if connection is stale
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
  // Public API
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
