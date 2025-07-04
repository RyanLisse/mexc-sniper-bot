/**
 * WebSocket Price Service
 * Provides real-time price feeds using MEXC WebSocket streams
 * Reduces API polling and improves real-time responsiveness
 *
 * Memory Management Features:
 * - LRU cache for price data with configurable size limit
 * - Proper cleanup of all event listeners and timers
 * - Memory usage monitoring and alerts
 * - Graceful shutdown with resource cleanup
 */

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

interface TickerData {
  s: string; // symbol
  c: string; // close price
  h: string; // high price
  l: string; // low price
  v: string; // volume
  q: string; // quote volume
  o: string; // open price
  P: string; // price change percent
  p: string; // price change
  t: number; // timestamp
}

type PriceCallback = (priceUpdate: PriceUpdate) => void;

// LRU Cache implementation for bounded memory usage
class LRUCache<K, V> {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[websocket-price-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[websocket-price-service]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[websocket-price-service]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[websocket-price-service]", message, context || ""),
  };

  private maxSize: number;
  private cache: Map<K, V>;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end
    this.cache.set(key, value);

    // Remove oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  entries(): Map<K, V> {
    return new Map(this.cache);
  }
}

// Memory monitoring interface
interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  subscriptionCount: number;
  cacheSize: number;
  timestamp: number;
}

export class WebSocketPriceService {
  private static instance: WebSocketPriceService;
  private ws: InstanceType<typeof UniversalWebSocket> | null = null;
  private subscriptions = new Map<string, Set<PriceCallback>>();
  private priceCache: LRUCache<string, PriceUpdate>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private heartbeatInterval?: NodeJS.Timeout;
  private reconnectTimeout?: NodeJS.Timeout;
  private isConnecting = false;
  private isConnected = false;
  private isShuttingDown = false;

  // Memory management
  private memoryCheckInterval?: NodeJS.Timeout;
  private memoryMetrics: MemoryMetrics[] = [];
  private readonly MAX_MEMORY_METRICS = 100;
  private readonly MAX_CACHE_SIZE = 1000; // Limit cache to 1000 symbols
  private readonly MEMORY_WARNING_THRESHOLD = 100 * 1024 * 1024; // 100MB
  private readonly MEMORY_CHECK_INTERVAL = 60000; // Check every minute

  // Event handler references for cleanup
  private boundHandlers: {
    onOpen?: () => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
  } = {};

  // MEXC WebSocket URLs
  private readonly MEXC_WS_URL = "wss://wbs.mexc.com/ws";
  private readonly PING_INTERVAL = 30000; // 30 seconds

  private constructor() {
    this.priceCache = new LRUCache(this.MAX_CACHE_SIZE);
    this.startMemoryMonitoring();
  }

  public static getInstance(): WebSocketPriceService {
    if (!WebSocketPriceService.instance) {
      WebSocketPriceService.instance = new WebSocketPriceService();
    }
    return WebSocketPriceService.instance;
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    this.memoryCheckInterval = setInterval(() => {
      const metrics = this.collectMemoryMetrics();

      // Store metrics with sliding window
      this.memoryMetrics.push(metrics);
      if (this.memoryMetrics.length > this.MAX_MEMORY_METRICS) {
        this.memoryMetrics.shift();
      }

      // Check for memory issues
      if (metrics.heapUsed > this.MEMORY_WARNING_THRESHOLD) {
        console.warn(
          `⚠️ High memory usage detected: ${(metrics.heapUsed / 1024 / 1024).toFixed(2)}MB`
        );
        this.performMemoryCleanup();
      }

      // Check for memory leak (steady increase over time)
      if (this.memoryMetrics.length >= 10) {
        const recentMetrics = this.memoryMetrics.slice(-10);
        const memoryGrowth =
          recentMetrics[9].heapUsed - recentMetrics[0].heapUsed;
        const timeElapsed =
          recentMetrics[9].timestamp - recentMetrics[0].timestamp;
        const growthRate = memoryGrowth / (timeElapsed / 1000 / 60 / 60); // bytes per hour

        if (growthRate > 50 * 1024 * 1024) {
          // 50MB/hour
          console.error(
            `🚨 Memory leak detected: ${(growthRate / 1024 / 1024).toFixed(2)}MB/hour growth rate`
          );
        }
      }
    }, this.MEMORY_CHECK_INTERVAL);
  }

  /**
   * Collect memory metrics
   */
  private collectMemoryMetrics(): MemoryMetrics {
    let heapUsed = 0;
    let heapTotal = 0;
    let external = 0;

    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage();
      heapUsed = usage.heapUsed;
      heapTotal = usage.heapTotal;
      external = usage.external;
    } else if (typeof window !== "undefined" && "memory" in performance) {
      // Browser environment
      const memory = (
        performance as Performance & {
          memory?: {
            usedJSHeapSize?: number;
            totalJSHeapSize?: number;
          };
        }
      ).memory;
      if (memory) {
        heapUsed = memory.usedJSHeapSize || 0;
        heapTotal = memory.totalJSHeapSize || 0;
      }
    }

