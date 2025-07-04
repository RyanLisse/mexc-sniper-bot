/**
 * Price Monitor
 * Handles real-time price monitoring and alert generation for auto-sniping
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";

export interface PriceAlert {
  id: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  direction: "above" | "below";
  triggered: boolean;
  timestamp: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface PriceSubscription {
  symbol: string;
  callback: (price: number) => void;
  alerts: PriceAlert[];
}

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
  timestamp: Date;
}

export class PriceMonitor extends BrowserCompatibleEventEmitter {
  private subscriptions = new Map<string, PriceSubscription>();
  private activeAlerts = new Map<string, PriceAlert>();
  private priceCache = new Map<string, MarketDataUpdate>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private websocketConnection: WebSocket | null = null;
  private isMonitoring = false;
  private updateInterval = 5000; // 5 seconds default

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    await this.startMonitoring();
  }

  async shutdown(): Promise<void> {
    await this.stopMonitoring();
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Start price update polling
    this.monitoringInterval = setInterval(() => {
      this.updatePrices();
    }, this.updateInterval);

    // Attempt WebSocket connection for real-time updates
    await this.connectWebSocket();

    this.emit("monitoringStarted");
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    // Clear interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Close WebSocket connection
    if (this.websocketConnection) {
      this.websocketConnection.close();
      this.websocketConnection = null;
    }

    this.emit("monitoringStopped");
  }

  subscribeToSymbol(symbol: string, callback?: (price: number) => void): void {
    if (!this.subscriptions.has(symbol)) {
      this.subscriptions.set(symbol, {
        symbol,
        callback: callback || (() => {}),
        alerts: [],
      });
    } else if (callback) {
      // Update callback if provided
      const subscription = this.subscriptions.get(symbol)!;
      subscription.callback = callback;
    }

    this.emit("symbolSubscribed", { symbol });
  }

  unsubscribeFromSymbol(symbol: string): void {
    this.subscriptions.delete(symbol);
    this.emit("symbolUnsubscribed", { symbol });
  }

  createPriceAlert(
    symbol: string,
    targetPrice: number,
    direction: "above" | "below",
    metadata?: Record<string, any>
  ): string {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const alert: PriceAlert = {
      id: alertId,
      symbol,
      currentPrice: this.getCurrentPrice(symbol) || 0,
      targetPrice,
      direction,
      triggered: false,
      timestamp: new Date(),
      createdAt: new Date(),
      metadata,
    };

    this.activeAlerts.set(alertId, alert);

    // Add to symbol subscription
    if (!this.subscriptions.has(symbol)) {
      this.subscribeToSymbol(symbol);
    }

    const subscription = this.subscriptions.get(symbol)!;
    subscription.alerts.push(alert);

    this.emit("alertCreated", alert);
    return alertId;
  }

  removeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    // Remove from subscription
    const subscription = this.subscriptions.get(alert.symbol);
    if (subscription) {
      subscription.alerts = subscription.alerts.filter((a) => a.id !== alertId);
    }

    this.emit("alertRemoved", { alertId, symbol: alert.symbol });
    return true;
  }

  getCurrentPrice(symbol: string): number | null {
    const data = this.priceCache.get(symbol);
    return data ? data.price : null;
  }

  getMarketData(symbol: string): MarketDataUpdate | null {
    return this.priceCache.get(symbol) || null;
  }

  getAllPrices(): Map<string, MarketDataUpdate> {
    return new Map(this.priceCache);
  }

  getActiveAlerts(): PriceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getSymbolAlerts(symbol: string): PriceAlert[] {
    return this.getActiveAlerts().filter((alert) => alert.symbol === symbol);
  }

  private async updatePrices(): Promise<void> {
    if (!this.isMonitoring) return;

    try {
      const symbols = Array.from(this.subscriptions.keys());
      if (symbols.length === 0) return;

      // Fetch prices for all subscribed symbols
      for (const symbol of symbols) {
        try {
          const marketData = await this.fetchMarketData(symbol);
          if (marketData) {
            this.processPriceUpdate(marketData);
          }
        } catch (error) {
          console.warn(`Failed to fetch price for ${symbol}:`, error);
        }
      }
    } catch (error) {
      this.emit("monitoringError", { error: toSafeError(error).message });
    }
  }

  private async fetchMarketData(
    symbol: string
  ): Promise<MarketDataUpdate | null> {
    try {
      // This would be replaced with actual MEXC API call
      // For now, simulate market data
      const currentData = this.priceCache.get(symbol);
      const basePrice = currentData?.price || Math.random() * 100 + 10;
      const priceChange = (Math.random() - 0.5) * 0.02; // ±1% change

      const marketData: MarketDataUpdate = {
        symbol,
        price: basePrice * (1 + priceChange),
        volume: Math.random() * 1000000,
        change24h: (Math.random() - 0.5) * 10, // ±5% daily change
        timestamp: new Date(),
      };

      return marketData;
    } catch (error) {
      console.error(`Error fetching market data for ${symbol}:`, error);
      return null;
    }
  }

  private processPriceUpdate(marketData: MarketDataUpdate): void {
    const { symbol, price } = marketData;

    // Update price cache
    this.priceCache.set(symbol, marketData);

    // Notify subscription callback
    const subscription = this.subscriptions.get(symbol);
    if (subscription && subscription.callback) {
      try {
        subscription.callback(price);
      } catch (error) {
        console.warn(`Error in price callback for ${symbol}:`, error);
      }
    }

    // Check price alerts
    this.checkPriceAlerts(symbol, price);

    // Emit price update event
    this.emit("priceUpdate", marketData);
  }

  private checkPriceAlerts(symbol: string, currentPrice: number): void {
    const subscription = this.subscriptions.get(symbol);
    if (!subscription) return;

    for (const alert of subscription.alerts) {
      if (alert.triggered) continue;

      const shouldTrigger =
        (alert.direction === "above" && currentPrice >= alert.targetPrice) ||
        (alert.direction === "below" && currentPrice <= alert.targetPrice);

      if (shouldTrigger) {
        alert.triggered = true;
        alert.currentPrice = currentPrice;
        alert.timestamp = new Date();

        this.emit("priceAlert", alert);
        this.emit("alertTriggered", alert);
      }
    }
  }

  private async connectWebSocket(): Promise<void> {
    try {
      // This would connect to actual MEXC WebSocket
      // For now, simulate with a mock connection
      this.simulateWebSocketConnection();
    } catch (error) {
      console.warn("Failed to connect WebSocket, using polling only:", error);
    }
  }

  private simulateWebSocketConnection(): void {
    // Simulate WebSocket messages with periodic updates
    const wsSimulation = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(wsSimulation);
        return;
      }

      // Send random price updates for subscribed symbols
      const symbols = Array.from(this.subscriptions.keys());
      if (symbols.length > 0) {
        const randomSymbol =
          symbols[Math.floor(Math.random() * symbols.length)];
        this.fetchMarketData(randomSymbol).then((data) => {
          if (data) {
            this.processPriceUpdate(data);
          }
        });
      }
    }, 2000); // Update every 2 seconds
  }

  // Configuration methods
  setUpdateInterval(intervalMs: number): void {
    this.updateInterval = Math.max(1000, intervalMs); // Minimum 1 second

    if (this.isMonitoring) {
      // Restart monitoring with new interval
      this.stopMonitoring().then(() => {
        this.startMonitoring();
      });
    }
  }

  getUpdateInterval(): number {
    return this.updateInterval;
  }

  // Utility methods
  isSymbolSubscribed(symbol: string): boolean {
    return this.subscriptions.has(symbol);
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  getAlertCount(): number {
    return this.activeAlerts.size;
  }

  get monitoring(): boolean {
    return this.isMonitoring;
  }

  // Bulk operations
  createMultipleAlerts(
    alerts: Array<{
      symbol: string;
      targetPrice: number;
      direction: "above" | "below";
      metadata?: Record<string, any>;
    }>
  ): string[] {
    return alerts.map((alert) =>
      this.createPriceAlert(
        alert.symbol,
        alert.targetPrice,
        alert.direction,
        alert.metadata
      )
    );
  }

  removeAllAlerts(): void {
    this.activeAlerts.clear();

    // Clear alerts from subscriptions
    for (const subscription of this.subscriptions.values()) {
      subscription.alerts = [];
    }

    this.emit("allAlertsRemoved");
  }

  removeSymbolAlerts(symbol: string): void {
    const alertsToRemove = this.getSymbolAlerts(symbol);

    alertsToRemove.forEach((alert) => {
      this.activeAlerts.delete(alert.id);
    });

    const subscription = this.subscriptions.get(symbol);
    if (subscription) {
      subscription.alerts = [];
    }

    this.emit("symbolAlertsRemoved", { symbol, count: alertsToRemove.length });
  }

  // Analysis methods
  getPriceHistory(symbol: string, minutes: number = 60): MarketDataUpdate[] {
    // This would return historical price data
    // For now, return current data only
    const current = this.priceCache.get(symbol);
    return current ? [current] : [];
  }

  calculatePriceChange(
    symbol: string,
    timeframeMinutes: number = 60
  ): number | null {
    // This would calculate price change over timeframe
    // For now, use the cached 24h change
    const data = this.priceCache.get(symbol);
    return data ? data.change24h : null;
  }

  getMarketSummary(): {
    totalSymbols: number;
    totalAlerts: number;
    triggeredAlerts: number;
    averagePrice: number;
    lastUpdate: Date | null;
  } {
    const prices = Array.from(this.priceCache.values());
    const alerts = Array.from(this.activeAlerts.values());

    return {
      totalSymbols: this.subscriptions.size,
      totalAlerts: alerts.length,
      triggeredAlerts: alerts.filter((a) => a.triggered).length,
      averagePrice:
        prices.length > 0
          ? prices.reduce((sum, p) => sum + p.price, 0) / prices.length
          : 0,
      lastUpdate:
        prices.length > 0
          ? new Date(Math.max(...prices.map((p) => p.timestamp.getTime())))
          : null,
    };
  }
}
