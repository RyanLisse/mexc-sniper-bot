/**
 * WebSocket Client Service
 *
 * Client-side WebSocket management for real-time communication.
 * Handles connection management, authentication, and message routing.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Authentication integration
 * - Channel subscription management
 * - Message queuing during disconnection
 * - Performance monitoring
 * - TypeScript type safety
 */

import { EventEmitter } from "events";
import type {
  AgentStatusMessage,
  MessageHandler,
  NotificationMessage,
  PatternDiscoveryMessage,
  SubscriptionRequest,
  TradingPriceMessage,
  WebSocketChannel,
  WebSocketClientConfig,
  WebSocketMessage,
} from "../lib/websocket-types";

// ======================
// Message Queue
// ======================

interface QueuedMessage {
  message: WebSocketMessage;
  retryCount: number;
  timestamp: number;
}

class MessageQueue {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[websocket-client]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[websocket-client]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[websocket-client]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[websocket-client]", message, context || ""),
  };

  private queue: QueuedMessage[] = [];
  private readonly maxSize: number;
  private readonly maxRetries: number;

  constructor(maxSize = 1000, maxRetries = 3) {
    this.maxSize = maxSize;
    this.maxRetries = maxRetries;
  }

  enqueue(message: WebSocketMessage): void {
    // Remove oldest messages if queue is full
    if (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }

    this.queue.push({
      message,
      retryCount: 0,
      timestamp: Date.now(),
    });
  }

  dequeue(): QueuedMessage | undefined {
    return this.queue.shift();
  }

  requeue(queuedMessage: QueuedMessage): void {
    if (queuedMessage.retryCount < this.maxRetries) {
      queuedMessage.retryCount++;
      this.queue.unshift(queuedMessage);
    }
  }

  clear(): void {
    this.queue = [];
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}

// ======================
// Subscription Manager
// ======================

class SubscriptionManager {
  private subscriptions = new Map<
    string,
    {
      filters?: Record<string, any>;
      handlers: Set<MessageHandler>;
      options?: SubscriptionRequest["options"];
    }
  >();

  subscribe(channel: string, handler: MessageHandler, request?: SubscriptionRequest): void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, {
        filters: request?.filters,
        handlers: new Set(),
        options: request?.options,
      });
    }

    const subscription = this.subscriptions.get(channel)!;
    subscription.handlers.add(handler);
  }

  unsubscribe(channel: string, handler?: MessageHandler): void {
    const subscription = this.subscriptions.get(channel);
    if (!subscription) return;

    if (handler) {
      subscription.handlers.delete(handler);
      if (subscription.handlers.size === 0) {
        this.subscriptions.delete(channel);
      }
    } else {
      this.subscriptions.delete(channel);
    }
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getHandlers(channel: string): MessageHandler[] {
    const subscription = this.subscriptions.get(channel);
    return subscription ? Array.from(subscription.handlers) : [];
  }

  hasSubscription(channel: string): boolean {
    return this.subscriptions.has(channel);
  }

  clear(): void {
    this.subscriptions.clear();
  }

  getSubscriptionInfo(channel: string) {
    return this.subscriptions.get(channel);
  }
}

// ======================
// Connection Manager
// ======================

class ConnectionManager {
  private reconnectAttempts = 0;
  private reconnectDelay = 1000;
  private reconnectTimeout?: NodeJS.Timeout;
  private readonly maxReconnectAttempts: number;
  private readonly maxReconnectDelay: number;

  constructor(maxAttempts = 10, maxDelay = 30000) {
    this.maxReconnectAttempts = maxAttempts;
    this.maxReconnectDelay = maxDelay;
  }

  shouldReconnect(): boolean {
    return this.reconnectAttempts < this.maxReconnectAttempts;
  }

  getReconnectDelay(): number {
    return Math.min(this.reconnectDelay, this.maxReconnectDelay);
  }