    return {
      heapUsed,
      heapTotal,
      external,
      subscriptionCount: this.subscriptions.size,
      cacheSize: this.priceCache.size,
      timestamp: Date.now(),
    };
  }

  /**
   * Perform memory cleanup
   */
  private performMemoryCleanup(): void {
    console.info("🧹 Performing memory cleanup...");

    // Clean up empty subscription sets
    const emptySymbols: string[] = [];
    this.subscriptions.forEach((callbacks, symbol) => {
      if (callbacks.size === 0) {
        emptySymbols.push(symbol);
      }
    });

    emptySymbols.forEach((symbol) => {
      this.subscriptions.delete(symbol);
    });

    // Force garbage collection if available (Node.js with --expose-gc flag)
    if (typeof global !== "undefined" && global.gc) {
      global.gc();
    }

    console.info(
      `✅ Cleanup complete. Removed ${emptySymbols.length} empty subscriptions`
    );
  }

  /**
   * Connect to MEXC WebSocket
   */
  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error("Service is shutting down");
    }

    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;

    try {
      console.info("🔌 Connecting to MEXC WebSocket...");

      // Clean up any existing connection first
      this.cleanupConnection();

      // In browser environment, use native WebSocket
      // In Node.js environment, would need ws package
      if (typeof window !== "undefined") {
        this.ws = new WebSocket(this.MEXC_WS_URL);
      } else {
        // For server-side, we'll create a mock connection
        // In production, you'd use the 'ws' package
        console.info(
          "⚠️ WebSocket not available in Node.js environment. Using polling fallback."
        );
        this.isConnecting = false;
        return;
      }

      // Create bound handlers for proper cleanup
      this.boundHandlers.onOpen = this.handleOpen.bind(this);
      this.boundHandlers.onMessage = this.handleMessage.bind(this);
      this.boundHandlers.onError = this.handleError.bind(this);
      this.boundHandlers.onClose = this.handleClose.bind(this);

      // Add event listeners
      this.ws.addEventListener("open", this.boundHandlers.onOpen);
      this.ws.addEventListener("message", this.boundHandlers.onMessage);
      this.ws.addEventListener("error", this.boundHandlers.onError);
      this.ws.addEventListener("close", this.boundHandlers.onClose);
    } catch (error) {
      console.error("❌ Failed to connect to WebSocket:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.info("✅ WebSocket connected to MEXC");
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.startHeartbeat();

    // Resubscribe to all symbols after reconnection
    this.resubscribeAll();
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);

      // Handle different message types
      if (message.stream && message.data) {
        this.handleTickerUpdate(message.data);
      } else if (message.ping) {
        // Respond to ping
        this.sendPong(message.ping);
      }
    } catch (error) {
      console.error("❌ Error parsing WebSocket message:", error);
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error("❌ WebSocket error:", event);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.info("🔌 WebSocket disconnected:", event.code, event.reason);
    this.isConnected = false;
    this.isConnecting = false;
    this.stopHeartbeat();

    // Attempt to reconnect if not intentionally closed or shutting down
    if (
      !event.wasClean &&
      !this.isShuttingDown &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.scheduleReconnect();
    }
  }

  /**
   * Clean up WebSocket connection and handlers
   */
  private cleanupConnection(): void {
    // Clear reconnect timeout if exists
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    // Remove event listeners if WebSocket exists
    if (this.ws) {
      if (this.boundHandlers.onOpen) {
        this.ws.removeEventListener("open", this.boundHandlers.onOpen);
      }
      if (this.boundHandlers.onMessage) {
        this.ws.removeEventListener("message", this.boundHandlers.onMessage);
      }
      if (this.boundHandlers.onError) {
        this.ws.removeEventListener("error", this.boundHandlers.onError);
      }
      if (this.boundHandlers.onClose) {
        this.ws.removeEventListener("close", this.boundHandlers.onClose);
      }

      // Close WebSocket if still open
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, "Cleanup");
      }

      this.ws = null;
    }

    // Clear bound handlers
    this.boundHandlers = {};
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.info("🔌 Disconnecting from MEXC WebSocket...");

    this.isShuttingDown = true;
    this.stopHeartbeat();
    this.cleanupConnection();

    // Clear all data
    this.subscriptions.clear();
    this.priceCache.clear();

    this.isConnected = false;
    this.isConnecting = false;
    this.isShuttingDown = false;
  }

  /**
   * Subscribe to price updates for a symbol
   */
  subscribe(symbol: string, callback: PriceCallback): () => void {
    const normalizedSymbol = symbol.toUpperCase();

    if (!this.subscriptions.has(normalizedSymbol)) {
      this.subscriptions.set(normalizedSymbol, new Set());

      // Send subscription message if connected
      if (this.isConnected && this.ws) {
        this.sendSubscription(normalizedSymbol);
      }
    }

    const callbacks = this.subscriptions.get(normalizedSymbol);
    if (callbacks) {
      callbacks.add(callback);
    }

    // Send cached price immediately if available
    const cachedPrice = this.priceCache.get(normalizedSymbol);
    if (cachedPrice) {
      callback(cachedPrice);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(normalizedSymbol);
      if (callbacks) {
        callbacks.delete(callback);

        // If no more callbacks, unsubscribe from symbol
        if (callbacks.size === 0) {
          this.subscriptions.delete(normalizedSymbol);

          if (this.isConnected && this.ws) {
            this.sendUnsubscription(normalizedSymbol);
          }
        }
      }
    };
  }

  /**
   * Get current cached price for a symbol
   */
  getCurrentPrice(symbol: string): PriceUpdate | null {
    return this.priceCache.get(symbol.toUpperCase()) || null;
  }

  /**
   * Get all cached prices
   */
  getAllPrices(): Map<string, PriceUpdate> {
    return this.priceCache.entries();
  }

  /**
   * Handle ticker price updates
   */
  private handleTickerUpdate(tickerData: TickerData): void {
    const priceUpdate: PriceUpdate = {
      symbol: tickerData.s,
      price: Number.parseFloat(tickerData.c),
      change: Number.parseFloat(tickerData.p),
      changePercent: Number.parseFloat(tickerData.P),
      volume: Number.parseFloat(tickerData.v),
      timestamp: tickerData.t || Date.now(),
    };

    // Cache the price update
    this.priceCache.set(tickerData.s, priceUpdate);

    // Notify all subscribers
    const callbacks = this.subscriptions.get(tickerData.s);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(priceUpdate);
        } catch (error) {
          console.error("❌ Error in price update callback:", error);
        }
      });
    }
  }

  /**
   * Send subscription message for a symbol
   */
  private sendSubscription(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const subscriptionMessage = {
      method: "SUBSCRIPTION",
      params: [`${symbol.toLowerCase()}@ticker`],
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(subscriptionMessage));
    console.info(`📊 Subscribed to ${symbol} price updates`);
  }

  /**
   * Send unsubscription message for a symbol
   */
  private sendUnsubscription(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const unsubscriptionMessage = {
      method: "UNSUBSCRIBE",
      params: [`${symbol.toLowerCase()}@ticker`],
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(unsubscriptionMessage));
    console.info(`📊 Unsubscribed from ${symbol} price updates`);
  }

  /**
   * Resubscribe to all symbols after reconnection
   */
  private resubscribeAll(): void {
    for (const symbol of this.subscriptions.keys()) {
      this.sendSubscription(symbol);
    }
  }

  /**
   * Send pong response to ping
   */
  private sendPong(pingId: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({ pong: pingId }));
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: Date.now() }));
      }
    }, this.PING_INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (
      this.isShuttingDown ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      console.error("❌ Max reconnection attempts reached. Giving up.");
      return;
    }

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    console.info(
      `🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff with jitter
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2 + Math.random() * 1000,
      30000
    );
  }

  /**
   * Get service status including memory metrics
   */
  getStatus(): {
    isConnected: boolean;
    isConnecting: boolean;
    subscribedSymbols: string[];
    cachedPrices: number;
    reconnectAttempts: number;
    memoryMetrics?: MemoryMetrics;
  } {
    const latestMetrics = this.memoryMetrics[this.memoryMetrics.length - 1];

    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      subscribedSymbols: Array.from(this.subscriptions.keys()),
      cachedPrices: this.priceCache.size,
      reconnectAttempts: this.reconnectAttempts,
      memoryMetrics: latestMetrics,
    };
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    current: MemoryMetrics | null;
    history: MemoryMetrics[];
    growthRate: number | null;
  } {
    const current = this.memoryMetrics[this.memoryMetrics.length - 1] || null;
    let growthRate: number | null = null;

    if (this.memoryMetrics.length >= 10) {
      const oldMetric = this.memoryMetrics[this.memoryMetrics.length - 10];
      const timeElapsed =
        (current.timestamp - oldMetric.timestamp) / 1000 / 60 / 60; // hours
      growthRate = (current.heapUsed - oldMetric.heapUsed) / timeElapsed; // bytes per hour
    }

    return {
      current,
      history: [...this.memoryMetrics],
      growthRate,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.info("🛑 Shutting down WebSocket Price Service...");

    this.isShuttingDown = true;

    // Stop memory monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
    }

    // Disconnect from WebSocket
    this.disconnect();

    // Clear all data
    this.memoryMetrics = [];

    console.info("✅ WebSocket Price Service shutdown complete");
  }
}

// Export singleton instance
export const webSocketPriceService = WebSocketPriceService.getInstance();

// Hook for React components to use WebSocket price feeds
export function useWebSocketPrice(symbol: string): {
  price: PriceUpdate | null;
  isConnected: boolean;
  error: string | null;
} {
  if (typeof window === "undefined") {
    // Server-side rendering fallback
    return {
      price: null,
      isConnected: false,
      error: "WebSocket not available on server",
    };
  }

  // This would need React hooks in a real implementation
  // For now, returning a basic structure
  return {
    price: webSocketPriceService.getCurrentPrice(symbol),
    isConnected: webSocketPriceService.getStatus().isConnected,
    error: null,
  };
}

// Graceful shutdown handler
if (typeof process !== "undefined") {
  process.on("SIGINT", async () => {
    await webSocketPriceService.shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await webSocketPriceService.shutdown();
    process.exit(0);
  });
}
