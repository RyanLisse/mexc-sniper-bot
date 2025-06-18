/**
 * MEXC WebSocket Stream Service
 *
 * Real-time MEXC exchange data streaming integration.
 * Provides live price feeds, market data, and trading updates.
 * Integrates with the AI agent system for pattern discovery.
 *
 * Features:
 * - Real-time price feeds from MEXC WebSocket
 * - Market depth and order book streaming
 * - Trading execution notifications
 * - Symbol status monitoring
 * - Integration with pattern discovery agents
 * - Connection management and error recovery
 */

import { EventEmitter } from "node:events";
import type {
  NotificationMessage,
  TradingPriceMessage,
  TradingSignalMessage,
} from "../lib/websocket-types";
import { webSocketAgentBridge } from "../mexc-agents/websocket-agent-bridge";
import { webSocketServer } from "./websocket-server";
import WebSocket from "ws";

// ======================
// MEXC WebSocket Types
// ======================

interface MexcTickerData {
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

interface MexcDepthData {
  s: string; // symbol
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
  ts: number; // timestamp
}

interface MexcTradeData {
  s: string; // symbol
  p: string; // price
  q: string; // quantity
  T: number; // trade time
  m: boolean; // is buyer maker
}

interface MexcKlineData {
  s: string; // symbol
  k: {
    t: number; // open time
    T: number; // close time
    s: string; // symbol
    i: string; // interval
    o: string; // open price
    c: string; // close price
    h: string; // high price
    l: string; // low price
    v: string; // volume
    n: number; // number of trades
    x: boolean; // is kline closed
    q: string; // quote volume
    V: string; // taker buy volume
    Q: string; // taker buy quote volume
  };
}

interface SymbolStatusData {
  s: string; // symbol
  sts: number; // symbol trading status
  st: number; // status
  tt: number; // trading time
  cs: number; // close status
  ts: number; // timestamp
}

// ======================
// Market Data Manager
// ======================

class MarketDataManager {
  private priceCache = new Map<string, TradingPriceMessage>();
  private depthCache = new Map<string, MexcDepthData>();
  private statusCache = new Map<string, SymbolStatusData>();
  private subscribers = new Map<string, Set<string>>();

  updatePrice(ticker: MexcTickerData): void {
    const priceMessage: TradingPriceMessage = {
      symbol: ticker.s,
      price: Number.parseFloat(ticker.c),
      change: Number.parseFloat(ticker.p),
      changePercent: Number.parseFloat(ticker.P),
      volume: Number.parseFloat(ticker.v),
      timestamp: ticker.t || Date.now(),
      source: "mexc_ws",
      metadata: {
        high24h: Number.parseFloat(ticker.h),
        low24h: Number.parseFloat(ticker.l),
        volume24h: Number.parseFloat(ticker.v),
        lastUpdate: Date.now(),
      },
    };

    this.priceCache.set(ticker.s, priceMessage);

    // Broadcast to WebSocket clients
    webSocketServer.broadcastTradingPrice(priceMessage);

    // Check for pattern updates
    this.checkForPatternUpdates(ticker.s, priceMessage);
  }

  updateDepth(depth: MexcDepthData): void {
    this.depthCache.set(depth.s, depth);

    // Broadcast order book updates
    webSocketServer.broadcast({
      type: "trading:orderbook",
      channel: `trading:${depth.s}:orderbook`,
      data: {
        symbol: depth.s,
        bids: depth.bids.slice(0, 20), // Top 20 levels
        asks: depth.asks.slice(0, 20),
        timestamp: depth.ts,
      },
    });
  }

  updateSymbolStatus(status: SymbolStatusData): void {
    const previousStatus = this.statusCache.get(status.s);
    this.statusCache.set(status.s, status);

    // Check for ready state pattern (sts:2, st:2, tt:4)
    const isReady = status.sts === 2 && status.st === 2 && status.tt === 4;
    const wasReady = previousStatus
      ? previousStatus.sts === 2 && previousStatus.st === 2 && previousStatus.tt === 4
      : false;

    if (isReady && !wasReady) {
      // Symbol just became ready - broadcast pattern
      this.broadcastReadyStatePattern(status);
    }

    // Broadcast status update
    webSocketServer.broadcast({
      type: "trading:status",
      channel: `trading:${status.s}:status`,
      data: {
        symbol: status.s,
        symbolTradingStatus: status.sts,
        status: status.st,
        tradingTime: status.tt,
        closeStatus: status.cs,
        timestamp: status.ts,
        isReady,
      },
    });
  }

