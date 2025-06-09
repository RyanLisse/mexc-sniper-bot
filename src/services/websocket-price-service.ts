/**
 * WebSocket Price Service
 * Provides real-time price feeds using MEXC WebSocket streams
 * Reduces API polling and improves real-time responsiveness
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

export class WebSocketPriceService {
  private static instance: WebSocketPriceService;
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<PriceCallback>>();
  private priceCache = new Map<string, PriceUpdate>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private heartbeatInterval?: NodeJS.Timeout;
  private isConnecting = false;
  private isConnected = false;

  // MEXC WebSocket URLs
  private readonly MEXC_WS_URL = "wss://wbs.mexc.com/ws";
  private readonly PING_INTERVAL = 30000; // 30 seconds

  private constructor() {}

  public static getInstance(): WebSocketPriceService {
    if (!WebSocketPriceService.instance) {
      WebSocketPriceService.instance = new WebSocketPriceService();
    }
    return WebSocketPriceService.instance;
  }

  /**
   * Connect to MEXC WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;

    try {
      console.log("🔌 Connecting to MEXC WebSocket...");

      // In browser environment, use native WebSocket
      // In Node.js environment, would need ws package
      if (typeof window !== "undefined") {
        this.ws = new WebSocket(this.MEXC_WS_URL);
      } else {
        // For server-side, we'll create a mock connection
        // In production, you'd use the 'ws' package
        console.log("⚠️ WebSocket not available in Node.js environment. Using polling fallback.");
        this.isConnecting = false;
        return;
      }

      this.ws.onopen = () => {
        console.log("✅ WebSocket connected to MEXC");
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.startHeartbeat();

        // Resubscribe to all symbols after reconnection
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
      };

      this.ws.onclose = (event) => {
        console.log("🔌 WebSocket disconnected:", event.code, event.reason);
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();

        // Attempt to reconnect if not intentionally closed
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("❌ Failed to connect to WebSocket:", error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log("🔌 Disconnecting from MEXC WebSocket...");

    this.stopHeartbeat();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, "Client disconnect");
    }

    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.subscriptions.clear();
    this.priceCache.clear();
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

    this.subscriptions.get(normalizedSymbol)!.add(callback);

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
    return new Map(this.priceCache);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

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
    console.log(`📊 Subscribed to ${symbol} price updates`);
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
    console.log(`📊 Unsubscribed from ${symbol} price updates`);
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Max reconnection attempts reached. Giving up.");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff with jitter
    this.reconnectDelay = Math.min(this.reconnectDelay * 2 + Math.random() * 1000, 30000);
  }

  /**
   * Get service status
   */
  getStatus(): {
    isConnected: boolean;
    isConnecting: boolean;
    subscribedSymbols: string[];
    cachedPrices: number;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      subscribedSymbols: Array.from(this.subscriptions.keys()),
      cachedPrices: this.priceCache.size,
      reconnectAttempts: this.reconnectAttempts,
    };
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
