/**
 * WebSocket Server Service - Refactored
 *
 * Main WebSocket server service using modular components for better maintainability.
 * Uses extracted ConnectionManager, RateLimiter, and MessageRouter modules.
 *
 * Features:
 * - Modular architecture with clear separation of concerns
 * - Connection management with authentication
 * - Rate limiting and security
 * - Message routing and handling
 * - Performance monitoring and metrics
 * - Graceful error handling and recovery
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

import type {
  AgentStatusMessage,
  NotificationMessage,
  PatternDiscoveryMessage,
  ServerMetrics,
  TradingPriceMessage,
  WebSocketChannel,
  WebSocketMessage,
  WebSocketServerConfig,
} from "@/src/lib/websocket-types";
import { WebSocketMessageRouter } from "./message-router";
import { WebSocketRateLimiter } from "./rate-limiter";
// Extracted modules
import { ServerConnectionManager } from "./server-connection-manager";

export interface WebSocketServerStats extends ServerMetrics {
  connectionManagerStats: any;
  rateLimiterStats: any;
  messageRouterStats: any;
}

export class WebSocketServerService extends BrowserCompatibleEventEmitter {
  private static instance: WebSocketServerService;
  private wss: WebSocketServer | null = null;

  // Modular components
  private connectionManager = new ServerConnectionManager();
  private rateLimiter: WebSocketRateLimiter;
  private messageRouter = new WebSocketMessageRouter();

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

  private startTime = Date.now();

  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[websocket-server-service]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[websocket-server-service]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[websocket-server-service]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[websocket-server-service]", message, context || ""),
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

    // Initialize rate limiter with configuration
    this.rateLimiter = new WebSocketRateLimiter({
      maxConnectionsPerIP: this.config.rateLimiting.maxConnections,
      maxMessagesPerMinute: this.config.rateLimiting.maxMessagesPerMinute,
      windowMs: this.config.rateLimiting.blockDuration,
    });

    this.setupMessageHandlers();

    this.logger.info("WebSocket server service initialized", {
      config: {
        port: this.config.port,
        host: this.config.host,
        path: this.config.path,
        authRequired: this.config.authentication.required,
        rateLimitingEnabled: this.config.rateLimiting.enabled,
      },
    });

    // Register cleanup handler with memory manager
    import("@/src/lib/memory-leak-cleanup-manager")
      .then(({ memoryLeakCleanupManager }) => {
        memoryLeakCleanupManager.registerEventEmitter(
          this,
          "WebSocketServerService"
        );
        memoryLeakCleanupManager.registerCleanupHandler(
          "WebSocketServerService",
          async () => {
            await this.stop();
          }
        );
      })
      .catch(() => {
        // Fallback if memory manager is not available
        this.logger.warn(
          "Memory leak cleanup manager not available for WebSocketServerService"
        );
      });
  }

  static getInstance(
    config?: Partial<WebSocketServerConfig>
  ): WebSocketServerService {
    if (!WebSocketServerService.instance) {
      WebSocketServerService.instance = new WebSocketServerService(config);
    }
    return WebSocketServerService.instance;
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("Server is already running");
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
        this.logger.error("WebSocket server error", {}, error);
        this.emit("error", error);
      });

      this.startHeartbeat();
      this.startMetricsCollection();

      this.isRunning = true;
      this.startTime = Date.now();

      this.logger.info("WebSocket server started", {
        address: `${this.config.host}:${this.config.port}${this.config.path}`,
        maxPayload: this.config.performance.maxPayloadSize,
        heartbeatInterval: this.config.performance.heartbeatInterval,
      });

      this.emit("server:started");
    } catch (error) {
      this.logger.error("Failed to start WebSocket server", {}, error as Error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn("Server is not running");
      return;
    }

    try {
      // Stop intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }

      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
        this.metricsInterval = undefined;
      }

      // Close all connections
      const connections = this.connectionManager.getAllConnections();
      for (const connection of connections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close(1000, "Server shutdown");
        }
      }

      // Close server
      if (this.wss) {
        await new Promise<void>((resolve, reject) => {
          this.wss?.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        this.wss = null;
      }

      this.isRunning = false;

      // Clean up EventEmitter listeners to prevent memory leaks
      this.removeAllListeners();

      this.logger.info("WebSocket server stopped", {
        uptime: Date.now() - this.startTime,
        totalConnectionsServed: this.serverMetrics.totalConnections,
      });

      // Note: We emit this BEFORE removing all listeners
      this.emit("server:stopped");
    } catch (error) {
      this.logger.error("Error stopping WebSocket server", {}, error as Error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(
    ws: WebSocket,
    request: IncomingMessage
  ): Promise<void> {
    const connectionId = crypto.randomUUID();
    const clientIP = this.getClientIP(request);

    try {
      // Check rate limiting
      if (this.config.rateLimiting.enabled) {
        if (!this.rateLimiter.checkConnectionLimit(clientIP, connectionId)) {
          this.logger.warn("Connection rejected due to rate limiting", {
            connectionId,
            clientIP,
          });
          ws.close(1008, "Rate limit exceeded");
          return;
        }
      }

      // Handle authentication
      let userId: string | undefined;
      if (this.config.authentication.required) {
        const authResult = await this.authenticateConnection(request);
        if (!authResult.success) {
          this.logger.warn(
            "Connection rejected due to authentication failure",
            {
              connectionId,
              clientIP,
              reason: authResult.reason,
            }
          );
          ws.close(1008, "Authentication failed");
          return;
        }
        userId = authResult.userId;
      }

      // Add connection to manager
      this.connectionManager.addConnection(connectionId, ws, userId);

      // Setup connection event handlers
      this.setupConnectionHandlers(ws, connectionId, clientIP);

      this.logger.info("New WebSocket connection established", {
        connectionId,
        clientIP,
        userId: userId || "anonymous",
        totalConnections: this.connectionManager.getAllConnections().length,
      });

      this.emit("connection:established", { connectionId, userId, clientIP });
    } catch (error) {
      this.logger.error(
        "Error handling new connection",
        {
          connectionId,
          clientIP,
        },
        error as Error
      );

      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1011, "Internal server error");
      }
    }
  }

  /**
   * Setup event handlers for a WebSocket connection
   */
  private setupConnectionHandlers(
    ws: WebSocket,
    connectionId: string,
    clientIP: string
  ): void {
    // Handle incoming messages
    ws.on("message", async (data: Buffer) => {
      try {
        await this.handleMessage(connectionId, data);
      } catch (error) {
        this.logger.error(
          "Error handling message",
          {
            connectionId,
            clientIP,
          },
          error as Error
        );

        this.sendError(connectionId, "Message processing error");
      }
    });

    // Handle connection close
    ws.on("close", (code: number, reason: Buffer) => {
      this.logger.info("WebSocket connection closed", {
        connectionId,
        clientIP,
        code,
        reason: reason.toString(),
      });

      this.connectionManager.removeConnection(connectionId);
      this.rateLimiter.removeConnection(clientIP, connectionId);
      this.emit("connection:closed", {
        connectionId,
        code,
        reason: reason.toString(),
      });
    });

    // Handle connection errors
    ws.on("error", (error: Error) => {
      this.logger.error(
        "WebSocket connection error",
        {
          connectionId,
          clientIP,
        },
        error
      );

      this.emit("connection:error", { connectionId, error });
    });

    // Handle pong responses
    ws.on("pong", () => {
      this.connectionManager.updateActivity(connectionId);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(
    connectionId: string,
    data: Buffer
  ): Promise<void> {
    // Check rate limiting
    if (this.config.rateLimiting.enabled) {
      if (!this.rateLimiter.checkMessageLimit(connectionId)) {
        this.sendError(connectionId, "Rate limit exceeded");
        return;
      }
    }

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      // Validate message structure
      if (!this.isValidMessage(message)) {
        this.sendError(connectionId, "Invalid message format");
        return;
      }

      // Update connection activity
      this.connectionManager.updateActivity(connectionId);
      this.connectionManager.incrementMessageCount(connectionId, "received");

      // Route message to appropriate handlers
      await this.messageRouter.routeMessage(message, connectionId);

      this.logger.debug("Message processed successfully", {
        connectionId,
        channel: message.channel,
        type: message.type,
        messageId: message.id,
      });
    } catch (error) {
      this.logger.error(
        "Error processing message",
        {
          connectionId,
          dataLength: data.length,
        },
        error as Error
      );

      this.sendError(connectionId, "Invalid message format");
    }
  }

  /**
   * Broadcast message to a specific channel
   */
  async broadcast<T extends WebSocketMessage>(
    channel: WebSocketChannel,
    message: T
  ): Promise<void> {
    const subscribers = this.connectionManager.getChannelSubscribers(channel);

    if (subscribers.length === 0) {
      this.logger.debug(`No subscribers for channel: ${channel}`);
      return;
    }

    const messageData = JSON.stringify(message);
    let successCount = 0;
    let errorCount = 0;

    for (const connection of subscribers) {
      try {
        if (connection.ws.readyState === WebSocket.OPEN) {
          await instrumentWebSocketSend(
            message,
            async () => {
              connection.ws.send(messageData);
            },
            {
              channel: channel,
              messageType: message.type,
              connectionId: connection.id,
            }
          );

          this.connectionManager.incrementMessageCount(connection.id, "sent");
          successCount++;
        }
      } catch (error) {
        this.logger.error(
          "Error broadcasting to connection",
          {
            connectionId: connection.id,
            channel,
            messageType: message.type,
          },
          error as Error
        );
        errorCount++;
      }
    }

    this.logger.debug("Message broadcast completed", {
      channel,
      messageType: message.type,
      totalSubscribers: subscribers.length,
      successCount,
      errorCount,
    });
  }

  /**
   * Send message to a specific user
   */
  sendToUser<T extends WebSocketMessage>(userId: string, message: T): void {
    const userConnections = this.connectionManager.getUserConnections(userId);

    if (userConnections.length === 0) {
      this.logger.debug(`No connections found for user: ${userId}`);
      return;
    }

    const messageData = JSON.stringify(message);
    let successCount = 0;

    for (const connection of userConnections) {
      try {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(messageData);
          this.connectionManager.incrementMessageCount(connection.id, "sent");
          successCount++;
        }
      } catch (error) {
        this.logger.error(
          "Error sending to user connection",
          {
            userId,
            connectionId: connection.id,
            messageType: message.type,
          },
          error as Error
        );
      }
    }

    this.logger.debug("Message sent to user", {
      userId,
      messageType: message.type,
      totalConnections: userConnections.length,
      successCount,
    });
  }

  /**
   * Send error message to a connection
   */
  private sendError(connectionId: string, errorMessage: string): void {
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const errorMsg: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: "error",
      channel: "system",
      data: { message: errorMessage },
      timestamp: Date.now(),
    };

    try {
      connection.ws.send(JSON.stringify(errorMsg));
      this.connectionManager.incrementMessageCount(connectionId, "sent");
    } catch (error) {
      this.logger.error(
        "Error sending error message",
        {
          connectionId,
          errorMessage,
        },
        error as Error
      );
    }
  }

  /**
   * Setup default message handlers
   */
  private setupMessageHandlers(): void {
    // Handle subscription requests
    this.messageRouter.addHandler(
      "system",
      async (message: WebSocketMessage) => {
        if (message.type === "subscribe") {
          await this.handleSubscription(message);
        } else if (message.type === "unsubscribe") {
          await this.handleUnsubscription(message);
        }
      }
    );

    // Handle ping messages
    this.messageRouter.addGlobalHandler(async (message: WebSocketMessage) => {
      if (message.type === "ping") {
        // Pong will be sent automatically by WebSocket
        this.logger.debug("Ping received", { messageId: message.id });
      }
    });
  }

  /**
   * Handle subscription request
   */
  private async handleSubscription(message: WebSocketMessage): Promise<void> {
    const connectionId = message.data?.connectionId;
    const channel = message.data?.channel;

    if (!connectionId || !channel) {
      this.logger.warn("Invalid subscription request", { message });
      return;
    }

    await instrumentChannelOperation("subscribe", channel, async () => {
      const success = this.connectionManager.subscribeToChannel(
        connectionId,
        channel
      );

      if (success) {
        this.logger.info("Channel subscription successful", {
          connectionId,
          channel,
        });
      }
      return success;
    });
  }

  /**
   * Handle unsubscription request
   */
  private async handleUnsubscription(message: WebSocketMessage): Promise<void> {
    const connectionId = message.data?.connectionId;
    const channel = message.data?.channel;

    if (!connectionId || !channel) {
      this.logger.warn("Invalid unsubscription request", { message });
      return;
    }

    await instrumentChannelOperation("unsubscribe", channel, async () => {
      const success = this.connectionManager.unsubscribeFromChannel(
        connectionId,
        channel
      );

      if (success) {
        this.logger.info("Channel unsubscription successful", {
          connectionId,
          channel,
        });
      }
      return success;
    });
  }

  /**
   * Default token validation (can be overridden)
   */
  private async defaultTokenValidation(
    token: string
  ): Promise<{ valid: boolean; userId?: string }> {
    // Implementation depends on your authentication system
    // This is a placeholder that should be replaced with actual validation
    if (token && token.length > 0) {
      return { valid: true, userId: `user_${token.substring(0, 8)}` };
    }
    return { valid: false };
  }

  /**
   * Authenticate WebSocket connection
   */
  private async authenticateConnection(request: IncomingMessage): Promise<{
    success: boolean;
    userId?: string;
    reason?: string;
  }> {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const token =
        url.searchParams.get("token") ||
        request.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return { success: false, reason: "No token provided" };
      }

      const authResult =
        await this.config.authentication.tokenValidation(token);

      if (!authResult.valid) {
        return { success: false, reason: "Invalid token" };
      }

      return { success: true, userId: authResult.userId };
    } catch (error) {
      this.logger.error("Authentication error", {}, error as Error);
      return { success: false, reason: "Authentication error" };
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(request: IncomingMessage): string {
    return (
      (request.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      (request.headers["x-real-ip"] as string) ||
      request.socket.remoteAddress ||
      "unknown"
    );
  }

  /**
   * Validate message structure
   */
  private isValidMessage(message: any): message is WebSocketMessage {
    return (
      message &&
      typeof message.id === "string" &&
      typeof message.type === "string" &&
      typeof message.channel === "string" &&
      typeof message.timestamp === "number" &&
      message.data !== undefined
    );
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const connections = this.connectionManager.getAllConnections();

      for (const connection of connections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          try {
            connection.ws.ping();
          } catch (error) {
            this.logger.error(
              "Error sending ping",
              {
                connectionId: connection.id,
              },
              error as Error
            );
          }
        }
      }
    }, this.config.performance.heartbeatInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    if (!this.config.monitoring.metricsEnabled) {
      return;
    }

    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, this.config.monitoring.healthCheckInterval);
  }

  /**
   * Update server metrics
   */
  private updateMetrics(): void {
    const connectionStats = this.connectionManager.getMetrics();
    const rateLimiterStats = this.rateLimiter.getStats();
    const messageRouterStats = this.messageRouter.getStats();

    this.serverMetrics = {
      totalConnections: connectionStats.totalConnections,
      authenticatedConnections: connectionStats.authenticatedConnections,
      totalChannels: connectionStats.totalChannels,
      totalSubscriptions: connectionStats.totalSubscriptions,
      messagesPerSecond: this.calculateMessagesPerSecond(messageRouterStats),
      averageLatency: this.calculateAverageLatency(connectionStats),
      errorRate:
        rateLimiterStats.totalTrackedConnections > 0
          ? (messageRouterStats.routingErrors /
              messageRouterStats.messagesRouted) *
            100
          : 0,
      uptime: Date.now() - this.startTime,
    };

    this.emit("metrics:updated", this.serverMetrics);
  }

  /**
   * Get server statistics
   */
  getStats(): WebSocketServerStats {
    return {
      ...this.serverMetrics,
      connectionManagerStats: this.connectionManager.getMetrics(),
      rateLimiterStats: this.rateLimiter.getStats(),
      messageRouterStats: this.messageRouter.getStats(),
    };
  }

  /**
   * Get server status
   */
  getStatus(): {
    isRunning: boolean;
    uptime: number;
    connections: number;
    config: WebSocketServerConfig;
  } {
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime,
      connections: this.connectionManager.getAllConnections().length,
      config: this.config,
    };
  }

  /**
   * Add message handler for a specific channel
   */
  addChannelHandler(
    channel: string,
    handler: (message: WebSocketMessage) => Promise<void>
  ): void {
    this.messageRouter.addHandler(channel, handler);
  }

  /**
   * Add global message handler
   */
  addGlobalHandler(
    handler: (message: WebSocketMessage) => Promise<void>
  ): void {
    this.messageRouter.addGlobalHandler(handler);
  }

  /**
   * Broadcast agent status update
   */
  async broadcastAgentStatus(agentStatus: AgentStatusMessage): Promise<void> {
    const message: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: "agent:status",
      channel: "agent_status",
      data: agentStatus,
      timestamp: Date.now(),
    };
    await this.broadcast("agent_status", message);
  }

  /**
   * Broadcast trading price update
   */
  async broadcastTradingPrice(priceUpdate: TradingPriceMessage): Promise<void> {
    const message: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: "trading:price",
      channel: "trading_prices",
      data: priceUpdate,
      timestamp: Date.now(),
    };
    await this.broadcast("trading_prices", message);
  }

  /**
   * Broadcast pattern discovery
   */
  async broadcastPatternDiscovery(
    patternData: PatternDiscoveryMessage
  ): Promise<void> {
    const message: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: "pattern:discovery",
      channel: "pattern_discovery",
      data: patternData,
      timestamp: Date.now(),
    };
    await this.broadcast("pattern_discovery", message);
  }

  /**
   * Send notification to user
   */
  sendNotification(userId: string, notification: NotificationMessage): void {
    const message: WebSocketMessage = {
      id: crypto.randomUUID(),
      type: "notification:info",
      channel: "notifications:global",
      data: notification,
      timestamp: Date.now(),
      userId,
    };
    this.sendToUser(userId, message);
  }

  /**
   * Calculate messages per second based on router stats
   */
  private calculateMessagesPerSecond(messageRouterStats: any): number {
    const currentTime = Date.now();
    const _timeWindowMs = 60000; // 1 minute window

    // Use total routed messages and time since start
    const totalMessages = messageRouterStats.messagesRouted || 0;
    const uptimeMs = currentTime - this.startTime;

    if (uptimeMs < 1000) {
      return 0; // Too early to calculate meaningful rate
    }

    // Calculate messages per second over the uptime
    const messagesPerMs = totalMessages / uptimeMs;
    return Number((messagesPerMs * 1000).toFixed(2));
  }

  /**
   * Calculate average latency from connection stats
   */
  private calculateAverageLatency(connectionStats: any): number {
    // Use connection manager ping stats if available
    if (connectionStats.averagePingTime !== undefined) {
      return Math.round(connectionStats.averagePingTime);
    }

    // Calculate estimated latency based on message handling time
    const connections = this.connectionManager.getAllConnections();
    if (connections.length === 0) {
      return 0;
    }

    let totalLatency = 0;
    let validConnections = 0;

    for (const connection of connections) {
      // Estimate latency based on last message time
      const lastActivity = connection.lastActivity || Date.now();
      const estimatedLatency = Math.min(Date.now() - lastActivity, 5000); // Cap at 5 seconds

      if (estimatedLatency >= 0) {
        totalLatency += estimatedLatency;
        validConnections++;
      }
    }

    return validConnections > 0
      ? Math.round(totalLatency / validConnections)
      : 0;
  }
}

// Export singleton instance
export const webSocketServerService = WebSocketServerService.getInstance();
