/**
 * Real-time Price Monitor Service
 * 
 * This service provides real-time price monitoring using websockets to:
 * 1. Monitor price movements for snipe targets
 * 2. Trigger price-based snipe executions
 * 3. Provide real-time market data for decision making
 * 4. Detect price breakouts and sudden movements
 * 5. Integration with MEXC websocket streams
 */

import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { toSafeError } from '@/src/lib/error-type-utils';
import { getCompleteAutoSnipingService, type PatternTrigger } from './complete-auto-sniping-service';
import { getPatternSnipeIntegration, type PatternDetectionEvent } from './pattern-snipe-integration';

// Price monitoring interfaces
export interface PriceData {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  volumeChange: number;
  timestamp: Date;
  source: 'websocket' | 'api' | 'cache';
}

export interface PriceBreakout {
  symbol: string;
  breakoutType: 'resistance' | 'support' | 'volume';
  currentPrice: number;
  breakoutPrice: number;
  confidence: number;
  volume: number;
  timeframe: string;
  timestamp: Date;
}

export interface PriceTrigger {
  id: string;
  symbol: string;
  triggerType: 'price_above' | 'price_below' | 'volume_spike' | 'momentum';
  targetValue: number;
  currentValue: number;
  triggered: boolean;
  createdAt: Date;
  triggeredAt?: Date;
  callback?: (trigger: PriceTrigger, priceData: PriceData) => void;
}

export interface RealtimeMonitorConfig {
  enabled: boolean;
  symbols: string[];
  websocketUrl: string;
  reconnectDelay: number;
  heartbeatInterval: number;
  priceChangeThreshold: number; // % change to trigger events
  volumeChangeThreshold: number; // Volume multiplier to trigger events
  breakoutDetectionEnabled: boolean;
  autoSnipeOnBreakouts: boolean;
  maxPriceAge: number; // Max age of price data in ms
}

/**
 * Real-time Price Monitor Service
 * 
 * Provides real-time price monitoring and triggering for auto-sniping
 */
