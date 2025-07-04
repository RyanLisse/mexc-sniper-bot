/**
 * WebSocket Server Connection Manager
 *
 * Manages server-side WebSocket connections, user sessions, and channel subscriptions.
 * Extracted from websocket-server.ts for modularity and maintainability.
 *
 * Features:
 * - Connection lifecycle management
 * - User-based connection grouping
 * - Channel subscription management
 * - Connection metrics tracking
 * - Activity monitoring
 */

import type { WebSocket } from "ws";
import type {
  ConnectionMetrics,
  WebSocketConnection,
} from "@/src/lib/websocket-types";

export interface ConnectionManagerMetrics {
  totalConnections: number;
  authenticatedConnections: number;
  totalChannels: number;
  totalSubscriptions: number;
  connectionMetrics: ConnectionMetrics[];
}

export class ServerConnectionManager {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[server-connection-manager]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[server-connection-manager]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[server-connection-manager]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[server-connection-manager]", message, context || ""),
  };

  private connections = new Map<
    string,
    WebSocketConnection & { ws: InstanceType<typeof UniversalWebSocket> }
  >();
  private userConnections = new Map<string, Set<string>>();
  private channelSubscriptions = new Map<string, Set<string>>();
  private connectionMetrics = new Map<string, ConnectionMetrics>();

  /**
   * Add a new WebSocket connection
   */
  addConnection(
    connectionId: string,
    ws: WebSocket,
    userId?: string,
    clientType: WebSocketConnection["clientType"] = "dashboard"
  ): void {
    const connection: WebSocketConnection & {
      ws: InstanceType<typeof UniversalWebSocket>;
    } = {
      id: connectionId,
      userId,
      clientType,
      subscriptions: new Set(),
      lastActivity: Date.now(),
      isAuthenticated: !!userId,
      ws,
      metadata: {
        userAgent: "",
        clientIP: "",
        connectedAt: Date.now(),
      },
    };

    this.connections.set(connectionId, connection);

    if (userId) {
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)?.add(connectionId);
    }

    // Initialize metrics
    this.connectionMetrics.set(connectionId, {
      connectionId,
      userId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messagesSent: 0,
      messagesReceived: 0,
      subscriptions: [],
    });

    this.logger.info(`Connection added: ${connectionId}`, {
      userId: userId || "anonymous",
      clientType,
    });
  }

  /**
   * Remove a WebSocket connection and clean up associated data
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn(
        `Attempted to remove non-existent connection: ${connectionId}`
      );
      return;
    }

    // Remove from user connections
    if (connection.userId) {
      const userConns = this.userConnections.get(connection.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
    }

    // Remove from channel subscriptions
    for (const channel of connection.subscriptions) {
      const subscribers = this.channelSubscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this.channelSubscriptions.delete(channel);
        }
      }
    }

    this.connections.delete(connectionId);
    this.connectionMetrics.delete(connectionId);

    this.logger.info(`Connection removed: ${connectionId}`, {
      userId: connection.userId || "anonymous",
    });
  }

  /**
   * Get a specific connection by ID
   */
  getConnection(
    connectionId: string
  ):
    | (WebSocketConnection & { ws: InstanceType<typeof UniversalWebSocket> })
    | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a specific user
   */
  getUserConnections(
    userId: string
  ): (WebSocketConnection & { ws: InstanceType<typeof UniversalWebSocket> })[] {
    const connectionIds = this.userConnections.get(userId) || new Set();
    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter(Boolean) as (WebSocketConnection & {
      ws: InstanceType<typeof UniversalWebSocket>;
    })[];
  }

  /**
   * Get all connections subscribed to a specific channel
   */
  getChannelSubscribers(
    channel: string
  ): (WebSocketConnection & { ws: InstanceType<typeof UniversalWebSocket> })[] {
    const connectionIds = this.channelSubscriptions.get(channel) || new Set();
    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter(Boolean) as (WebSocketConnection & {
      ws: InstanceType<typeof UniversalWebSocket>;
    })[];
  }

  /**
   * Subscribe a connection to a channel
   */
  subscribeToChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn(
        `Cannot subscribe non-existent connection: ${connectionId}`
      );
      return false;
    }

    connection.subscriptions.add(channel);

    if (!this.channelSubscriptions.has(channel)) {
      this.channelSubscriptions.set(channel, new Set());
    }
    this.channelSubscriptions.get(channel)?.add(connectionId);

    // Update metrics
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.subscriptions = Array.from(connection.subscriptions);
    }

    this.logger.info(`Subscription added: ${connectionId} -> ${channel}`);
    return true;
  }

  /**
   * Unsubscribe a connection from a channel
   */
  unsubscribeFromChannel(connectionId: string, channel: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn(
        `Cannot unsubscribe non-existent connection: ${connectionId}`
      );
      return false;
    }

    connection.subscriptions.delete(channel);

    const subscribers = this.channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    // Update metrics
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.subscriptions = Array.from(connection.subscriptions);
    }

    this.logger.info(`Subscription removed: ${connectionId} -> ${channel}`);
    return true;
  }

  /**
   * Update the last activity timestamp for a connection
   */
  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    const metrics = this.connectionMetrics.get(connectionId);

    if (connection) {
      connection.lastActivity = Date.now();
    }

    if (metrics) {
      metrics.lastActivity = Date.now();
    }
  }

  /**
   * Increment message count for metrics tracking
   */
  incrementMessageCount(connectionId: string, type: "sent" | "received"): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      if (type === "sent") {
        metrics.messagesSent++;
      } else {
        metrics.messagesReceived++;
      }
    }
  }

  /**
   * Get all active connections
   */
  getAllConnections(): (WebSocketConnection & {
    ws: InstanceType<typeof UniversalWebSocket>;
  })[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get comprehensive connection metrics
   */
  getMetrics(): ConnectionManagerMetrics {
    const connections = Array.from(this.connections.values());
    const authenticatedCount = connections.filter(
      (c) => c.isAuthenticated
    ).length;
    const totalSubscriptions = connections.reduce(
      (sum, c) => sum + c.subscriptions.size,
      0
    );

    return {
      totalConnections: connections.length,
      authenticatedConnections: authenticatedCount,
      totalChannels: this.channelSubscriptions.size,
      totalSubscriptions,
      connectionMetrics: Array.from(this.connectionMetrics.values()),
    };
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections(maxInactiveTime = 30 * 60 * 1000): number {
    const now = Date.now();
    const inactiveConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastActivity > maxInactiveTime) {
        inactiveConnections.push(connectionId);
      }
    }

    for (const connectionId of inactiveConnections) {
      this.removeConnection(connectionId);
    }

    if (inactiveConnections.length > 0) {
      this.logger.info(
        `Cleaned up ${inactiveConnections.length} inactive connections`
      );
    }

    return inactiveConnections.length;
  }

  /**
   * Get connections by client type
   */
  getConnectionsByType(
    clientType: WebSocketConnection["clientType"]
  ): (WebSocketConnection & { ws: InstanceType<typeof UniversalWebSocket> })[] {
    return Array.from(this.connections.values()).filter(
      (c) => c.clientType === clientType
    );
  }

  /**
   * Check if a user has any active connections
   */
  hasUserConnections(userId: string): boolean {
    const userConns = this.userConnections.get(userId);
    return userConns ? userConns.size > 0 : false;
  }

  /**
   * Get channel subscription count
   */
  getChannelSubscriptionCount(channel: string): number {
    const subscribers = this.channelSubscriptions.get(channel);
    return subscribers ? subscribers.size : 0;
  }

  /**
   * Get all active channels
   */
  getActiveChannels(): string[] {
    return Array.from(this.channelSubscriptions.keys());
  }
}
