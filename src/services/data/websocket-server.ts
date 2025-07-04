/**
 * WebSocket Server Service
 *
 * Server-side WebSocket management for real-time communication in the AI trading system.
 * Supports agent status broadcasting, trading data streaming, and user notifications.
 *
 * Features:
 * - Connection management with authentication
 * - Channel-based message routing
 * - Rate limiting and security
 * - Performance monitoring
 * - Graceful error handling
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
import type {
  AgentStatusMessage,
  ConnectionMetrics,
  MessageHandler,
  NotificationMessage,
  PatternDiscoveryMessage,
  ServerMetrics,
  TradingPriceMessage,
  WebSocketChannel,
  WebSocketConnection,
  WebSocketMessage,
  WebSocketServerConfig,
} from "@/src/lib/websocket-types";
import { WebSocketMessageRouter } from "./websocket/message-router";
import { WebSocketRateLimiter } from "./websocket/rate-limiter";
import { ServerConnectionManager } from "./websocket/server-connection-manager";
import { WebSocketAuthenticationService } from "./websocket/websocket-authentication";
import { WebSocketBroadcastingService } from "./websocket/websocket-broadcasting";
import { WebSocketMessageHandlerService } from "./websocket/websocket-message-handler";
import { WebSocketUtilities } from "./websocket/websocket-utilities";

// ======================
// Main WebSocket Server
// ======================

export class WebSocketServerService extends BrowserCompatibleEventEmitter {
  private static instance: WebSocketServerService;
  private wss: WebSocketServer | null = null;
  private connectionManager = new ServerConnectionManager();
  private rateLimiter: WebSocketRateLimiter;
  private messageRouter = new WebSocketMessageRouter();
  private authService: WebSocketAuthenticationService;
  private broadcastingService: WebSocketBroadcastingService;
  private messageHandlerService: WebSocketMessageHandlerService;
  private config: WebSocketServerConfig;
  private isRunning = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private heartbeatManager: ReturnType<
    typeof WebSocketUtilities.createHeartbeatManager
  >;
  private metricsCollector: ReturnType<
    typeof WebSocketUtilities.createMetricsCollector
  >;
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
        tokenValidation: WebSocketAuthenticationService.defaultTokenValidation,
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

    this.rateLimiter = new WebSocketRateLimiter({
      maxConnectionsPerIP: this.config.rateLimiting.maxConnections,
      maxMessagesPerMinute: this.config.rateLimiting.maxMessagesPerMinute,
      windowMs: this.config.rateLimiting.blockDuration,
    });

    this.authService = new WebSocketAuthenticationService({
      required: this.config.authentication.required,
      tokenValidation: this.config.authentication.tokenValidation,
    });

    this.broadcastingService = new WebSocketBroadcastingService(
      this.connectionManager
    );

    this.messageHandlerService = new WebSocketMessageHandlerService(
      {
        rateLimitingEnabled: this.config.rateLimiting.enabled,
      },
      this.rateLimiter,
      this.messageRouter,
      this.connectionManager,
      this.broadcastingService
    );

    this.setupMessageHandlers();
    this.setupUtilityServices();
  }

  static getInstance(
    config?: Partial<WebSocketServerConfig>
  ): WebSocketServerService {
    if (!WebSocketServerService.instance) {
      WebSocketServerService.instance = new WebSocketServerService(config);
    }
    return WebSocketServerService.instance;
  }

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
      this.heartbeatManager.stop(this.heartbeatInterval);
    }
    if (this.metricsInterval) {
      this.metricsCollector.stop(this.metricsInterval);
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

  // ======================
  // Message Broadcasting (Delegated to Broadcasting Service)
  // ======================

  broadcast<T>(
    message: Omit<WebSocketMessage<T>, "messageId" | "timestamp">
  ): void {
    this.broadcastingService.broadcast(message);
  }

  broadcastToChannel<T>(
    channel: WebSocketChannel,
    message: WebSocketMessage<T>
  ): void {
    this.broadcastingService.broadcastToChannel(channel, message);
  }

  broadcastToUser<T>(userId: string, message: WebSocketMessage<T>): void {
    this.broadcastingService.broadcastToUser(userId, message);
  }

  sendMessage<T>(connectionId: string, message: WebSocketMessage<T>): boolean {
    return this.broadcastingService.sendMessage(connectionId, message);
  }

  // ======================
  // Agent Integration Methods (Delegated to Broadcasting Service)
  // ======================

  broadcastAgentStatus(agentStatus: AgentStatusMessage): void {
    this.broadcastingService.broadcastAgentStatus(agentStatus);
  }

  broadcastTradingPrice(priceData: TradingPriceMessage): void {
    this.broadcastingService.broadcastTradingPrice(priceData);
  }

  broadcastPatternDiscovery(pattern: PatternDiscoveryMessage): void {
    this.broadcastingService.broadcastPatternDiscovery(pattern);
  }

  broadcastNotification(notification: NotificationMessage): void {
    this.broadcastingService.broadcastNotification(notification);
  }

  // ======================
  // Private Methods
  // ======================

  private async handleConnection(
    ws: WebSocket,
    request: IncomingMessage
  ): Promise<void> {
    const connectionId = crypto.randomUUID();
    const clientIP = WebSocketUtilities.getClientIP(request);
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

      // Rate limiting check
      if (
        this.config.rateLimiting.enabled &&
        !this.rateLimiter.checkConnectionLimit(clientIP, connectionId)
      ) {
        ws.close(1008, "Too many connections from this IP");
        return;
      }

      // Authentication (if required) - delegated to auth service
      let userId: string | undefined;
      if (this.config.authentication.required) {
        const authResult = await this.authService.authenticateConnection(
          request,
          connectionId
        );
        if (!authResult.valid) {
          const errorMsg = authResult.error || "Authentication failed";
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
          await this.messageHandlerService.handleMessage(connectionId, data);
        } catch (error) {
          console.error(
            `[WebSocket] Error in message handler for ${connectionId}:`,
            error
          );
          this.messageHandlerService.sendError(
            connectionId,
            "MESSAGE_ERROR",
            "Failed to process message"
          );
        }
      });

      ws.on(
        "close",
        WebSocketUtilities.createConnectionCloseHandler(
          connectionId,
          clientIP,
          ({ connectionId, clientIP, code, reason }) => {
            this.handleDisconnection(connectionId, clientIP, code, reason);
          }
        )
      );

      ws.on(
        "error",
        WebSocketUtilities.createConnectionErrorHandler(
          connectionId,
          ({ connectionId, error }) => {
            this.handleDisconnection(
              connectionId,
              clientIP,
              1006,
              Buffer.from(
                error instanceof Error ? error.message : String(error)
              )
            );
          }
        )
      );

      // Setup connection health monitoring
      ws.on(
        "pong",
        WebSocketUtilities.createPongHandler(
          connectionId,
          this.connectionManager
        )
      );

      // Send welcome message
      const welcomeSuccess = this.sendMessage(connectionId, {
        type: "system:connect",
        channel: "system",
        data: WebSocketUtilities.createWelcomeMessage(connectionId),
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

  private setupUtilityServices(): void {
    // Initialize heartbeat manager
    this.heartbeatManager = WebSocketUtilities.createHeartbeatManager(
      this.connectionManager,
      this.config.performance.heartbeatInterval,
      this.config.performance.pingTimeout
    );

    // Initialize metrics collector
    this.metricsCollector = WebSocketUtilities.createMetricsCollector(
      this.connectionManager,
      this.serverMetrics,
      this.isRunning,
      this.config.monitoring.healthCheckInterval,
      (metrics) => {
        this.serverMetrics = metrics;
        this.emit("system:performance", { metrics });
      }
    );
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = this.heartbeatManager.start();
  }

  private startMetricsCollection(): void {
    if (!this.config.monitoring.metricsEnabled) return;

    this.metricsInterval = this.metricsCollector.start();
  }

  // ======================
  // Public API
  // ======================

  getServerMetrics(): ServerMetrics {
    return { ...this.serverMetrics };
  }

  getConnectionMetrics(): ConnectionMetrics[] {
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
