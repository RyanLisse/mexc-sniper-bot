/**
 * Stream Processor
 *
 * Main WebSocket service coordination and message processing
 * Extracted from mexc-websocket-stream.ts for modularity
 */

import { EventEmitter } from "node:events";
import type {
  NotificationMessage,
  TradingPriceMessage,
  TradingSignalMessage,
} from "@/src/lib/websocket-types";
import { webSocketServer } from "../websocket-server";
import {
  type ConnectionManagerOptions,
  MexcConnectionManager,
} from "./connection-manager";
import { MarketDataManager } from "./market-data-manager";

// ======================
// Stream Configuration
// ======================

interface StreamConfig {
  mexcWsUrl?: string;
  subscriptions?: string[];
  enableReconnection?: boolean;
  connectionOptions?: Partial<ConnectionManagerOptions>;
}

interface MessageStats {
  received: number;
  processed: number;
  errors: number;
  lastMessage: number;
}

// ======================
// Stream Processor
// ======================

export class MexcWebSocketStreamService extends EventEmitter {
  private static instance: MexcWebSocketStreamService;

  private logger = {
    info: (message: string, context?: any) =>
      console.info("[stream-processor]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[stream-processor]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[stream-processor]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[stream-processor]", message, context || ""),
  };

  // Service components
  private connectionManager?: MexcConnectionManager;
  private marketDataManager: MarketDataManager;

  // Configuration
  private config: StreamConfig = {
    mexcWsUrl: process.env.MEXC_WS_URL || "wss://wbs.mexc.com/ws",
    subscriptions: ["ticker", "depth", "trade"],
    enableReconnection: true,
  };

  // State management
  private isInitialized = false;
  private activeSubscriptions = new Set<string>();
  private messageStats: MessageStats = {
    received: 0,
    processed: 0,
    errors: 0,
    lastMessage: 0,
  };

  private constructor() {
    super();
    this.marketDataManager = MarketDataManager.getInstance();
    this.setupEventHandlers();
  }

  static getInstance(): MexcWebSocketStreamService {
    if (!MexcWebSocketStreamService.instance) {
      MexcWebSocketStreamService.instance = new MexcWebSocketStreamService();
    }
    return MexcWebSocketStreamService.instance;
  }