  private checkForPatternUpdates(symbol: string, price: TradingPriceMessage): void {
    const status = this.statusCache.get(symbol);
    if (!status) return;

    // Check for significant price movements
    const previousPrice = this.priceCache.get(symbol);
    if (previousPrice) {
      const priceChangePercent = Math.abs(price.changePercent);

      // Generate trading signal for significant movements
      if (priceChangePercent > 5) {
        // 5% movement
        const signal: TradingSignalMessage = {
          signalId: crypto.randomUUID(),
          symbol,
          type: price.change > 0 ? "buy" : "sell",
          strength: Math.min(priceChangePercent * 10, 100), // Scale to 0-100
          confidence: 0.6, // Base confidence for price movement signals
          source: "price_movement",
          reasoning: `Significant ${price.change > 0 ? "upward" : "downward"} price movement of ${priceChangePercent.toFixed(2)}%`,
          timeframe: "1m",
          timestamp: Date.now(),
          metadata: {
            priceChange: price.change,
            priceChangePercent: price.changePercent,
            volume: price.volume,
            riskLevel: priceChangePercent > 10 ? "high" : "medium",
          },
        };

        webSocketServer.broadcast({
          type: "trading:signal",
          channel: "trading:signals",
          data: signal,
        });

        // Notify AI agents about the signal
        webSocketAgentBridge.broadcastTradingSignal(signal);
      }
    }
  }

  private broadcastReadyStatePattern(status: SymbolStatusData): void {
    const priceData = this.priceCache.get(status.s);

    const readyStateData = {
      symbol: status.s,
      vcoinId: status.s, // Use symbol as vcoinId if not available
      sts: status.sts,
      st: status.st,
      tt: status.tt,
      confidence: 0.95, // High confidence for exact match
      riskLevel: "medium" as const,
      expectedVolatility: priceData ? Math.abs(priceData.changePercent) / 100 : 0.1,
      correlatedSymbols: [], // Would need to calculate
      metadata: {
        detectedAt: Date.now(),
        source: "mexc_websocket",
        priceAtDetection: priceData?.price,
      },
    };

    // Broadcast to agent bridge
    webSocketAgentBridge.broadcastReadyStatePattern(status.s, readyStateData);

    // Send high-priority notification
    const notification: NotificationMessage = {
      notificationId: crypto.randomUUID(),
      type: "success",
      title: "Ready State Pattern Detected",
      message: `${status.s} is ready for trading (sts:2, st:2, tt:4)`,
      priority: "critical",
      category: "pattern",
      timestamp: Date.now(),
      actionable: true,
      actions: [
        {
          label: "Monitor Price",
          action: "monitor_price",
          params: { symbol: status.s },
        },
        {
          label: "Create Strategy",
          action: "create_strategy",
          params: { symbol: status.s },
        },
      ],
      metadata: {
        symbol: status.s,
        sts: status.sts,
        st: status.st,
        tt: status.tt,
      },
    };

    webSocketServer.broadcastNotification(notification);
  }

  getCurrentPrice(symbol: string): TradingPriceMessage | undefined {
    return this.priceCache.get(symbol);
  }

  getCurrentDepth(symbol: string): MexcDepthData | undefined {
    return this.depthCache.get(symbol);
  }

  getCurrentStatus(symbol: string): SymbolStatusData | undefined {
    return this.statusCache.get(symbol);
  }

  getAllPrices(): Map<string, TradingPriceMessage> {
    return new Map(this.priceCache);
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribers.keys());
  }
}

// ======================
// Connection Manager
// ======================

class MexcConnectionManager {
  private ws: WebSocket | null = null;
  private connectionId?: string;
  private reconnectAttempts = 0;
  private reconnectDelay = 1000;
  private heartbeatInterval?: NodeJS.Timeout;
  private isConnecting = false;
  private isConnected = false;
  private readonly maxReconnectAttempts = 10;
  private readonly maxReconnectDelay = 30000;
  private readonly heartbeatIntervalMs = 30000;

