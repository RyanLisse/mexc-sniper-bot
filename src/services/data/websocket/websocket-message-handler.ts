/**
 * WebSocket Message Handler Service
 *
 * Handles incoming WebSocket message processing, validation, and subscription management.
 * Extracted from websocket-server.ts for modularity and maintainability.
 *
 * Features:
 * - Message validation and processing
 * - Subscription/unsubscription handling
 * - Error response generation
 * - Rate limiting integration
 * - Activity tracking
 */

import type { Buffer } from "node:buffer";
import { UniversalCrypto as crypto } from "@/src/lib/browser-compatible-events";
import type { WebSocketMessage } from "@/src/lib/websocket-types";
import type { WebSocketMessageRouter } from "./message-router";
import type { WebSocketRateLimiter } from "./rate-limiter";
import type { ServerConnectionManager } from "./server-connection-manager";
import type { WebSocketBroadcastingService } from "./websocket-broadcasting";

export interface MessageHandlerConfig {
  rateLimitingEnabled: boolean;
}

export class WebSocketMessageHandlerService {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[websocket-message-handler]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[websocket-message-handler]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[websocket-message-handler]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[websocket-message-handler]", message, context || ""),
  };

  constructor(
    private config: MessageHandlerConfig,
    private rateLimiter: WebSocketRateLimiter,
    private messageRouter: WebSocketMessageRouter,
    private connectionManager: ServerConnectionManager,
    private broadcastingService: WebSocketBroadcastingService
  ) {}

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(
    connectionId: string,
    data: Buffer | ArrayBuffer | Buffer[]
  ): Promise<void> {
    try {
      // Rate limiting check
      if (
        this.config.rateLimitingEnabled &&
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

      this.logger.debug("Message processed successfully", {
        connectionId,
        messageType: message.type,
        channel: message.channel,
      });
    } catch (error) {
      this.logger.error(
        `Error handling message from ${connectionId}`,
        { connectionId },
        error as Error
      );
      this.sendError(connectionId, "SERVER_ERROR", "Failed to process message");
    }
  }

  /**
   * Handle channel subscription
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

    this.broadcastingService.sendMessage(connectionId, {
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
      this.logger.info(`Connection ${connectionId} subscribed to ${channel}`, {
        connectionId,
        channel,
      });
    }
  }

  /**
   * Handle channel unsubscription
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

    this.broadcastingService.sendMessage(connectionId, {
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
      this.logger.info(
        `Connection ${connectionId} unsubscribed from ${channel}`,
        {
          connectionId,
          channel,
        }
      );
    }
  }

  /**
   * Send error message to connection
   */
  sendError(connectionId: string, code: string, message: string): void {
    this.broadcastingService.sendMessage(connectionId, {
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

  /**
   * Validate message structure
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
   * Update message handler configuration
   */
  updateConfig(newConfig: Partial<MessageHandlerConfig>): void {
    const oldConfig = { ...this.config };

    if (newConfig.rateLimitingEnabled !== undefined) {
      this.config.rateLimitingEnabled = newConfig.rateLimitingEnabled;
    }

    this.logger.info("Message handler configuration updated", {
      oldRateLimitingEnabled: oldConfig.rateLimitingEnabled,
      newRateLimitingEnabled: this.config.rateLimitingEnabled,
    });
  }

  /**
   * Get message handler configuration
   */
  getConfig(): Readonly<MessageHandlerConfig> {
    return {
      rateLimitingEnabled: this.config.rateLimitingEnabled,
    };
  }
}
