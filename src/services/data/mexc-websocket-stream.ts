/**
 * MEXC WebSocket Stream Service (Facade)
 *
 * Lightweight facade providing backward compatibility
 * while using the new modular WebSocket services architecture
 */

import { EventEmitter } from "node:events";
import type {
  NotificationMessage,
  TradingPriceMessage,
  TradingSignalMessage,
} from "@/src/lib/websocket-types";
import { mexcWebSocketStream as streamProcessor } from "./websocket/stream-processor";

// Re-export types for backward compatibility
export type { NotificationMessage, TradingPriceMessage, TradingSignalMessage };

/**
 * MEXC WebSocket Stream Service - Facade Pattern
 *
 * Provides a unified interface to the modular WebSocket services
 * while maintaining backward compatibility with existing code
 */
export class MexcWebSocketStreamService extends EventEmitter {
  private static instance: MexcWebSocketStreamService;

  private constructor() {
    super();
    this.setupEventForwarding();
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
  async initialize(config?: {
    mexcWsUrl?: string;
    subscriptions?: string[];
    enableReconnection?: boolean;
  }): Promise<void> {
    return streamProcessor.initialize(config);
  }

  /**
   * Start the WebSocket stream
   */
  async start(): Promise<void> {
    return streamProcessor.start();
  }

  /**
   * Stop the WebSocket stream
   */
  stop(): void {
    streamProcessor.stop();
  }

  /**
   * Subscribe to specific data streams
   */
  async subscribeToStreams(streams: string[]): Promise<void> {
    return streamProcessor.subscribeToStreams(streams);
  }

  /**
   * Get service status
   */
  getStatus() {
    return streamProcessor.getStatus();
  }

  /**
   * Get specific symbol data
   */
  getSymbolData(symbol: string) {
    return streamProcessor.getSymbolData(symbol);
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    streamProcessor.clearCache();
  }

  /**
   * Check if WebSocket is connected
   * @deprecated Use getStatus().connected instead
   */
  get isConnected(): boolean {
    return streamProcessor.getStatus().connected;
  }

  /**
   * Get connection status
   * @deprecated Use getStatus() instead
   */
  getConnectionStatus() {
    const status = streamProcessor.getStatus();
    return {
      connected: status.connected,
      connecting: false, // Derived from status
      subscriptions: status.subscriptions,
      lastMessage: status.messageStats.lastMessage,
    };
  }

  /**
   * Health check
   * @deprecated Use getStatus() instead
   */
  healthCheck() {
    const status = streamProcessor.getStatus();
    return {
      healthy: status.connected && status.initialized,
      connection: status.connected,
      messageStats: status.messageStats,
      cacheStats: status.cacheStats,
    };
  }

  /**
   * Subscribe to symbol list
   * @deprecated Use subscribeToStreams instead
   */
  async subscribeToSymbolList(symbols: string[]): Promise<void> {
    const streams = symbols.map((symbol) => `${symbol}@ticker`);
    return this.subscribeToStreams(streams);
  }

  /**
   * Setup event forwarding from stream processor to this facade
   */
  private setupEventForwarding(): void {
    // Forward all events from stream processor
    streamProcessor.on("stream_started", () => this.emit("stream_started"));
    streamProcessor.on("stream_stopped", () => this.emit("stream_stopped"));
    streamProcessor.on("price_update", (price: TradingPriceMessage) =>
      this.emit("price_update", price)
    );
    streamProcessor.on("depth_update", (depth: any) =>
      this.emit("depth_update", depth)
    );
    streamProcessor.on("status_update", (status: any) =>
      this.emit("status_update", status)
    );
    streamProcessor.on("trading_signal", (signal: TradingSignalMessage) =>
      this.emit("trading_signal", signal)
    );
    streamProcessor.on("notification", (notification: NotificationMessage) =>
      this.emit("notification", notification)
    );
    streamProcessor.on("trade", (trade: any) => this.emit("trade", trade));
    streamProcessor.on("error", (error: Error) => this.emit("error", error));
  }
}

// Export singleton instance for backward compatibility
export const mexcWebSocketStream = MexcWebSocketStreamService.getInstance();
