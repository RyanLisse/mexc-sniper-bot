/**
 * Enhanced WebSocket Connection Manager
 *
 * Handles WebSocket connection lifecycle, reconnection logic, heartbeat, and error recovery
 * with enhanced performance monitoring and adaptive reconnection strategies.
 *
 * Features:
 * - Adaptive reconnection with exponential backoff and jitter
 * - Circuit breaker pattern for connection failures
 * - Connection health monitoring and metrics
 * - Automatic failover and recovery mechanisms
 * - Real-time performance tracking
 */

import { EventEmitter } from "node:events";
import WebSocket, { type RawData } from "ws";

export interface ConnectionManagerOptions {
  url: string;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  healthCheckInterval?: number;
  circuitBreakerThreshold?: number;
  adaptiveReconnection?: boolean;
}

interface ConnectionMetrics {
  connectTime: number;
  lastPong: number;
  messagesReceived: number;
  messagesSent: number;
  errorCount: number;
  reconnectCount: number;
  averageLatency: number;
  connectionQuality: "excellent" | "good" | "poor" | "critical";
}

interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

interface QueuedMessage {
  data: any;
  priority: "high" | "normal" | "low";
  timestamp: number;
  retryCount: number;
}

export class MexcConnectionManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private connectionId?: string;
  private reconnectAttempts = 0;
  private reconnectDelay: number;
  private heartbeatInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private isConnecting = false;
  private isConnected = false;
  private connectionStartTime = 0;
  private lastPingTime = 0;
  private metrics!: ConnectionMetrics;
  private circuitBreaker!: CircuitBreakerState;
  private messageQueue: QueuedMessage[] = [];
  private isDestroyed = false;

  private readonly url: string;
  private readonly maxReconnectAttempts: number;
  private readonly maxReconnectDelay: number;
  private readonly heartbeatIntervalMs: number;
  private readonly connectionTimeout: number;
  private readonly healthCheckIntervalMs: number;
  private readonly circuitBreakerThreshold: number;
  private readonly adaptiveReconnection: boolean;
  private readonly onMessage: (data: any) => void;
  private readonly onError: (error: Error) => void;

  private logger = {
    info: (message: string, context?: any) =>
      console.info("[connection-manager]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[connection-manager]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[connection-manager]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[connection-manager]", message, context || ""),
  };

  constructor(
    options: ConnectionManagerOptions,
    onMessage: (data: any) => void,
    onError: (error: Error) => void
  ) {
    super();

    this.url = options.url;
    this.onMessage = onMessage;
    this.onError = onError;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.initialReconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.heartbeatIntervalMs = options.heartbeatInterval || 30000;
    this.connectionTimeout = options.connectionTimeout || 10000;
    this.healthCheckIntervalMs = options.healthCheckInterval || 15000;
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
    this.adaptiveReconnection = options.adaptiveReconnection ?? true;

    this.initializeMetrics();
    this.initializeCircuitBreaker();
  }

  /**
   * Establish WebSocket connection
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      this.logger.debug("Connection already in progress or established");
      return;
    }

    this.isConnecting = true;
    this.connectionId = `mexc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.info("Establishing MEXC WebSocket connection", {
        url: this.url,
        connectionId: this.connectionId,
        attempt: this.reconnectAttempts + 1,
      });

      // Create Node.js WebSocket instance (server-side only)
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => this.handleOpen());
      this.ws.on("message", (data: RawData) => this.handleMessage(data));
      this.ws.on("close", (code: number, reason: Buffer) =>
        this.handleClose(code, reason)
      );
      this.ws.on("error", (error: Error) => this.handleError(error));

      // Wait for connection to be established with proper error handling
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.cleanup();
          this.updateCircuitBreakerOnFailure();
          reject(new Error("WebSocket connection timeout"));
        }, this.connectionTimeout);

        const cleanup = () => {
          clearTimeout(timeout);
        };

        this.ws?.once("open", () => {
          cleanup();
          resolve();
        });

        this.ws?.once("error", (error: Error) => {
          cleanup();
          this.cleanup();
          reject(error);
        });

        this.ws?.once("close", (code: number, reason: Buffer) => {
          cleanup();
          this.cleanup();
          reject(
            new Error(
              `Connection closed during establishment: ${code} - ${reason}`
            )
          );
        });
      });
    } catch (error) {
      this.isConnecting = false;
      this.cleanup();
      this.logger.error("Failed to establish WebSocket connection", {
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.connectionId,
      });
      throw error;
    }
  }

  /**
   * Clean up connection resources
   */
  private cleanup(): void {
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close();
        }
      } catch (error) {
        this.logger.error("Error during WebSocket cleanup", {
          error: error instanceof Error ? error.message : String(error),
          connectionId: this.connectionId,
        });
      } finally {
        this.ws = null;
      }
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Close WebSocket connection
   */
  disconnect(): void {
    this.logger.info("Disconnecting MEXC WebSocket", {
      connectionId: this.connectionId,
    });

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, "Normal closure");
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Send data through WebSocket
   */
  send(data: any): void {
    if (
      !this.isConnected ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      throw new Error("WebSocket not connected or not ready");
    }

    try {
      this.ws.send(JSON.stringify(data));
      this.metrics.messagesSent++;
    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error("Failed to send WebSocket message", {
        error: error instanceof Error ? error.message : String(error),
        connectionId: this.connectionId,
      });
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    connecting: boolean;
    connectionId?: string;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      connectionId: this.connectionId,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    this.isConnecting = false;
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000; // Reset delay

    this.logger.info("MEXC WebSocket connected successfully", {
      connectionId: this.connectionId,
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(data: RawData): void {
    try {
      const dataString = Buffer.isBuffer(data) ? data.toString() : String(data);
      const message = JSON.parse(dataString);
      this.metrics.messagesReceived++;
      this.onMessage(message);
    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error("Failed to parse WebSocket message", {
        error: error instanceof Error ? error.message : String(error),
        dataLength: Buffer.isBuffer(data) ? data.length : String(data).length,
      });
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: Buffer): void {
    this.isConnected = false;
    this.isConnecting = false;

    this.stopHeartbeat();

    this.logger.warn("MEXC WebSocket connection closed", {
      code,
      reason: reason.toString(),
      connectionId: this.connectionId,
      reconnectAttempts: this.reconnectAttempts,
    });

    // Clean up WebSocket reference
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }

    // Attempt reconnection unless it was a normal closure
    if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      if (this.adaptiveReconnection) {
        this.scheduleAdaptiveReconnect();
      } else {
        this.scheduleReconnect();
      }
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error("Max reconnection attempts reached", {
        maxAttempts: this.maxReconnectAttempts,
        connectionId: this.connectionId,
      });
      this.onError(new Error("Max reconnection attempts reached"));
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Error): void {
    this.logger.error("MEXC WebSocket error", {
      error: error.message,
      connectionId: this.connectionId,
    });
    this.onError(error);
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;

    this.logger.info("Scheduling WebSocket reconnection", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay: this.reconnectDelay,
      connectionId: this.connectionId,
    });

    setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error("Reconnection attempt failed", {
          error: error instanceof Error ? error.message : String(error),
          attempt: this.reconnectAttempts,
        });

        // Exponential backoff with jitter
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2 + Math.random() * 1000,
          this.maxReconnectDelay
        );

        // Continue attempting reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.logger.error("Max reconnection attempts reached, giving up", {
            maxAttempts: this.maxReconnectAttempts,
          });
          this.onError(new Error("Max reconnection attempts reached"));
        }
      });
    }, this.reconnectDelay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (
        this.isConnected &&
        this.ws &&
        this.ws.readyState === WebSocket.OPEN
      ) {
        try {
          this.lastPingTime = Date.now();
          this.ws.ping();
          this.logger.debug("Heartbeat sent", {
            connectionId: this.connectionId,
          });
        } catch (error) {
          this.logger.error("Failed to send heartbeat", {
            error: error instanceof Error ? error.message : String(error),
            connectionId: this.connectionId,
          });
        }
      }
    }, this.heartbeatIntervalMs);

    // Set up pong handler for latency measurement
    this.ws?.on("pong", () => {
      const latency = Date.now() - this.lastPingTime;
      this.metrics.lastPong = Date.now();
      this.updateLatencyMetrics(latency);
    });

    // Start health monitoring
    this.startHealthCheck();
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Perform connection health check
   */
  private performHealthCheck(): void {
    const now = Date.now();
    const timeSinceLastPong = now - this.metrics.lastPong;
    const timeSinceConnect = now - this.metrics.connectTime;

    // Update connection quality based on metrics
    if (timeSinceLastPong > this.heartbeatIntervalMs * 3) {
      this.metrics.connectionQuality = "critical";
      this.logger.warn("Connection quality critical - no pong received", {
        timeSinceLastPong,
        connectionId: this.connectionId,
      });
    } else if (this.metrics.averageLatency > 5000) {
      this.metrics.connectionQuality = "poor";
    } else if (this.metrics.averageLatency > 2000) {
      this.metrics.connectionQuality = "good";
    } else {
      this.metrics.connectionQuality = "excellent";
    }

    // Emit health status update
    this.emit("health-update", {
      connectionId: this.connectionId,
      quality: this.metrics.connectionQuality,
      metrics: { ...this.metrics },
      uptime: timeSinceConnect,
    });
  }

  /**
   * Initialize connection metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      connectTime: 0,
      lastPong: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errorCount: 0,
      reconnectCount: 0,
      averageLatency: 0,
      connectionQuality: "excellent",
    };
  }

  /**
   * Initialize circuit breaker
   */
  private initializeCircuitBreaker(): void {
    this.circuitBreaker = {
      state: "closed",
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    };
  }

  /**
   * Update circuit breaker on failure
   */
  private updateCircuitBreakerOnFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= this.circuitBreakerThreshold) {
      this.circuitBreaker.state = "open";
      this.circuitBreaker.nextAttemptTime =
        Date.now() + this.reconnectDelay * 2;

      this.logger.warn("Circuit breaker opened due to failures", {
        failureCount: this.circuitBreaker.failureCount,
        threshold: this.circuitBreakerThreshold,
        nextAttemptTime: this.circuitBreaker.nextAttemptTime,
      });

      this.emit("circuit-breaker-opened", {
        failureCount: this.circuitBreaker.failureCount,
        nextAttemptTime: this.circuitBreaker.nextAttemptTime,
      });
    }
  }

  /**
   * Update circuit breaker on success
   */
  private updateCircuitBreakerOnSuccess(): void {
    if (this.circuitBreaker.state === "half-open") {
      this.circuitBreaker.state = "closed";
      this.circuitBreaker.failureCount = 0;

      this.logger.info("Circuit breaker closed after successful connection", {
        connectionId: this.connectionId,
      });

      this.emit("circuit-breaker-closed", {
        connectionId: this.connectionId,
      });
    } else if (this.circuitBreaker.state === "closed") {
      // Reset failure count on successful operation
      this.circuitBreaker.failureCount = Math.max(
        0,
        this.circuitBreaker.failureCount - 1
      );
    }
  }

  /**
   * Check if circuit breaker allows connection attempt
   */
  private canAttemptConnection(): boolean {
    if (this.circuitBreaker.state === "closed") {
      return true;
    }

    if (this.circuitBreaker.state === "open") {
      if (Date.now() >= this.circuitBreaker.nextAttemptTime) {
        this.circuitBreaker.state = "half-open";
        return true;
      }
      return false;
    }

    // half-open state - allow single attempt
    return this.circuitBreaker.state === "half-open";
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    // Simple moving average for latency
    const alpha = 0.1;
    this.metrics.averageLatency =
      this.metrics.averageLatency === 0
        ? latency
        : this.metrics.averageLatency * (1 - alpha) + latency * alpha;
  }

  /**
   * Send message with queuing support during disconnection
   */
  sendWithQueue(
    data: any,
    priority: "high" | "normal" | "low" = "normal"
  ): void {
    const message: QueuedMessage = {
      data,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
    };

    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        this.metrics.messagesSent++;
      } catch (error) {
        this.logger.warn("Failed to send message, queuing for retry", {
          error: error instanceof Error ? error.message : String(error),
          queueLength: this.messageQueue.length,
        });
        this.messageQueue.push(message);
      }
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
      this.logger.debug("Message queued due to disconnection", {
        queueLength: this.messageQueue.length,
        priority,
      });
    }
  }

  /**
   * Process queued messages when connection is restored
   */
  private processQueuedMessages(): void {
    if (!this.isConnected || !this.ws || this.messageQueue.length === 0) {
      return;
    }

    // Sort by priority and timestamp
    this.messageQueue.sort((a, b) => {
      const priorityOrder: Record<string, number> = {
        high: 3,
        normal: 2,
        low: 1,
      };
      const priorityDiff =
        (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });

    const toProcess = [...this.messageQueue];
    this.messageQueue = [];

    this.logger.info("Processing queued messages", {
      messageCount: toProcess.length,
      connectionId: this.connectionId,
    });

    for (const message of toProcess) {
      try {
        // Check if message is still valid (not too old)
        const messageAge = Date.now() - message.timestamp;
        if (messageAge > 300000) {
          // 5 minutes
          this.logger.warn("Discarding old queued message", {
            messageAge,
            priority: message.priority,
          });
          continue;
        }

        this.ws.send(JSON.stringify(message.data));
        this.metrics.messagesSent++;
      } catch (error) {
        this.logger.error("Failed to send queued message", {
          error: error instanceof Error ? error.message : String(error),
          priority: message.priority,
        });

        // Re-queue with retry limit
        if (message.retryCount < 3) {
          message.retryCount++;
          this.messageQueue.push(message);
        }
      }
    }
  }

  /**
   * Get comprehensive connection metrics
   */
  getMetrics(): ConnectionMetrics & {
    circuitBreaker: CircuitBreakerState;
    queueLength: number;
    uptime: number;
  } {
    return {
      ...this.metrics,
      circuitBreaker: { ...this.circuitBreaker },
      queueLength: this.messageQueue.length,
      uptime:
        this.metrics.connectTime > 0
          ? Date.now() - this.metrics.connectTime
          : 0,
    };
  }

  /**
   * Enhanced connect method with circuit breaker and adaptive reconnection
   */
  async connectWithRetry(): Promise<void> {
    if (!this.canAttemptConnection()) {
      const waitTime = this.circuitBreaker.nextAttemptTime - Date.now();
      throw new Error(`Circuit breaker open, next attempt in ${waitTime}ms`);
    }

    try {
      await this.connect();

      // Update metrics on successful connection
      this.metrics.connectTime = Date.now();
      this.metrics.lastPong = Date.now();
      this.metrics.reconnectCount = this.reconnectAttempts;

      this.updateCircuitBreakerOnSuccess();
      this.processQueuedMessages();

      this.emit("connected", {
        connectionId: this.connectionId,
        reconnectAttempts: this.reconnectAttempts,
        metrics: this.getMetrics(),
      });
    } catch (error) {
      this.metrics.errorCount++;
      this.updateCircuitBreakerOnFailure();
      throw error;
    }
  }

  /**
   * Enhanced reconnection with adaptive delays
   */
  private scheduleAdaptiveReconnect(): void {
    if (!this.adaptiveReconnection) {
      this.scheduleReconnect();
      return;
    }

    this.reconnectAttempts++;

    // Adaptive delay based on connection quality and failure patterns
    let baseDelay = this.reconnectDelay;

    // Increase delay for poor connection quality
    if (this.metrics.connectionQuality === "poor") {
      baseDelay *= 1.5;
    } else if (this.metrics.connectionQuality === "critical") {
      baseDelay *= 2;
    }

    // Add exponential backoff with jitter
    const exponentialDelay = Math.min(
      baseDelay * 2 ** (this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    const jitter = Math.random() * 1000;
    const finalDelay = exponentialDelay + jitter;

    this.logger.info("Scheduling adaptive reconnection", {
      attempt: this.reconnectAttempts,
      baseDelay,
      finalDelay: Math.round(finalDelay),
      connectionQuality: this.metrics.connectionQuality,
      circuitBreakerState: this.circuitBreaker.state,
    });

    setTimeout(() => {
      this.connectWithRetry().catch((error) => {
        this.logger.error("Adaptive reconnection failed", {
          error: error instanceof Error ? error.message : String(error),
          attempt: this.reconnectAttempts,
        });

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleAdaptiveReconnect();
        } else {
          this.emit("max-reconnects-reached", {
            maxAttempts: this.maxReconnectAttempts,
            metrics: this.getMetrics(),
          });
        }
      });
    }, finalDelay);
  }

  /**
   * Destroy the connection manager and clean up resources
   */
  destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.logger.info("Destroying connection manager", {
      connectionId: this.connectionId,
    });

    this.disconnect();
    this.stopHeartbeat();
    this.messageQueue = [];
    this.removeAllListeners();

    this.emit("destroyed", {
      connectionId: this.connectionId,
      finalMetrics: this.getMetrics(),
    });
  }

  /**
   * Check if connection manager is destroyed
   */
  getIsDestroyed(): boolean {
    return this.isDestroyed;
  }
}