  /**
   * Initialize the stream service
   */
  async initialize(config?: StreamConfig): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn("Stream service already initialized");
      return;
    }

    // Merge configuration
    this.config = { ...this.config, ...config };

    this.logger.info("Initializing MEXC WebSocket stream service", {
      wsUrl: this.config.mexcWsUrl,
      subscriptions: this.config.subscriptions,
    });

    // Create connection manager
    const connectionOptions: ConnectionManagerOptions = {
      url: this.config.mexcWsUrl!,
      maxReconnectAttempts: 10,
      initialReconnectDelay: 1000,
      maxReconnectDelay: 30000,
      heartbeatInterval: 30000,
      ...this.config.connectionOptions,
    };

    this.connectionManager = new MexcConnectionManager(
      connectionOptions,
      (data) => this.handleWebSocketMessage(data),
      (error) => this.handleWebSocketError(error)
    );

    // Setup market data event handlers
    this.marketDataManager.setEventHandlers({
      onPriceUpdate: (price) => this.handlePriceUpdate(price),
      onDepthUpdate: (depth) => this.handleDepthUpdate(depth),
      onStatusUpdate: (status) => this.handleStatusUpdate(status),
      onNotification: (notification) => this.handleNotification(notification),
    });

    this.isInitialized = true;
    this.logger.info("Stream service initialized successfully");
  }

  /**
   * Start the WebSocket stream
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Stream service not initialized");
    }

    if (!this.connectionManager) {
      throw new Error("Connection manager not available");
    }

    this.logger.info("Starting MEXC WebSocket stream");

    try {
      await this.connectionManager.connect();

      // Subscribe to configured data streams
      if (this.config.subscriptions) {
        await this.subscribeToStreams(this.config.subscriptions);
      }

      this.emit("stream_started");
      this.logger.info("MEXC WebSocket stream started successfully");
    } catch (error) {
      this.logger.error("Failed to start WebSocket stream", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the WebSocket stream
   */
  stop(): void {
    this.logger.info("Stopping MEXC WebSocket stream");

    if (this.connectionManager) {
      this.connectionManager.disconnect();
    }

    this.activeSubscriptions.clear();
    this.emit("stream_stopped");
    this.logger.info("MEXC WebSocket stream stopped");
  }

  /**
   * Subscribe to specific data streams
   */
  async subscribeToStreams(streams: string[]): Promise<void> {
    if (!this.connectionManager) {
      throw new Error("Connection manager not available");
    }

    for (const stream of streams) {
      try {
        // Send subscription message based on stream type
        const subscriptionMessage = this.createSubscriptionMessage(stream);
        this.connectionManager.send(subscriptionMessage);
        this.activeSubscriptions.add(stream);

        this.logger.debug("Subscribed to stream", { stream });
      } catch (error) {
        this.logger.error("Failed to subscribe to stream", {
          stream,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info("Stream subscriptions completed", {
      subscribed: Array.from(this.activeSubscriptions),
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(data: any): void {
    this.messageStats.received++;
    this.messageStats.lastMessage = Date.now();

    try {
      // Process different message types
      if (data.stream && data.data) {
        this.processStreamMessage(data.stream, data.data);
      } else if (data.result) {
        this.processResponseMessage(data);
      } else if (data.error) {
        this.processErrorMessage(data);
      } else {
        this.logger.debug("Unknown message format", { data });
      }

      this.messageStats.processed++;
    } catch (error) {
      this.messageStats.errors++;
      this.logger.error("Failed to process WebSocket message", {
        error: error instanceof Error ? error.message : String(error),
        data,
      });
    }
  }

  /**
   * Process stream data messages
   */
  private processStreamMessage(stream: string, data: any): void {
    try {
      if (stream.includes("@ticker")) {
        // Price ticker data
        this.marketDataManager.updatePrice(data);
      } else if (stream.includes("@depth")) {
        // Order book depth data
        this.marketDataManager.updateDepth(data);
      } else if (stream.includes("@trade")) {
        // Trade execution data
        this.handleTradeData(data);
      } else if (stream.includes("@status")) {
        // Symbol status data for pattern detection
        this.marketDataManager.updateSymbolStatus(data);
      }
    } catch (error) {
      this.logger.error("Failed to process stream message", {
        stream,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process response messages
   */
  private processResponseMessage(data: any): void {
    this.logger.debug("Received WebSocket response", {
      id: data.id,
      result: data.result,
    });
  }

  /**
   * Process error messages
   */
  private processErrorMessage(data: any): void {
    this.logger.error("Received WebSocket error", {
      id: data.id,
      error: data.error,
    });
  }

  /**
   * Handle trade execution data
   */
  private handleTradeData(data: any): void {
    // Process individual trade data
    const tradeInfo = {
      symbol: data.s,
      price: parseFloat(data.p),
      quantity: parseFloat(data.q),
      timestamp: data.T,
      side: data.m ? "sell" : "buy", // m indicates market maker
    };

    this.emit("trade", tradeInfo);
    this.logger.debug("Trade data processed", tradeInfo);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle price updates
    this.on("price_update", async (price: TradingPriceMessage) => {
      // Broadcast to WebSocket server
      await webSocketServer.broadcast({
        type: "trading:price",
        channel: "trading:prices",
        data: price,
      });
    });

    // Handle trading signals
    this.on("trading_signal", async (signal: TradingSignalMessage) => {
      // Broadcast to WebSocket server
      await webSocketServer.broadcast({
        type: "trading:signal",
        channel: "trading:signals",
        data: signal,
      });
    });

    // Handle notifications
    this.on("notification", async (notification: NotificationMessage) => {
      // Broadcast to WebSocket server
      await webSocketServer.broadcast({
        type: "notification:info",
        channel: "notifications:global",
        data: notification,
      });
    });
  }

  /**
   * Handle price updates from market data manager
   */
  private handlePriceUpdate(price: TradingPriceMessage): void {
    this.emit("price_update", price);
  }

  /**
   * Handle depth updates from market data manager
   */
  private handleDepthUpdate(depth: any): void {
    this.emit("depth_update", depth);
  }

  /**
   * Handle status updates from market data manager
   */
  private handleStatusUpdate(status: any): void {
    this.emit("status_update", status);
  }

  /**
   * Handle notifications from market data manager
   */
  private handleNotification(notification: NotificationMessage): void {
    this.emit("notification", notification);
  }

  /**
   * Handle WebSocket errors
   */
  private handleWebSocketError(error: Error): void {
    this.logger.error("WebSocket error occurred", {
      error: error.message,
    });
    this.emit("error", error);
  }

  /**
   * Create subscription message for specific stream
   */
  private createSubscriptionMessage(stream: string): any {
    // Create MEXC-specific subscription format
    const subscriptionId = Date.now();

    return {
      id: subscriptionId,
      method: "SUBSCRIPTION",
      params: [stream],
    };
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    connected: boolean;
    subscriptions: string[];
    messageStats: MessageStats;
    cacheStats: any;
  } {
    return {
      initialized: this.isInitialized,
      connected: this.connectionManager?.getStatus().connected || false,
      subscriptions: Array.from(this.activeSubscriptions),
      messageStats: { ...this.messageStats },
      cacheStats: this.marketDataManager.getCacheStats(),
    };
  }

  /**
   * Get specific symbol data
   */
  getSymbolData(symbol: string): {
    price?: TradingPriceMessage;
    depth?: any;
    status?: any;
  } {
    return {
      price: this.marketDataManager.getPrice(symbol),
      depth: this.marketDataManager.getDepth(symbol),
      status: this.marketDataManager.getStatus(symbol),
    };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.marketDataManager.clearCaches();
    this.messageStats = {
      received: 0,
      processed: 0,
      errors: 0,
      lastMessage: 0,
    };
    this.logger.info("Stream service cache cleared");
  }
}

// Export singleton instance
export const mexcWebSocketStream = MexcWebSocketStreamService.getInstance();
