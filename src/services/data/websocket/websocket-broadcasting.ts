/**
 * WebSocket Broadcasting Service
 *
 * Handles message broadcasting to WebSocket connections based on channels and users.
 * Extracted from websocket-server.ts for modularity and reusability.
 *
 * Features:
 * - Channel-based broadcasting
 * - User-specific broadcasting
 * - Agent status broadcasting
 * - Trading data broadcasting
 * - Pattern discovery broadcasting
 * - Notification broadcasting
 */

import { UniversalCrypto as crypto } from "@/src/lib/browser-compatible-events";
import {
  instrumentChannelOperation,
  instrumentWebSocketSend,
} from "@/src/lib/opentelemetry-websocket-instrumentation";
import type {
  AgentStatusMessage,
  NotificationMessage,
  PatternDiscoveryMessage,
  TradingPriceMessage,
  WebSocketChannel,
  WebSocketMessage,
} from "@/src/lib/websocket-types";
import type { ServerConnectionManager } from "./server-connection-manager";

export interface BroadcastingStats {
  totalMessagesSent: number;
  messagesPerChannel: Record<string, number>;
  messagesPerUser: Record<string, number>;
  broadcastErrors: number;
  instrumentationErrors: number;
}

export class WebSocketBroadcastingService {
  private stats: BroadcastingStats = {
    totalMessagesSent: 0,
    messagesPerChannel: {},
    messagesPerUser: {},
    broadcastErrors: 0,
    instrumentationErrors: 0,
  };

  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[websocket-broadcasting]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[websocket-broadcasting]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[websocket-broadcasting]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[websocket-broadcasting]", message, context || ""),
  };

  constructor(private connectionManager: ServerConnectionManager) {}

  /**
   * Broadcast a message to all subscribers of a channel
   */
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
      this.stats.instrumentationErrors++;
      this.logger.error("Broadcast instrumentation error", {}, error);
    });
  }

  /**
   * Broadcast message to specific channel
   */
  broadcastToChannel<T>(
    channel: WebSocketChannel,
    message: WebSocketMessage<T>
  ): void {
    try {
      const subscribers = this.connectionManager.getChannelSubscribers(channel);
      let successCount = 0;
      let errorCount = 0;

      for (const connection of subscribers) {
        const success = this.sendMessage(connection.id, message);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Update statistics
      this.stats.totalMessagesSent += successCount;
      this.stats.messagesPerChannel[channel] =
        (this.stats.messagesPerChannel[channel] || 0) + successCount;
      this.stats.broadcastErrors += errorCount;

      this.logger.info(
        `Broadcasted to ${channel}: ${successCount}/${subscribers.length} successful`,
        {
          channel,
          successCount,
          errorCount,
          totalSubscribers: subscribers.length,
        }
      );
    } catch (error) {
      this.stats.broadcastErrors++;
      this.logger.error(
        `Error broadcasting to channel: ${channel}`,
        { channel },
        error as Error
      );
    }
  }

  /**
   * Broadcast message to specific user
   */
  broadcastToUser<T>(userId: string, message: WebSocketMessage<T>): void {
    try {
      const connections = this.connectionManager.getUserConnections(userId);
      let successCount = 0;
      let errorCount = 0;

      for (const connection of connections) {
        const success = this.sendMessage(connection.id, message);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Update statistics
      this.stats.totalMessagesSent += successCount;
      this.stats.messagesPerUser[userId] =
        (this.stats.messagesPerUser[userId] || 0) + successCount;
      this.stats.broadcastErrors += errorCount;

      this.logger.info(
        `Broadcasted to user ${userId}: ${successCount}/${connections.length} successful`,
        {
          userId,
          successCount,
          errorCount,
          totalConnections: connections.length,
        }
      );
    } catch (error) {
      this.stats.broadcastErrors++;
      this.logger.error(
        `Error broadcasting to user: ${userId}`,
        { userId },
        error as Error
      );
    }
  }

  /**
   * Send message to specific connection
   */
  sendMessage<T>(connectionId: string, message: WebSocketMessage<T>): boolean {
    try {
      const connection = this.connectionManager.getConnection(connectionId);
      if (!connection || connection.ws.readyState !== 1) {
        // WebSocket.OPEN = 1
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
        this.stats.instrumentationErrors++;
        this.logger.error("Send message instrumentation error", {}, error);
      });

      const serialized = JSON.stringify(message);
      connection.ws.send(serialized);

      this.connectionManager.updateActivity(connectionId);
      this.connectionManager.incrementMessageCount(connectionId, "sent");

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${connectionId}`,
        { connectionId, messageType: message.type },
        error as Error
      );
      return false;
    }
  }

  /**
   * Broadcast agent status update
   */
  broadcastAgentStatus(agentStatus: AgentStatusMessage): void {
    // Broadcast to general agents channel
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

  /**
   * Broadcast trading price update
   */
  broadcastTradingPrice(priceData: TradingPriceMessage): void {
    // Broadcast to general trading prices channel
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

  /**
   * Broadcast pattern discovery
   */
  broadcastPatternDiscovery(pattern: PatternDiscoveryMessage): void {
    // Broadcast to general patterns channel
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

  /**
   * Broadcast notification
   */
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

  /**
   * Get broadcasting statistics
   */
  getStats(): BroadcastingStats {
    return {
      totalMessagesSent: this.stats.totalMessagesSent,
      messagesPerChannel: { ...this.stats.messagesPerChannel },
      messagesPerUser: { ...this.stats.messagesPerUser },
      broadcastErrors: this.stats.broadcastErrors,
      instrumentationErrors: this.stats.instrumentationErrors,
    };
  }

  /**
   * Reset broadcasting statistics
   */
  resetStats(): void {
    this.stats = {
      totalMessagesSent: 0,
      messagesPerChannel: {},
      messagesPerUser: {},
      broadcastErrors: 0,
      instrumentationErrors: 0,
    };

    this.logger.info("Broadcasting statistics reset");
  }

  /**
   * Get active channels with subscriber counts
   */
  getActiveChannels(): Record<string, number> {
    const channels: Record<string, number> = {};

    // This would need to be implemented by accessing connection manager's channel data
    // For now, return channels from our stats
    for (const channel in this.stats.messagesPerChannel) {
      // Get current subscriber count for the channel
      const subscribers = this.connectionManager.getChannelSubscribers(
        channel as WebSocketChannel
      );
      channels[channel] = subscribers.length;
    }

    return channels;
  }

  /**
   * Get user connection counts
   */
  getUserConnectionCounts(): Record<string, number> {
    const userCounts: Record<string, number> = {};

    for (const userId in this.stats.messagesPerUser) {
      const connections = this.connectionManager.getUserConnections(userId);
      userCounts[userId] = connections.length;
    }

    return userCounts;
  }
}
