/**
 * WebSocket Utilities Service
 *
 * Collection of utility functions for WebSocket operations.
 * Extracted from websocket-server.ts for modularity and reusability.
 *
 * Features:
 * - Client IP extraction from requests
 * - Heartbeat management
 * - Metrics collection
 * - Connection monitoring
 */

import type { IncomingMessage } from "node:http";
import { WebSocket } from "ws";
import type { ServerMetrics } from "@/src/lib/websocket-types";
import type { ServerConnectionManager } from "./server-connection-manager";

export class WebSocketUtilities {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[websocket-utilities]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[websocket-utilities]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[websocket-utilities]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[websocket-utilities]", message, context || ""),
  };

  /**
   * Extract client IP address from incoming request
   */
  static getClientIP(request: IncomingMessage): string {
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
   * Create and manage heartbeat functionality
   */
  static createHeartbeatManager(
    connectionManager: ServerConnectionManager,
    heartbeatInterval: number,
    pingTimeout: number
  ): {
    start: () => NodeJS.Timeout;
    stop: (intervalId: NodeJS.Timeout) => void;
  } {
    return {
      start: () => {
        return setInterval(() => {
          const connections = connectionManager.getAllConnections();
          const now = Date.now();

          for (const connection of connections) {
            if (connection.ws.readyState === WebSocket.OPEN) {
              // Send ping
              connection.ws.ping();

              // Check if connection is stale
              if (now - connection.lastActivity > pingTimeout * 2) {
                console.info(
                  `[WebSocket] Closing stale connection: ${connection.id}`
                );
                connection.ws.close(1001, "Connection timeout");
              }
            }
          }
        }, heartbeatInterval);
      },
      stop: (intervalId: NodeJS.Timeout) => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      },
    };
  }

  /**
   * Create and manage metrics collection
   */
  static createMetricsCollector(
    connectionManager: ServerConnectionManager,
    serverMetrics: ServerMetrics,
    isRunning: boolean,
    healthCheckInterval: number,
    onMetricsUpdate: (metrics: ServerMetrics) => void
  ): {
    start: () => NodeJS.Timeout;
    stop: (intervalId: NodeJS.Timeout) => void;
  } {
    return {
      start: () => {
        return setInterval(() => {
          const connectionMetrics = connectionManager.getMetrics();

          const updatedMetrics: ServerMetrics = {
            ...connectionMetrics,
            messagesPerSecond: 0, // Would need to track this properly
            averageLatency: 0, // Would need to measure latency
            errorRate: 0, // Would need to track errors
            uptime: isRunning
              ? Date.now() - (serverMetrics.uptime || Date.now())
              : 0,
          };

          onMetricsUpdate(updatedMetrics);
        }, healthCheckInterval);
      },
      stop: (intervalId: NodeJS.Timeout) => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      },
    };
  }

  /**
   * Validate WebSocket connection state
   */
  static isValidWebSocketState(ws: WebSocket): boolean {
    return (
      ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING
    );
  }

  /**
   * Format connection timeout message
   */
  static formatTimeoutMessage(connectionId: string, timeoutMs: number): string {
    return `Connection ${connectionId} timeout after ${timeoutMs}ms`;
  }

  /**
   * Create connection error handler
   */
  static createConnectionErrorHandler(
    connectionId: string,
    onError: (error: { connectionId: string; error: unknown }) => void
  ): (error: Error) => void {
    return (error: Error) => {
      console.error(`[WebSocket] Connection error for ${connectionId}:`, error);
      onError({ connectionId, error });
    };
  }

  /**
   * Create connection close handler
   */
  static createConnectionCloseHandler(
    connectionId: string,
    clientIP: string,
    onClose: (data: {
      connectionId: string;
      clientIP: string;
      code: number;
      reason: Buffer;
    }) => void
  ): (code: number, reason: Buffer) => void {
    return (code: number, reason: Buffer) => {
      console.info(
        `[WebSocket] Connection closed: ${connectionId} (code: ${code}, reason: ${reason.toString()})`
      );
      onClose({ connectionId, clientIP, code, reason });
    };
  }

  /**
   * Create pong handler for latency tracking
   */
  static createPongHandler(
    connectionId: string,
    connectionManager: ServerConnectionManager
  ): () => void {
    return () => {
      connectionManager.updateActivity(connectionId);
    };
  }

  /**
   * Format welcome message data
   */
  static createWelcomeMessage(connectionId: string): {
    connectionId: string;
    serverTime: number;
    features: string[];
  } {
    return {
      connectionId,
      serverTime: Date.now(),
      features: ["agents", "trading", "patterns", "notifications"],
    };
  }

  /**
   * Check if code represents a normal connection closure
   */
  static isNormalClosure(code: number): boolean {
    return code === 1000; // Normal closure
  }

  /**
   * Get appropriate error code for authentication failure
   */
  static getAuthErrorCode(): number {
    return 1008; // Policy violation
  }

  /**
   * Get appropriate error code for rate limiting
   */
  static getRateLimitErrorCode(): number {
    return 1008; // Policy violation
  }

  /**
   * Get appropriate error code for server shutdown
   */
  static getShutdownCode(): number {
    return 1001; // Going away
  }
}