  scheduleReconnect(callback: () => void): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = this.getReconnectDelay();
    console.info(
      `[WebSocket Client] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      callback();
    }, delay);
  }

  cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
  }

  resetReconnect(): void {
    this.cancelReconnect();
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }

  getReconnectInfo() {
    return {
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay: this.reconnectDelay,
      maxDelay: this.maxReconnectDelay,
      isScheduled: !!this.reconnectTimeout,
    };
  }
}

// ======================
// Main WebSocket Client
// ======================

export type WebSocketClientState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface WebSocketClientMetrics {
  connectionId?: string;
  state: WebSocketClientState;
  connectedAt?: number;
  disconnectedAt?: number;
  messagesSent: number;
  messagesReceived: number;
  queuedMessages: number;
  subscriptions: number;
  reconnectInfo: any;
  latency?: number;
  lastActivity?: number;
}

export class WebSocketClientService extends EventEmitter {
  private static instance: WebSocketClientService;
  private ws: WebSocket | null = null;
  private config: WebSocketClientConfig;
  private state: WebSocketClientState = "disconnected";
  private connectionId?: string;
  private subscriptionManager = new SubscriptionManager();
  private messageQueue = new MessageQueue();
  private connectionManager = new ConnectionManager();
  private heartbeatInterval?: NodeJS.Timeout;
  private metrics: WebSocketClientMetrics;
  private authToken?: string;

  constructor(config: Partial<WebSocketClientConfig> = {}) {
    super();

    this.config = {
      url: "ws://localhost:8080/ws",
      authentication: {
        token: "",
        autoRefresh: true,
      },
      reconnection: {
        enabled: true,
        maxAttempts: 10,
        delay: 1000,
        maxDelay: 30000,
      },
      performance: {
        heartbeatEnabled: true,
        compressionEnabled: true,
        bufferSize: 1000,
      },
      debug: false,
      ...config,
    };

    this.metrics = {
      state: "disconnected",
      messagesSent: 0,
      messagesReceived: 0,
      queuedMessages: 0,
      subscriptions: 0,
      reconnectInfo: this.connectionManager.getReconnectInfo(),
    };

    if (this.config.authentication?.token) {
      this.authToken = this.config.authentication.token;
    }
  }

  static getInstance(config?: Partial<WebSocketClientConfig>): WebSocketClientService {
    if (!WebSocketClientService.instance) {
      WebSocketClientService.instance = new WebSocketClientService(config);
    }
    return WebSocketClientService.instance;
  }

  // ======================
  // Connection Management
  // ======================

  async connect(authToken?: string): Promise<void> {
    if (this.state === "connecting" || this.state === "connected") {
      return;
    }

    if (authToken) {
      this.authToken = authToken;
    }

    this.setState("connecting");

    try {
      const url = this.buildWebSocketUrl();

      if (this.config.debug) {
        console.info("[WebSocket Client] Connecting to:", url);
      }

      this.ws = new WebSocket(url);
      this.setupEventHandlers();

      // Wait for connection to open or fail
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };

        this.ws!.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    } catch (error) {
      console.error("[WebSocket Client] Connection failed:", error);
      this.setState("error");
      this.handleConnectionError(error);
      throw error;
    }
  }

  disconnect(): void {
    this.connectionManager.cancelReconnect();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.setState("disconnected");
    this.metrics.disconnectedAt = Date.now();
    this.emit("disconnected");
  }

  reconnect(): void {
    if (this.state === "connecting" || this.state === "reconnecting") {
      return;
    }

    this.setState("reconnecting");
    this.disconnect();

    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  // ======================
  // Message Handling
  // ======================

  send<T>(message: Omit<WebSocketMessage<T>, "messageId" | "timestamp">): boolean {
    const fullMessage: WebSocketMessage<T> = {
      ...message,
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    if (this.state === "connected" && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(fullMessage));
        this.metrics.messagesSent++;
        this.updateActivity();

        if (this.config.debug) {
          console.info("[WebSocket Client] Message sent:", fullMessage);
        }

        return true;
      } catch (error) {
        console.error("[WebSocket Client] Failed to send message:", error);
        this.messageQueue.enqueue(fullMessage);
        this.metrics.queuedMessages = this.messageQueue.size();
        return false;
      }
    } else {
      // Queue message for later
      this.messageQueue.enqueue(fullMessage);
      this.metrics.queuedMessages = this.messageQueue.size();
      return false;
    }
  }

  // ======================
  // Subscription Management
  // ======================

  subscribe(
    channel: WebSocketChannel,
    handler: MessageHandler,
    request?: SubscriptionRequest
  ): () => void {
    this.subscriptionManager.subscribe(channel, handler, request);
    this.metrics.subscriptions = this.subscriptionManager.getSubscriptions().length;

    // Send subscription request to server
    this.send({
      type: "subscription:subscribe",
      channel: "system",
      data: { channel, ...request },
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, handler);
    };
  }

  unsubscribe(channel: WebSocketChannel, handler?: MessageHandler): void {
    this.subscriptionManager.unsubscribe(channel, handler);
    this.metrics.subscriptions = this.subscriptionManager.getSubscriptions().length;

    // Send unsubscription request to server
    this.send({
      type: "subscription:unsubscribe",
      channel: "system",
      data: { channel },
    });
  }

  // ======================
  // Convenience Methods for Specific Message Types
  // ======================

  subscribeToAgentStatus(handler: MessageHandler<AgentStatusMessage>): () => void {
    return this.subscribe("agents:status", handler);
  }

  subscribeToAgentHealth(handler: MessageHandler): () => void {
    return this.subscribe("agents:health", handler);
  }

  subscribeToTradingPrices(handler: MessageHandler<TradingPriceMessage>): () => void {
    return this.subscribe("trading:prices", handler);
  }

  subscribeToSymbolPrice(symbol: string, handler: MessageHandler<TradingPriceMessage>): () => void {
    return this.subscribe(`trading:${symbol}:price`, handler);
  }

  subscribeToPatternDiscovery(handler: MessageHandler<PatternDiscoveryMessage>): () => void {
    return this.subscribe("patterns:discovery", handler);
  }

  subscribeToPatternReadyState(handler: MessageHandler): () => void {
    return this.subscribe("patterns:ready_state", handler);
  }

  subscribeToNotifications(handler: MessageHandler<NotificationMessage>): () => void {
    return this.subscribe("notifications:global", handler);
  }

  subscribeToUserNotifications(
    userId: string,
    handler: MessageHandler<NotificationMessage>
  ): () => void {
    return this.subscribe(`user:${userId}:notifications`, handler);
  }

  subscribeToWorkflows(handler: MessageHandler): () => void {
    return this.subscribe("agents:workflows", handler);
  }

  // ======================
  // Private Methods
  // ======================

  private buildWebSocketUrl(): string {
    const url = new URL(this.config.url);

    if (this.authToken) {
      url.searchParams.set("token", this.authToken);
    }

    return url.toString();
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleError.bind(this);
  }

  private handleOpen(): void {
    console.info("[WebSocket Client] Connected to server");

    this.setState("connected");
    this.connectionManager.resetReconnect();
    this.metrics.connectedAt = Date.now();
    this.metrics.reconnectInfo = this.connectionManager.getReconnectInfo();

    this.startHeartbeat();
    this.processMessageQueue();
    this.resubscribeAll();

    this.emit("connected");
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      this.metrics.messagesReceived++;
      this.updateActivity();

      if (this.config.debug) {
        console.info("[WebSocket Client] Message received:", message);
      }

      // Handle system messages
      if (message.type === "system:connect") {
        this.connectionId = message.data.connectionId;
        this.metrics.connectionId = this.connectionId;
      }

      // Route message to handlers
      this.routeMessage(message);

      this.emit("message", message);
    } catch (error) {
      console.error("[WebSocket Client] Failed to handle message:", error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.info(`[WebSocket Client] Connection closed: ${event.code} - ${event.reason}`);

    this.stopHeartbeat();
    this.setState("disconnected");
    this.metrics.disconnectedAt = Date.now();
    this.ws = null;

    this.emit("disconnected", { code: event.code, reason: event.reason });

    // Attempt reconnection if enabled and not a normal closure
    if (
      this.config.reconnection.enabled &&
      event.code !== 1000 &&
      this.connectionManager.shouldReconnect()
    ) {
      this.setState("reconnecting");
      this.connectionManager.scheduleReconnect(() => {
        this.connect();
      });
    }
  }

  private handleError(event: Event): void {
    console.error("[WebSocket Client] Connection error:", event);
    this.emit("error", event);
  }

  private handleConnectionError(_error: any): void {
    if (this.config.reconnection.enabled && this.connectionManager.shouldReconnect()) {
      this.setState("reconnecting");
      this.connectionManager.scheduleReconnect(() => {
        this.connect();
      });
    }
  }

  private routeMessage(message: WebSocketMessage): void {
    const handlers = this.subscriptionManager.getHandlers(message.channel);

    for (const handler of handlers) {
      try {
        handler(message);
      } catch (error) {
        console.error("[WebSocket Client] Handler error:", error);
      }
    }
  }

  private processMessageQueue(): void {
    while (!this.messageQueue.isEmpty()) {
      const queuedMessage = this.messageQueue.dequeue();
      if (!queuedMessage) break;

      const success = this.send(queuedMessage.message);
      if (!success) {
        this.messageQueue.requeue(queuedMessage);
        break;
      }
    }

    this.metrics.queuedMessages = this.messageQueue.size();
  }

  private resubscribeAll(): void {
    const subscriptions = this.subscriptionManager.getSubscriptions();

    for (const channel of subscriptions) {
      const info = this.subscriptionManager.getSubscriptionInfo(channel);
      this.send({
        type: "subscription:subscribe",
        channel: "system",
        data: {
          channel,
          filters: info?.filters,
          options: info?.options,
        },
      });
    }
  }

  private startHeartbeat(): void {
    if (!this.config.performance.heartbeatEnabled) return;

    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: "system:heartbeat",
        channel: "system",
        data: { timestamp: Date.now() },
      });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private setState(newState: WebSocketClientState): void {
    const oldState = this.state;
    this.state = newState;
    this.metrics.state = newState;

    if (oldState !== newState) {
      this.emit("stateChange", { oldState, newState });
    }
  }

  private updateActivity(): void {
    this.metrics.lastActivity = Date.now();
  }

  // ======================
  // Public API
  // ======================

  getState(): WebSocketClientState {
    return this.state;
  }

  getMetrics(): WebSocketClientMetrics {
    return {
      ...this.metrics,
      queuedMessages: this.messageQueue.size(),
      subscriptions: this.subscriptionManager.getSubscriptions().length,
      reconnectInfo: this.connectionManager.getReconnectInfo(),
    };
  }

  isConnected(): boolean {
    return this.state === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionId(): string | undefined {
    return this.connectionId;
  }

  getSubscriptions(): string[] {
    return this.subscriptionManager.getSubscriptions();
  }

  setAuthToken(token: string): void {
    this.authToken = token;
    if (this.config.authentication) {
      this.config.authentication.token = token;
    }
  }

  clearMessageQueue(): void {
    this.messageQueue.clear();
    this.metrics.queuedMessages = 0;
  }
}

// Export singleton instance
export const webSocketClient = WebSocketClientService.getInstance();
