/**
 * WebSocket Connection Manager
 *
 * Handles WebSocket connection lifecycle, reconnection logic, and heartbeat
 * Extracted from mexc-websocket-stream.ts for modularity
 */

import WebSocket from "ws";

export interface ConnectionManagerOptions {
  url: string;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
}

export class MexcConnectionManager {
  private ws: WebSocket | null = null;
  private connectionId?: string;
  private reconnectAttempts = 0;
  private reconnectDelay: number;
  private heartbeatInterval?: NodeJS.Timeout;
  private isConnecting = false;
  private isConnected = false;

  private readonly url: string;
  private readonly maxReconnectAttempts: number;
  private readonly maxReconnectDelay: number;
  private readonly heartbeatIntervalMs: number;
  private readonly onMessage: (data: any) => void;
  private readonly onError: (error: Error) => void;

  private logger = {
    info: (message: string, context?: any) =>
      console.info("[connection-manager]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[connection-manager]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[connection-manager]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[connection-manager]", message, context || ""),
  };

  constructor(
    options: ConnectionManagerOptions,
    onMessage: (data: any) => void,
    onError: (error: Error) => void
  ) {
    this.url = options.url;
    this.onMessage = onMessage;
    this.onError = onError;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.initialReconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.heartbeatIntervalMs = options.heartbeatInterval || 30000;
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

      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => this.handleOpen());
      this.ws.on("message", (data) => this.handleMessage(data));
      this.ws.on("close", (code, reason) => this.handleClose(code, reason));
      this.ws.on("error", (error) => this.handleError(error));

      // Wait for connection to be established with proper error handling
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.cleanup();
          reject(new Error("WebSocket connection timeout"));
        }, 10000);

        const cleanup = () => {
          clearTimeout(timeout);
        };

        this.ws!.once("open", () => {
          cleanup();
          resolve();
        });

        this.ws!.once("error", (error) => {
          cleanup();
          this.cleanup();
          reject(error);
        });

        this.ws!.once("close", (code, reason) => {
          cleanup();
          this.cleanup();
          reject(new Error(`Connection closed during establishment: ${code} - ${reason}`));
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
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
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

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
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
    if (!this.isConnected || !this.ws) {
      throw new Error("WebSocket not connected");
    }

    this.ws.send(JSON.stringify(data));
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
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      this.onMessage(message);
    } catch (error) {
      this.logger.error("Failed to parse WebSocket message", {
        error: error instanceof Error ? error.message : String(error),
        dataLength: data.length,
      });
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: Buffer): void {
    this.isConnected = false;
    this.isConnecting = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

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
      this.scheduleReconnect();
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
      if (this.isConnected && this.ws) {
        try {
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
  }
}