export class RealtimePriceMonitor extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) => console.info('[realtime-price-monitor]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[realtime-price-monitor]', message, context || ''),
    error: (message: string, context?: any) => console.error('[realtime-price-monitor]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[realtime-price-monitor]', message, context || ''),
  };

  private isActive = false;
  private config: RealtimeMonitorConfig;
  private websocket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  
  // Price data storage
  private priceData: Map<string, PriceData> = new Map();
  private priceHistory: Map<string, PriceData[]> = new Map();
  private priceTriggers: Map<string, PriceTrigger> = new Map();
  
  // Breakout detection
  private supportResistanceLevels: Map<string, { support: number; resistance: number }> = new Map();
  private volumeAverages: Map<string, number> = new Map();
  
  // Services
  private autoSnipingService = getCompleteAutoSnipingService();
  private patternIntegration = getPatternSnipeIntegration();
  
  // Connection state
  private connectionState = {
    connected: false,
    lastHeartbeat: new Date(),
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
  };

  constructor(config: Partial<RealtimeMonitorConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT'],
      websocketUrl: 'wss://wbs.mexc.com/ws',
      reconnectDelay: 5000,
      heartbeatInterval: 30000,
      priceChangeThreshold: 2.0, // 2% price change
      volumeChangeThreshold: 2.0, // 2x volume increase
      breakoutDetectionEnabled: true,
      autoSnipeOnBreakouts: true,
      maxPriceAge: 60000, // 1 minute
      ...config
    };

    this.logger.info('Real-time Price Monitor initialized', {
      enabled: this.config.enabled,
      symbols: this.config.symbols.length,
      breakoutDetection: this.config.breakoutDetectionEnabled,
      autoSnipe: this.config.autoSnipeOnBreakouts,
    });

    this.setupEventListeners();
  }

  /**
   * Start real-time price monitoring
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn('Real-time price monitor already active');
      return;
    }

    try {
      this.logger.info('Starting real-time price monitoring');

      // Initialize services if needed
      if (!this.autoSnipingService.getStatus().isInitialized) {
        await this.autoSnipingService.initialize();
      }

      if (!this.patternIntegration.getStatus().isActive) {
        await this.patternIntegration.start();
      }

      // Connect to websocket
      await this.connectWebSocket();

      // Start price data management
      this.startPriceDataCleanup();
      this.startBreakoutDetection();

      this.isActive = true;
      this.emit('monitor_started');

      this.logger.info('Real-time price monitoring started successfully');

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Failed to start real-time price monitoring', safeError);
      throw safeError;
    }
  }

  /**
   * Stop real-time price monitoring
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping real-time price monitoring');

      this.isActive = false;

      // Close websocket connection
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      // Clear timers
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      // Clear data
      this.priceData.clear();
      this.priceTriggers.clear();

      this.emit('monitor_stopped');

      this.logger.info('Real-time price monitoring stopped');

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Failed to stop real-time price monitoring', safeError);
      throw safeError;
    }
  }

  /**
   * Add a price trigger
   */
  addPriceTrigger(trigger: Omit<PriceTrigger, 'id' | 'triggered' | 'createdAt'>): string {
    const triggerId = `trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullTrigger: PriceTrigger = {
      id: triggerId,
      triggered: false,
      createdAt: new Date(),
      ...trigger,
    };

    this.priceTriggers.set(triggerId, fullTrigger);

    this.logger.info(`Price trigger added for ${trigger.symbol}`, {
      triggerId,
      type: trigger.triggerType,
      targetValue: trigger.targetValue,
    });

    return triggerId;
  }

  /**
   * Remove a price trigger
   */
  removePriceTrigger(triggerId: string): boolean {
    const removed = this.priceTriggers.delete(triggerId);
    
    if (removed) {
      this.logger.info(`Price trigger removed`, { triggerId });
    }

    return removed;
  }

  /**
   * Get current price data
   */
  getPriceData(symbol?: string): PriceData | Map<string, PriceData> | null {
    if (symbol) {
      return this.priceData.get(symbol.toUpperCase()) || null;
    }
    return new Map(this.priceData);
  }

  /**
   * Get price history for a symbol
   */
  getPriceHistory(symbol: string, limit = 100): PriceData[] {
    const history = this.priceHistory.get(symbol.toUpperCase()) || [];
    return history.slice(-limit);
  }

  /**
   * Get active price triggers
   */
  getActiveTriggers(): PriceTrigger[] {
    return Array.from(this.priceTriggers.values()).filter(t => !t.triggered);
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      connectionState: this.connectionState,
      config: this.config,
      monitoredSymbols: this.config.symbols.length,
      activeTriggers: this.getActiveTriggers().length,
      priceDataCount: this.priceData.size,
      lastPriceUpdate: Math.max(...Array.from(this.priceData.values()).map(p => p.timestamp.getTime())),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(updates: Partial<RealtimeMonitorConfig>): void {
    const oldSymbols = [...this.config.symbols];
    this.config = { ...this.config, ...updates };

    // Restart websocket if symbols changed
    if (JSON.stringify(oldSymbols) !== JSON.stringify(this.config.symbols)) {
      if (this.isActive) {
        this.reconnectWebSocket();
      }
    }

    this.logger.info('Real-time monitor config updated', { updates });
    this.emit('config_updated', this.config);
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for breakout events
    this.on('price_breakout', async (breakout: PriceBreakout) => {
      if (this.config.autoSnipeOnBreakouts) {
        await this.handleBreakoutSnipe(breakout);
      }
    });

    // Listen for price trigger events
    this.on('price_trigger', async (trigger: PriceTrigger, priceData: PriceData) => {
      if (trigger.callback) {
        try {
          trigger.callback(trigger, priceData);
        } catch (error) {
          this.logger.error('Price trigger callback error', { triggerId: trigger.id, error });
        }
      }
    });
  }

  /**
   * Connect to MEXC websocket
   */
  private async connectWebSocket(): Promise<void> {
    try {
      this.logger.info('Connecting to MEXC websocket', {
        url: this.config.websocketUrl,
        symbols: this.config.symbols.length,
      });

      this.websocket = new WebSocket(this.config.websocketUrl);

      this.websocket.on('open', () => {
        this.logger.info('WebSocket connected successfully');
        this.connectionState.connected = true;
        this.connectionState.reconnectAttempts = 0;
        
        // Subscribe to price streams
        this.subscribeToSymbols();
        
        // Start heartbeat
        this.startHeartbeat();
        
        this.emit('websocket_connected');
      });

      this.websocket.on('message', (data: WebSocket.Data) => {
        try {
          this.handleWebSocketMessage(data);
        } catch (error) {
          this.logger.error('WebSocket message handling error', error);
        }
      });

      this.websocket.on('error', (error: Error) => {
        this.logger.error('WebSocket error', error);
        this.connectionState.connected = false;
        this.emit('websocket_error', error);
      });

      this.websocket.on('close', (code: number, reason: Buffer) => {
        this.logger.warn('WebSocket connection closed', { 
          code, 
          reason: reason.toString(),
          reconnectAttempts: this.connectionState.reconnectAttempts,
        });
        
        this.connectionState.connected = false;
        this.emit('websocket_disconnected', { code, reason: reason.toString() });
        
        // Attempt reconnection if active
        if (this.isActive && this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Failed to connect to websocket', safeError);
      throw safeError;
    }
  }

  /**
   * Subscribe to symbol price streams
   */
  private subscribeToSymbols(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.logger.error('Cannot subscribe - WebSocket not connected');
      return;
    }

    // Subscribe to ticker streams for all symbols
    const subscriptions = this.config.symbols.map(symbol => ({
      method: 'SUBSCRIPTION',
      params: [`spot@public.miniTicker.v3.api@${symbol}`],
    }));

    // Also subscribe to kline data for breakout detection
    const klineSubscriptions = this.config.symbols.map(symbol => ({
      method: 'SUBSCRIPTION',
      params: [`spot@public.kline.v3.api@${symbol}@1m`],
    }));

    [...subscriptions, ...klineSubscriptions].forEach(sub => {
      try {
        this.websocket!.send(JSON.stringify(sub));
        this.logger.debug('Subscribed to stream', { params: sub.params });
      } catch (error) {
        this.logger.error('Failed to send subscription', { subscription: sub, error });
      }
    });
  }

  /**
   * Handle incoming websocket messages
   */
  private handleWebSocketMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle different message types
      if (message.c === 'miniTicker') {
        this.handleTickerUpdate(message.d);
      } else if (message.c === 'kline') {
        this.handleKlineUpdate(message.d);
      } else if (message.msg === 'PONG') {
        this.connectionState.lastHeartbeat = new Date();
      }

    } catch (error) {
      this.logger.error('Failed to parse websocket message', { data: data.toString(), error });
    }
  }

  /**
   * Handle ticker price updates
   */
  private handleTickerUpdate(tickerData: any): void {
    try {
      const symbol = tickerData.s;
      const price = parseFloat(tickerData.c);
      const priceChange = parseFloat(tickerData.o) - price;
      const priceChangePercent = parseFloat(tickerData.P);
      const volume = parseFloat(tickerData.v);

      const priceData: PriceData = {
        symbol,
        price,
        priceChange,
        priceChangePercent,
        volume,
        volumeChange: this.calculateVolumeChange(symbol, volume),
        timestamp: new Date(),
        source: 'websocket',
      };

      // Store current price data
      this.priceData.set(symbol, priceData);
      
      // Store in price history
      this.addToPriceHistory(symbol, priceData);

      // Check price triggers
      this.checkPriceTriggers(priceData);

      // Detect significant price movements
      this.detectSignificantMovements(priceData);

      this.emit('price_update', priceData);

    } catch (error) {
      this.logger.error('Failed to handle ticker update', { tickerData, error });
    }
  }

  /**
   * Handle kline updates for breakout detection
   */
  private handleKlineUpdate(klineData: any): void {
    try {
      const symbol = klineData.s;
      const high = parseFloat(klineData.h);
      const low = parseFloat(klineData.l);
      const volume = parseFloat(klineData.v);

      // Update support/resistance levels
      this.updateSupportResistance(symbol, high, low);
      
      // Update volume averages
      this.updateVolumeAverage(symbol, volume);

      // Check for breakouts
      if (this.config.breakoutDetectionEnabled) {
        this.detectBreakouts(symbol, high, low, volume);
      }

    } catch (error) {
      this.logger.error('Failed to handle kline update', { klineData, error });
    }
  }

  /**
   * Calculate volume change
   */
  private calculateVolumeChange(symbol: string, currentVolume: number): number {
    const average = this.volumeAverages.get(symbol) || currentVolume;
    return currentVolume / average;
  }

  /**
   * Add price data to history
   */
  private addToPriceHistory(symbol: string, priceData: PriceData): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(priceData);

    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Check and trigger price triggers
   */
  private checkPriceTriggers(priceData: PriceData): void {
    for (const [triggerId, trigger] of this.priceTriggers) {
      if (trigger.triggered || trigger.symbol !== priceData.symbol) {
        continue;
      }

      let shouldTrigger = false;

      switch (trigger.triggerType) {
        case 'price_above':
          shouldTrigger = priceData.price >= trigger.targetValue;
          trigger.currentValue = priceData.price;
          break;
        case 'price_below':
          shouldTrigger = priceData.price <= trigger.targetValue;
          trigger.currentValue = priceData.price;
          break;
        case 'volume_spike':
          shouldTrigger = priceData.volumeChange >= trigger.targetValue;
          trigger.currentValue = priceData.volumeChange;
          break;
        case 'momentum':
          shouldTrigger = Math.abs(priceData.priceChangePercent) >= trigger.targetValue;
          trigger.currentValue = priceData.priceChangePercent;
          break;
      }

      if (shouldTrigger) {
        trigger.triggered = true;
        trigger.triggeredAt = new Date();

        this.logger.info(`Price trigger activated`, {
          triggerId,
          symbol: trigger.symbol,
          type: trigger.triggerType,
          targetValue: trigger.targetValue,
          currentValue: trigger.currentValue,
        });

        this.emit('price_trigger', trigger, priceData);
      }
    }
  }

  /**
   * Detect significant price movements
   */
  private detectSignificantMovements(priceData: PriceData): void {
    if (Math.abs(priceData.priceChangePercent) >= this.config.priceChangeThreshold) {
      this.logger.info(`Significant price movement detected`, {
        symbol: priceData.symbol,
        priceChange: priceData.priceChangePercent,
        threshold: this.config.priceChangeThreshold,
      });

      this.emit('significant_movement', priceData);
    }

    if (priceData.volumeChange >= this.config.volumeChangeThreshold) {
      this.logger.info(`Volume spike detected`, {
        symbol: priceData.symbol,
        volumeChange: priceData.volumeChange,
        threshold: this.config.volumeChangeThreshold,
      });

      this.emit('volume_spike', priceData);
    }
  }

  /**
   * Update support and resistance levels
   */
  private updateSupportResistance(symbol: string, high: number, low: number): void {
    const current = this.supportResistanceLevels.get(symbol) || { support: low, resistance: high };
    
    // Simple moving support/resistance calculation
    const alpha = 0.1; // Smoothing factor
    current.support = current.support * (1 - alpha) + low * alpha;
    current.resistance = current.resistance * (1 - alpha) + high * alpha;
    
    this.supportResistanceLevels.set(symbol, current);
  }

  /**
   * Update volume average
   */
  private updateVolumeAverage(symbol: string, volume: number): void {
    const current = this.volumeAverages.get(symbol) || volume;
    const alpha = 0.1; // Smoothing factor
    this.volumeAverages.set(symbol, current * (1 - alpha) + volume * alpha);
  }

  /**
   * Detect breakouts
   */
  private detectBreakouts(symbol: string, high: number, low: number, volume: number): void {
    const levels = this.supportResistanceLevels.get(symbol);
    const avgVolume = this.volumeAverages.get(symbol);
    
    if (!levels || !avgVolume) return;

    const priceData = this.priceData.get(symbol);
    if (!priceData) return;

    // Resistance breakout
    if (high > levels.resistance * 1.002) { // 0.2% above resistance
      const breakout: PriceBreakout = {
        symbol,
        breakoutType: 'resistance',
        currentPrice: priceData.price,
        breakoutPrice: levels.resistance,
        confidence: Math.min(95, 70 + (volume / avgVolume) * 10),
        volume,
        timeframe: '1m',
        timestamp: new Date(),
      };

      this.logger.info(`Resistance breakout detected`, {
        symbol,
        price: priceData.price,
        resistance: levels.resistance,
        confidence: breakout.confidence,
      });

      this.emit('price_breakout', breakout);
    }

    // Support breakdown
    if (low < levels.support * 0.998) { // 0.2% below support
      const breakout: PriceBreakout = {
        symbol,
        breakoutType: 'support',
        currentPrice: priceData.price,
        breakoutPrice: levels.support,
        confidence: Math.min(95, 70 + (volume / avgVolume) * 10),
        volume,
        timeframe: '1m',
        timestamp: new Date(),
      };

      this.logger.info(`Support breakdown detected`, {
        symbol,
        price: priceData.price,
        support: levels.support,
        confidence: breakout.confidence,
      });

      this.emit('price_breakout', breakout);
    }
  }

  /**
   * Handle breakout-triggered snipe
   */
  private async handleBreakoutSnipe(breakout: PriceBreakout): Promise<void> {
    try {
      this.logger.info(`Executing breakout snipe for ${breakout.symbol}`, {
        breakoutType: breakout.breakoutType,
        confidence: breakout.confidence,
      });

      // Create pattern detection event from breakout
      const patternEvent: PatternDetectionEvent = {
        id: `breakout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol: breakout.symbol,
        pattern: {
          type: `${breakout.breakoutType}_breakout`,
          name: `${breakout.breakoutType.toUpperCase()} Breakout`,
          confidence: breakout.confidence,
          timeframe: breakout.timeframe,
          description: `Price breakout detected above ${breakout.breakoutType} level`,
        },
        price: {
          current: breakout.currentPrice,
          entry: breakout.currentPrice,
          stopLoss: breakout.breakoutType === 'resistance' 
            ? breakout.breakoutPrice * 0.98 
            : breakout.breakoutPrice * 1.02,
          takeProfit: breakout.breakoutType === 'resistance' 
            ? breakout.currentPrice * 1.05 
            : breakout.currentPrice * 0.95,
          volume: breakout.volume,
        },
        timing: {
          detectedAt: breakout.timestamp,
          validUntil: new Date(Date.now() + 10 * 60 * 1000), // Valid for 10 minutes
          urgency: breakout.confidence > 85 ? 'high' : 'medium',
        },
        metadata: {
          vcoinId: breakout.symbol.replace('USDT', ''),
          exchange: 'MEXC',
          indicators: {
            breakout_confidence: breakout.confidence,
            volume_ratio: breakout.volume / (this.volumeAverages.get(breakout.symbol) || 1),
          },
          marketConditions: {
            trend: breakout.breakoutType === 'resistance' ? 'bullish' : 'bearish',
            volatility: 'high',
          },
        },
      };

      // Process through pattern integration
      await this.patternIntegration.processPattern(patternEvent);

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(`Failed to execute breakout snipe for ${breakout.symbol}`, {
        breakout,
        error: safeError.message,
      });
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        try {
          this.websocket.send(JSON.stringify({ method: 'PING' }));
        } catch (error) {
          this.logger.error('Failed to send heartbeat', error);
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Schedule websocket reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.connectionState.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts - 1),
      60000 // Max 1 minute delay
    );

    this.logger.info(`Scheduling reconnection in ${delay}ms`, {
      attempt: this.connectionState.reconnectAttempts,
      maxAttempts: this.connectionState.maxReconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectWebSocket();
    }, delay);
  }

  /**
   * Reconnect websocket
   */
  private async reconnectWebSocket(): Promise<void> {
    try {
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      await this.connectWebSocket();

    } catch (error) {
      this.logger.error('Reconnection failed', error);
      
      if (this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        this.logger.error('Max reconnection attempts reached, stopping monitor');
        this.stop();
      }
    }
  }

  /**
   * Start price data cleanup
   */
  private startPriceDataCleanup(): void {
    setInterval(() => {
      if (this.isActive) {
        this.cleanupOldPriceData();
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Clean up old price data
   */
  private cleanupOldPriceData(): void {
    const cutoff = new Date(Date.now() - this.config.maxPriceAge);
    let cleanedCount = 0;

    for (const [symbol, priceData] of this.priceData) {
      if (priceData.timestamp < cutoff) {
        this.priceData.delete(symbol);
        cleanedCount++;
      }
    }

    // Clean up triggered price triggers
    for (const [triggerId, trigger] of this.priceTriggers) {
      if (trigger.triggered && trigger.triggeredAt && trigger.triggeredAt < cutoff) {
        this.priceTriggers.delete(triggerId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} old price data entries`);
    }
  }

  /**
   * Start breakout detection processing
   */
  private startBreakoutDetection(): void {
    if (!this.config.breakoutDetectionEnabled) return;

    setInterval(() => {
      if (this.isActive) {
        this.processBreakoutDetection();
      }
    }, 30000); // Check every 30 seconds (reduced from 5s)
  }

  /**
   * Process breakout detection
   */
  private processBreakoutDetection(): void {
    // This could be enhanced with more sophisticated breakout detection algorithms
    // For now, the detection happens in real-time via handleKlineUpdate
  }
}

// Export singleton instance
let realtimePriceMonitor: RealtimePriceMonitor | null = null;

export function getRealtimePriceMonitor(config?: Partial<RealtimeMonitorConfig>): RealtimePriceMonitor {
  if (!realtimePriceMonitor) {
    realtimePriceMonitor = new RealtimePriceMonitor(config);
  }
  return realtimePriceMonitor;
}

export function resetRealtimePriceMonitor(): void {
  if (realtimePriceMonitor) {
    realtimePriceMonitor.stop();
  }
  realtimePriceMonitor = null;
}