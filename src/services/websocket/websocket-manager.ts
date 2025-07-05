/**
 * WebSocket Manager
 *
 * Manages WebSocket connections for real-time market data
 */

import { z } from "zod";
import {
  BrowserCompatibleEventEmitter,
  type UniversalWebSocket,
} from "@/src/lib/browser-compatible-events";

// WebSocket connection state
export const ConnectionState = z.enum([
  "disconnected",
  "connecting",
  "connected",
  "reconnecting",
  "error",
]);

export type ConnectionStateType = z.infer<typeof ConnectionState>;

// WebSocket message schema
export const WebSocketMessageSchema = z.object({
  id: z.string().optional(),
  method: z.string(),
  params: z.record(z.any()).optional(),
  result: z.any().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// Subscription schema
export const SubscriptionSchema = z.object({
  id: z.string(),
  channel: z.string(),
  symbol: z.string().optional(),
  callback: z.function(),
  isActive: z.boolean().default(true),
});

export type Subscription = z.infer<typeof SubscriptionSchema>; /**
 * WebSocket Manager Class
 */
export class WebSocketManager extends BrowserCompatibleEventEmitter {
  private ws: InstanceType<typeof UniversalWebSocket> | null = null;
  private state: ConnectionStateType = "disconnected";
  private subscriptions = new Map<string, Subscription>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    if (this.state === "connected" || this.state === "connecting") {
      return;
    }

    this.setState("connecting");

    try {
      if (typeof WebSocket !== "undefined") {
        this.ws = new WebSocket(this.url);
      } else {
        // Node.js environment - mock WebSocket
        this.ws = this.createMockWebSocket();
      }

      this.setupEventListeners();
    } catch (error) {
      this.setState("error");
      this.emit("error", error);
      throw error;
    }
  } /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setState("connected");
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit("connected");
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (_error) {
        this.emit("error", new Error("Failed to parse message"));
      }
    };

    this.ws.onclose = () => {
      this.setState("disconnected");
      this.stopHeartbeat();
      this.emit("disconnected");
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      this.setState("error");
      this.emit("error", error);
    };
  } /**
   * Subscribe to a channel
   */
  subscribe(
    channel: string,
    callback: (data: WebSocketMessage) => void,
    symbol?: string
  ): string {
    const id = `${channel}_${symbol || "all"}_${Date.now()}`;

    const subscription: Subscription = {
      id,
      channel,
      symbol,
      callback,
      isActive: true,
    };

    this.subscriptions.set(id, subscription);

    if (this.state === "connected") {
      this.sendSubscription(subscription);
    }

    return id;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    subscription.isActive = false;
    this.subscriptions.delete(subscriptionId);

    if (this.state === "connected") {
      this.sendUnsubscription(subscription);
    }

    return true;
  } /**
   * Send subscription message
   */
  private sendSubscription(subscription: Subscription): void {
    const message = {
      method: "SUBSCRIBE",
      params: [subscription.channel],
      id: subscription.id,
    };
    this.send(message);
  }

  /**
   * Send unsubscription message
   */
  private sendUnsubscription(subscription: Subscription): void {
    const message = {
      method: "UNSUBSCRIBE",
      params: [subscription.channel],
      id: subscription.id,
    };
    this.send(message);
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: WebSocketMessage): void {
    // Handle different message types
    if (data.stream) {
      // Market data message
      this.handleMarketData(data);
    } else if (data.result !== undefined) {
      // Response to subscription/unsubscription
      this.handleSubscriptionResponse(data);
    } else if (data.error) {
      // Error message
      this.emit("error", new Error(data.error.message));
    }
  } /**
   * Handle market data messages
   */
  private handleMarketData(data: WebSocketMessage): void {
    for (const [, subscription] of this.subscriptions) {
      if (subscription.isActive && data.stream.includes(subscription.channel)) {
        subscription.callback(data.data);
      }
    }
  }

  /**
   * Create mock WebSocket for Node.js environment
   */
  private createMockWebSocket(): UniversalWebSocket {
    return {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: () => {},
      close: () => {},
    };
  }

  /**
   * Send message to WebSocket
   */
  private send(message: WebSocketMessage): void {
    if (this.ws && this.state === "connected") {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionStateType): void {
    this.state = state;
    this.emit("stateChange", state);
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionStateType {
    return this.state;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    this.setState("disconnected");
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ method: "PING" }));
        } catch (error) {
          console.error("Failed to send heartbeat:", error);
        }
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Resubscribe to all active subscriptions
   */
  private resubscribeAll(): void {
    for (const [id, subscription] of this.subscriptions) {
      if (
        subscription.isActive &&
        this.ws &&
        this.ws.readyState === WebSocket.OPEN
      ) {
        try {
          this.ws.send(
            JSON.stringify({
              method: "SUBSCRIPTION",
              params: [subscription.channel],
              id: id,
            })
          );
        } catch (error) {
          console.error(`Failed to resubscribe to ${id}:`, error);
        }
      }
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      // FIXED: Add NaN validation to prevent TimeoutNaNWarning
      const baseDelay =
        typeof this.reconnectDelay === "number" &&
        !Number.isNaN(this.reconnectDelay) &&
        Number.isFinite(this.reconnectDelay)
          ? this.reconnectDelay
          : 1000; // Default 1 second

      const exponent =
        typeof this.reconnectAttempts === "number" &&
        !Number.isNaN(this.reconnectAttempts) &&
        Number.isFinite(this.reconnectAttempts)
          ? Math.max(0, Math.min(this.reconnectAttempts - 1, 10)) // Cap exponent to prevent overflow
          : 0;

      const calculatedDelay = baseDelay * 2 ** exponent;

      // Ensure delay is a valid positive number with reasonable bounds
      const delay =
        typeof calculatedDelay === "number" &&
        !Number.isNaN(calculatedDelay) &&
        Number.isFinite(calculatedDelay) &&
        calculatedDelay > 0
          ? Math.min(calculatedDelay, 60000) // Cap at 60 seconds maximum
          : 1000; // Fallback to 1 second

      console.log(
        `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error("Max reconnection attempts reached");
      this.setState("error");
    }
  }

  /**
   * Handle subscription response
   */
  private handleSubscriptionResponse(data: WebSocketMessage): void {
    if (data.id && this.subscriptions.has(data.id)) {
      const subscription = this.subscriptions.get(data.id);
      if (subscription) {
        subscription.callback(data);
      }
    } else {
      // Broadcast to all subscriptions if no specific ID
      for (const subscription of this.subscriptions.values()) {
        if (subscription.isActive) {
          subscription.callback(data);
        }
      }
    }
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager("wss://wbs.mexc.com/ws");
