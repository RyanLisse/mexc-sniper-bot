/**
 * WebSocket Connection Handler
 *
 * Handles WebSocket connection lifecycle, authentication, and message processing.
 * Extracted from websocket-server.ts for better modularity and maintainability.
 *
 * Features:
 * - Connection establishment and validation
 * - Authentication and authorization
 * - Message handling and routing
 * - Error recovery and cleanup
 * - Connection health monitoring
 */

import type { IncomingMessage } from "node:http";
import { WebSocket } from "ws";
import { UniversalCrypto as crypto } from "@/src/lib/browser-compatible-events";
import type {
  WebSocketMessage,
  WebSocketServerConfig,
} from "@/src/lib/websocket-types";
import type { WebSocketMessageRouter } from "./message-router";
import type { WebSocketRateLimiter } from "./rate-limiter";
import type { ServerConnectionManager } from "./server-connection-manager";

export interface ConnectionHandlerDependencies {
  connectionManager: ServerConnectionManager;
  rateLimiter: WebSocketRateLimiter;
  messageRouter: WebSocketMessageRouter;
  config: WebSocketServerConfig;
  sendMessage: (connectionId: string, message: WebSocketMessage) => boolean;
  sendError: (connectionId: string, code: string, message: string) => void;
  emit: (event: string, data: any) => void;
}

export class WebSocketConnectionHandler {
  private connectionManager: ServerConnectionManager;
  private rateLimiter: WebSocketRateLimiter;
  private messageRouter: WebSocketMessageRouter;
  private config: WebSocketServerConfig;
  private sendMessage: (
    connectionId: string,
    message: WebSocketMessage
  ) => boolean;
  private sendError: (
    connectionId: string,
    code: string,
    message: string
  ) => void;
  private emit: (event: string, data: any) => void;

  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[websocket-connection-handler]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[websocket-connection-handler]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[websocket-connection-handler]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[websocket-connection-handler]", message, context || ""),
  };

  constructor(dependencies: ConnectionHandlerDependencies) {
    this.connectionManager = dependencies.connectionManager;
    this.rateLimiter = dependencies.rateLimiter;
    this.messageRouter = dependencies.messageRouter;
    this.config = dependencies.config;
    this.sendMessage = dependencies.sendMessage;
    this.sendError = dependencies.sendError;
    this.emit = dependencies.emit;
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(
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
        this.logger.warn(`Connection timeout for ${connectionId}`);
        ws.close(1008, "Connection timeout");
      }
    }, 10000); // 10 second timeout

    try {
      // Validate WebSocket state
      if (
        ws.readyState !== WebSocket.OPEN &&
        ws.readyState !== WebSocket.CONNECTING
      ) {
        this.logger.warn(
          `Invalid WebSocket state: ${ws.readyState} for ${connectionId}`
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

      // Authentication (if required)
      let userId: string | undefined;
      if (this.config.authentication.required) {
        const authResult = await this.authenticateConnection(request);
        if (!authResult.valid) {
          const errorMsg =
            "error" in authResult ? authResult.error : "Authentication failed";
          this.logger.warn(
            `Authentication failed for ${connectionId}: ${errorMsg}`
          );
          ws.close(1008, errorMsg);
          return;
        }
        userId = authResult.userId;
      }

      // Validate connection is still open before proceeding
      if (ws.readyState !== WebSocket.OPEN) {
        this.logger.warn(`Connection closed during setup: ${connectionId}`);
        return;
      }

      // Add connection to manager
      this.connectionManager.addConnection(connectionId, ws, userId);
      connectionAdded = true;

      // Clear connection timeout since setup is successful
      clearTimeout(connectionTimeout);

      // Setup event handlers
      this.setupConnectionEventHandlers(ws, connectionId, clientIP);

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
        this.logger.warn(`Failed to send welcome message to ${connectionId}`);
        this.handleDisconnection(
          connectionId,
          clientIP,
          1011,
          Buffer.from("Welcome message failed")
        );
        return;
      }

      this.logger.info(
        `New connection established: ${connectionId} (user: ${userId || "anonymous"})`
      );
      this.emit("connection:open", { connectionId, userId });
    } catch (error) {
      this.logger.error(`Failed to handle connection ${connectionId}:`, error);

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

  /**
   * Setup event handlers for a WebSocket connection
   */
  private setupConnectionEventHandlers(
    ws: WebSocket,
    connectionId: string,
    clientIP: string
  ): void {
    // Message handler
    ws.on("message", async (data) => {
      try {
        await this.handleMessage(connectionId, data);
      } catch (error) {
        this.logger.error(
          `Error in message handler for ${connectionId}:`,
          error
        );
        this.sendError(
          connectionId,
          "MESSAGE_ERROR",
          "Failed to process message"
        );
      }
    });

    // Close handler
    ws.on("close", (code, reason) => {
      this.handleDisconnection(connectionId, clientIP, code, reason);
    });

    // Error handler
    ws.on("error", (error) => {
      this.logger.error(`Connection error for ${connectionId}:`, error);
      this.handleDisconnection(
        connectionId,
        clientIP,
        1006,
        Buffer.from(error.message)
      );
    });

    // Pong handler for health monitoring
    ws.on("pong", () => {
      this.connectionManager.updateActivity(connectionId);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(
    connectionId: string,
    data: Buffer | ArrayBuffer | Buffer[]
  ): Promise<void> {
    try {
      // Rate limiting check
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

      // Route message to handlers
      await this.messageRouter.routeMessage(message, connectionId);

      this.emit("message:received", { message, connectionId });
    } catch (error) {
      this.logger.error(`Error handling message from ${connectionId}:`, error);
      this.sendError(connectionId, "SERVER_ERROR", "Failed to process message");
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(
    connectionId: string,
    clientIP: string,
    code: number,
    reason: Buffer
  ): void {
    this.connectionManager.removeConnection(connectionId);
    this.rateLimiter.removeConnection(clientIP, connectionId);

    this.logger.info(
      `Connection closed: ${connectionId} (code: ${code}, reason: ${reason.toString()})`
    );
    this.emit("connection:close", { connectionId, reason: reason.toString() });
  }

  /**
   * Handle subscription requests
   */
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

  /**
   * Handle unsubscription requests
   */
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

  /**
   * Validate WebSocket message structure
   */
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

  /**
   * Authenticate WebSocket connection
   */
  private async authenticateConnection(
    request: IncomingMessage
  ): Promise<{ valid: boolean; userId?: string; error?: string }> {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      const token =
        url.searchParams.get("token") ||
        request.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return { valid: false, error: "No authentication token provided" };
      }

      const result = await this.config.authentication.tokenValidation(token);
      return result.valid ? result : { valid: false, error: "Invalid token" };
    } catch (error) {
      this.logger.error("Authentication error:", error);
      return { valid: false, error: "Authentication failed" };
    }
  }

  /**
   * Extract client IP address from request
   */
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

  /**
   * Get connection handler statistics
   */
  getStats(): {
    connectionsHandled: number;
    messagesProcessed: number;
    authenticationAttempts: number;
    authenticationFailures: number;
  } {
    // This would be implemented with actual tracking in a real scenario
    return {
      connectionsHandled: 0,
      messagesProcessed: 0,
      authenticationAttempts: 0,
      authenticationFailures: 0,
    };
  }
}