  constructor(
    private url: string,
    private onMessage: (data: any) => void,
    private onError: (error: Error) => void
  ) {}

  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected) return;

    this.isConnecting = true;

    try {
      console.log("[MEXC WebSocket] Connecting to MEXC WebSocket...");

      this.ws = new WebSocket(this.url);

      this.ws.on("open", this.handleOpen.bind(this));
      this.ws.on("message", this.handleMessage.bind(this));
      this.ws.on("close", this.handleClose.bind(this));
      this.ws.on("error", this.handleError.bind(this));

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);

        this.ws?.once("open", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.ws?.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
  }

  send(message: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("[MEXC WebSocket] Failed to send message:", error);
      return false;
    }
  }

  private handleOpen(): void {
    console.log("[MEXC WebSocket] Connected to MEXC");

    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    this.startHeartbeat();
  }

  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      this.onMessage(message);
    } catch (error) {
      console.error("[MEXC WebSocket] Failed to parse message:", error);
    }
  }

  private handleClose(code: number, reason: Buffer): void {
    console.log(`[MEXC WebSocket] Connection closed: ${code} - ${reason.toString()}`);

    this.stopHeartbeat();
    this.isConnected = false;
    this.isConnecting = false;
    this.ws = null;

    // Attempt reconnection if not a normal closure
    if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error): void {
    console.error("[MEXC WebSocket] Connection error:", error);
    this.onError(error);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay, this.maxReconnectDelay);

    console.log(
      `[MEXC WebSocket] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error("[MEXC WebSocket] Reconnection failed:", error);
      });
    }, delay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  isConnectedToMexc(): boolean {
    return this.isConnected;
  }

  getConnectionInfo() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }
}

// ======================
// Main MEXC WebSocket Stream Service
// ======================

export class MexcWebSocketStreamService extends EventEmitter {
  private static instance: MexcWebSocketStreamService;
  private marketDataManager = new MarketDataManager();
  private connectionManager: MexcConnectionManager;
  private subscriptions = new Set<string>();
  private isRunning = false;
  private readonly mexcWsUrl = "wss://wbs.mexc.com/ws";

  constructor() {
    super();

    this.connectionManager = new MexcConnectionManager(
      this.mexcWsUrl,
      this.handleMexcMessage.bind(this),
      this.handleMexcError.bind(this)
    );
  }

  static getInstance(): MexcWebSocketStreamService {
    if (!MexcWebSocketStreamService.instance) {
      MexcWebSocketStreamService.instance = new MexcWebSocketStreamService();
    }
    return MexcWebSocketStreamService.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log("[MEXC Stream] Starting MEXC WebSocket stream service...");

    try {
      await this.connectionManager.connect();
      this.isRunning = true;

      // Subscribe to all symbol tickers for market overview
      this.subscribeToAllTickers();

      console.log("[MEXC Stream] MEXC WebSocket stream service started");
      this.emit("started");
    } catch (error) {
      console.error("[MEXC Stream] Failed to start MEXC WebSocket stream:", error);
      throw error;
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log("[MEXC Stream] Stopping MEXC WebSocket stream service...");

    this.connectionManager.disconnect();
    this.subscriptions.clear();
    this.isRunning = false;

    console.log("[MEXC Stream] MEXC WebSocket stream service stopped");
    this.emit("stopped");
  }

  // ======================
  // Subscription Management
  // ======================

  subscribeToSymbolTicker(symbol: string): void {
    const stream = `${symbol.toLowerCase()}@ticker`;
    this.subscribe(stream);
  }

  subscribeToSymbolDepth(symbol: string, levels = 20): void {
    const stream = `${symbol.toLowerCase()}@depth${levels}`;
    this.subscribe(stream);
  }

  subscribeToSymbolTrades(symbol: string): void {
    const stream = `${symbol.toLowerCase()}@trade`;
    this.subscribe(stream);
  }

  subscribeToSymbolKlines(symbol: string, interval = "1m"): void {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    this.subscribe(stream);
  }

  subscribeToAllTickers(): void {
    this.subscribe("!ticker@arr");
  }

  private subscribe(stream: string): void {
    if (this.subscriptions.has(stream)) return;

    const subscribeMessage = {
      method: "SUBSCRIPTION",
      params: [stream],
      id: Date.now(),
    };

    if (this.connectionManager.send(subscribeMessage)) {
      this.subscriptions.add(stream);
      console.log(`[MEXC Stream] Subscribed to ${stream}`);
    } else {
      console.error(`[MEXC Stream] Failed to subscribe to ${stream}`);
    }
  }

  unsubscribe(stream: string): void {
    if (!this.subscriptions.has(stream)) return;

    const unsubscribeMessage = {
      method: "UNSUBSCRIBE",
      params: [stream],
      id: Date.now(),
    };

    if (this.connectionManager.send(unsubscribeMessage)) {
      this.subscriptions.delete(stream);
      console.log(`[MEXC Stream] Unsubscribed from ${stream}`);
    }
  }

  // ======================
  // Message Handling
  // ======================

  private handleMexcMessage(message: any): void {
    try {
      // Handle subscription confirmations
      if (message.result === null && message.id) {
        console.log(`[MEXC Stream] Subscription confirmed: ${message.id}`);
        return;
      }

      // Handle stream data
      if (message.stream && message.data) {
        this.routeStreamData(message.stream, message.data);
      }

      // Handle ticker array data
      if (Array.isArray(message)) {
        for (const ticker of message) {
          if (ticker.s) {
            // Has symbol
            this.marketDataManager.updatePrice(ticker);
          }
        }
      }

      // Handle ping/pong
      if (message.ping) {
        this.connectionManager.send({ pong: message.ping });
      }
    } catch (error) {
      console.error("[MEXC Stream] Error handling message:", error);
    }
  }

  private routeStreamData(stream: string, data: any): void {
    try {
      if (stream.includes("@ticker")) {
        this.marketDataManager.updatePrice(data);
      } else if (stream.includes("@depth")) {
        this.marketDataManager.updateDepth(data);
      } else if (stream.includes("@trade")) {
        this.handleTradeData(data);
      } else if (stream.includes("@kline")) {
        this.handleKlineData(data);
      } else if (stream.includes("@symbolStatus")) {
        this.marketDataManager.updateSymbolStatus(data);
      }

      this.emit("data", { stream, data });
    } catch (error) {
      console.error(`[MEXC Stream] Error routing stream data for ${stream}:`, error);
    }
  }

  private handleTradeData(trade: MexcTradeData): void {
    // Broadcast individual trade data
    webSocketServer.broadcast({
      type: "trading:trade",
      channel: `trading:${trade.s}:trades`,
      data: {
        symbol: trade.s,
        price: Number.parseFloat(trade.p),
        quantity: Number.parseFloat(trade.q),
        timestamp: trade.T,
        isBuyerMaker: trade.m,
      },
    });
  }

  private handleKlineData(kline: MexcKlineData): void {
    // Only process closed klines
    if (!kline.k.x) return;

    webSocketServer.broadcast({
      type: "trading:kline",
      channel: `trading:${kline.s}:klines`,
      data: {
        symbol: kline.k.s,
        interval: kline.k.i,
        openTime: kline.k.t,
        closeTime: kline.k.T,
        open: Number.parseFloat(kline.k.o),
        close: Number.parseFloat(kline.k.c),
        high: Number.parseFloat(kline.k.h),
        low: Number.parseFloat(kline.k.l),
        volume: Number.parseFloat(kline.k.v),
        trades: kline.k.n,
        isClosed: kline.k.x,
      },
    });
  }

  private handleMexcError(error: Error): void {
    console.error("[MEXC Stream] MEXC WebSocket error:", error);

    // Broadcast error notification
    const notification: NotificationMessage = {
      notificationId: crypto.randomUUID(),
      type: "error",
      title: "MEXC Connection Error",
      message: `MEXC WebSocket connection error: ${error.message}`,
      priority: "medium",
      category: "system",
      timestamp: Date.now(),
      metadata: {
        service: "mexc_websocket",
        errorType: "connection_error",
      },
    };

    webSocketServer.broadcastNotification(notification);
    this.emit("error", error);
  }

  // ======================
  // Symbol Management
  // ======================

  async subscribeToSymbolList(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      this.subscribeToSymbolTicker(symbol);
      this.subscribeToSymbolDepth(symbol);

      // Add small delay to avoid overwhelming the connection
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async monitorNewListings(): Promise<void> {
    // This would integrate with the calendar agent to get new listings
    // and automatically subscribe to their data streams
    setInterval(async () => {
      try {
        // Get new symbols from calendar agent
        // This would be implemented to call the calendar agent
        const newSymbols = await this.getNewListingsFromAgent();

        for (const symbol of newSymbols) {
          this.subscribeToSymbolTicker(symbol);
          this.subscribeToSymbolDepth(symbol);

          console.log(`[MEXC Stream] Started monitoring new listing: ${symbol}`);
        }
      } catch (error) {
        console.error("[MEXC Stream] Error monitoring new listings:", error);
      }
    }, 60000); // Check every minute
  }

  private async getNewListingsFromAgent(): Promise<string[]> {
    // This would integrate with the calendar agent
    // For now, return empty array
    return [];
  }

  // ======================
  // Public API
  // ======================

  getCurrentPrice(symbol: string): TradingPriceMessage | undefined {
    return this.marketDataManager.getCurrentPrice(symbol);
  }

  getCurrentDepth(symbol: string): MexcDepthData | undefined {
    return this.marketDataManager.getCurrentDepth(symbol);
  }

  getAllPrices(): Map<string, TradingPriceMessage> {
    return this.marketDataManager.getAllPrices();
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscriptions);
  }

  isConnected(): boolean {
    return this.connectionManager.isConnectedToMexc();
  }

  getConnectionStatus() {
    return {
      connected: this.connectionManager.isConnectedToMexc(),
      running: this.isRunning,
      subscriptions: this.subscriptions.size,
      ...this.connectionManager.getConnectionInfo(),
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.isRunning && this.connectionManager.isConnectedToMexc();
  }
}

// Export singleton instance
export const mexcWebSocketStream = MexcWebSocketStreamService.getInstance();
