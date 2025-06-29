/**
 * Pattern Detection to Sniping Integration Service
 * 
 * This service bridges the gap between pattern detection and auto-sniping by:
 * 1. Monitoring pattern detection events
 * 2. Converting patterns to snipe triggers
 * 3. Managing pattern-based snipe execution
 * 4. Providing real-time pattern monitoring
 */

import { EventEmitter } from 'node:events';
import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/src/db';
import { snipeTargets } from '@/src/db/schemas/trading';
import { toSafeError } from '@/src/lib/error-type-utils';
import { getCompleteAutoSnipingService, type PatternTrigger, type SnipeConfiguration } from './complete-auto-sniping-service';

// Pattern detection interfaces
export interface PatternDetectionEvent {
  id: string;
  symbol: string;
  pattern: {
    type: string;
    name: string;
    confidence: number;
    timeframe: string;
    description: string;
  };
  price: {
    current: number;
    entry: number;
    stopLoss: number;
    takeProfit: number;
    volume: number;
  };
  timing: {
    detectedAt: Date;
    validUntil: Date;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  metadata: {
    vcoinId?: string;
    exchange: string;
    indicators: Record<string, number>;
    marketConditions: Record<string, any>;
  };
}

export interface PatternSnipeConfig {
  enabled: boolean;
  minConfidenceScore: number;
  maxConcurrentPatternSnipes: number;
  patternTypeFilters: string[];
  timeframeFilters: string[];
  minVolumeThreshold: number;
  maxPriceSlippage: number;
  autoExecuteEnabled: boolean;
  riskPerPattern: number; // USDT
}

export interface PatternSnipeResult {
  patternId: string;
  snipeExecuted: boolean;
  snipeId?: string;
  reason: string;
  timestamp: Date;
  executionTime?: number;
  success?: boolean;
  error?: string;
}

/**
 * Pattern-Snipe Integration Service
 * 
 * Connects pattern detection system with auto-sniping execution
 */
export class PatternSnipeIntegration extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) => console.info('[pattern-snipe-integration]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[pattern-snipe-integration]', message, context || ''),
    error: (message: string, context?: any) => console.error('[pattern-snipe-integration]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[pattern-snipe-integration]', message, context || ''),
  };

  private isActive = false;
  private config: PatternSnipeConfig;
  private autoSnipingService = getCompleteAutoSnipingService();
  
  // Pattern monitoring
  private activePatterns: Map<string, PatternDetectionEvent> = new Map();
  private patternHistory: Map<string, PatternSnipeResult> = new Map();
  private patternMetrics = {
    totalDetected: 0,
    totalExecuted: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    totalFiltered: 0,
  };

  constructor(config: Partial<PatternSnipeConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      minConfidenceScore: 75,
      maxConcurrentPatternSnipes: 3,
      patternTypeFilters: ['bullish_breakout', 'accumulation', 'reversal'],
      timeframeFilters: ['5m', '15m', '1h'],
      minVolumeThreshold: 100000, // USDT
      maxPriceSlippage: 2, // %
      autoExecuteEnabled: true,
      riskPerPattern: 50, // USDT per pattern snipe
      ...config
    };

    this.logger.info('Pattern-Snipe Integration initialized', {
      enabled: this.config.enabled,
      autoExecute: this.config.autoExecuteEnabled,
      minConfidence: this.config.minConfidenceScore,
      riskPerPattern: this.config.riskPerPattern,
    });

    this.setupEventListeners();
  }

  /**
   * Start pattern monitoring and integration
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn('Pattern-snipe integration already active');
      return;
    }

    try {
      this.logger.info('Starting pattern-snipe integration');

      // Initialize auto-sniping service if not already done
      if (!this.autoSnipingService.getStatus().isInitialized) {
        await this.autoSnipingService.initialize();
      }

      // Start pattern detection monitoring
      await this.startPatternDetectionMonitoring();

      // Start pattern cleanup
      this.startPatternCleanup();

      this.isActive = true;
      this.emit('integration_started');

      this.logger.info('Pattern-snipe integration started successfully');

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Failed to start pattern-snipe integration', safeError);
      throw safeError;
    }
  }

  /**
   * Stop pattern monitoring and integration
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping pattern-snipe integration');

      this.isActive = false;
      this.activePatterns.clear();
      
      this.emit('integration_stopped');

      this.logger.info('Pattern-snipe integration stopped');

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Failed to stop pattern-snipe integration', safeError);
      throw safeError;
    }
  }

  /**
   * Process a detected pattern
   */
  async processPattern(event: PatternDetectionEvent): Promise<PatternSnipeResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Processing pattern ${event.pattern.type} for ${event.symbol}`, {
        patternId: event.id,
        confidence: event.pattern.confidence,
        urgency: event.timing.urgency,
      });

      this.patternMetrics.totalDetected++;

      // Store pattern for tracking
      this.activePatterns.set(event.id, event);

      // Apply filters
      const filterResult = this.applyPatternFilters(event);
      if (!filterResult.passed) {
        this.patternMetrics.totalFiltered++;
        
        const result: PatternSnipeResult = {
          patternId: event.id,
          snipeExecuted: false,
          reason: filterResult.reason,
          timestamp: new Date(),
        };
        
        this.patternHistory.set(event.id, result);
        this.emit('pattern_filtered', { event, result });
        
        return result;
      }

      // Check if auto-execution is enabled
      if (!this.config.autoExecuteEnabled) {
        const result: PatternSnipeResult = {
          patternId: event.id,
          snipeExecuted: false,
          reason: 'Auto-execution disabled',
          timestamp: new Date(),
        };
        
        this.patternHistory.set(event.id, result);
        this.emit('pattern_manual_review', { event, result });
        
        return result;
      }

      // Create pattern trigger for auto-sniping
      const trigger: PatternTrigger = {
        id: event.id,
        symbol: event.symbol,
        pattern: event.pattern.type,
        confidence: event.pattern.confidence,
        timestamp: event.timing.detectedAt,
        price: event.price.current,
        volume: event.price.volume,
        metadata: {
          vcoinId: event.metadata.vcoinId,
          patternName: event.pattern.name,
          timeframe: event.pattern.timeframe,
          entryPrice: event.price.entry,
          stopLoss: event.price.stopLoss,
          takeProfit: event.price.takeProfit,
          urgency: event.timing.urgency,
          indicators: event.metadata.indicators,
        },
      };

      // Execute pattern snipe
      const snipeResult = await this.autoSnipingService.executePatternSnipe(trigger);

      this.patternMetrics.totalExecuted++;
      
      if (snipeResult.success) {
        this.patternMetrics.totalSuccessful++;
      } else {
        this.patternMetrics.totalFailed++;
      }

      const result: PatternSnipeResult = {
        patternId: event.id,
        snipeExecuted: true,
        snipeId: snipeResult.snipeId,
        reason: snipeResult.success ? 'Pattern snipe executed successfully' : 'Pattern snipe failed',
        timestamp: new Date(),
        executionTime: snipeResult.executionTime,
        success: snipeResult.success,
        error: snipeResult.error,
      };

      this.patternHistory.set(event.id, result);
      
      if (snipeResult.success) {
        this.emit('pattern_snipe_success', { event, result, snipeResult });
      } else {
        this.emit('pattern_snipe_failed', { event, result, snipeResult });
      }

      // Create snipe target record in database for tracking
      await this.createPatternSnipeTarget(event, snipeResult);

      return result;

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(`Failed to process pattern ${event.id}`, {
        patternId: event.id,
        symbol: event.symbol,
        error: safeError.message,
      });

      this.patternMetrics.totalFailed++;

      const result: PatternSnipeResult = {
        patternId: event.id,
        snipeExecuted: false,
        reason: `Processing error: ${safeError.message}`,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        error: safeError.message,
      };

      this.patternHistory.set(event.id, result);
      this.emit('pattern_error', { event, result, error: safeError });

      return result;
    }
  }

  /**
   * Get integration status and metrics
   */
  getStatus() {
    return {
      isActive: this.isActive,
      config: this.config,
      activePatterns: this.activePatterns.size,
      patternHistory: this.patternHistory.size,
      metrics: this.patternMetrics,
      autoSnipingStatus: this.autoSnipingService.getStatus(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PatternSnipeConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Pattern-snipe integration config updated', { updates });
    this.emit('config_updated', this.config);
  }

  /**
   * Get pattern history
   */
  getPatternHistory(limit = 50): PatternSnipeResult[] {
    return Array.from(this.patternHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active patterns
   */
  getActivePatterns(): PatternDetectionEvent[] {
    return Array.from(this.activePatterns.values());
  }

  /**
   * Manually execute a pattern snipe
   */
  async executePatternManually(patternId: string): Promise<PatternSnipeResult> {
    const pattern = this.activePatterns.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    this.logger.info(`Manually executing pattern snipe for ${pattern.symbol}`, {
      patternId,
      patternType: pattern.pattern.type,
    });

    // Force execution regardless of auto-execute setting
    const originalAutoExecute = this.config.autoExecuteEnabled;
    this.config.autoExecuteEnabled = true;

    try {
      const result = await this.processPattern(pattern);
      return result;
    } finally {
      this.config.autoExecuteEnabled = originalAutoExecute;
    }
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for pattern detection events from the pattern detection service
    this.on('pattern_detected', async (event: PatternDetectionEvent) => {
      if (this.isActive && this.config.enabled) {
        try {
          await this.processPattern(event);
        } catch (error) {
          this.logger.error('Failed to process detected pattern', { event, error });
        }
      }
    });

    // Listen for auto-sniping service events
    this.autoSnipingService.on('snipe_executed', (data) => {
      this.logger.info('Pattern snipe executed successfully', {
        snipeId: data.snipeId,
        symbol: data.target.symbolName,
      });
    });

    this.autoSnipingService.on('snipe_failed', (data) => {
      this.logger.warn('Pattern snipe failed', {
        snipeId: data.snipeId,
        symbol: data.target.symbolName,
        error: data.error,
      });
    });
  }

  /**
   * Start pattern detection monitoring
   */
  private async startPatternDetectionMonitoring(): Promise<void> {
    this.logger.info('Starting pattern detection monitoring');

    // This would typically integrate with a real pattern detection service
    // For now, we'll create a mock pattern detector for testing
    
    setInterval(() => {
      if (this.isActive && Math.random() < 0.05) { // 5% chance every interval
        this.generateMockPatternEvent();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Generate mock pattern event for testing
   */
  private generateMockPatternEvent(): void {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT'];
    const patterns = ['bullish_breakout', 'accumulation', 'reversal', 'momentum'];
    const timeframes = ['5m', '15m', '1h', '4h'];

    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];

    const basePrice = 45000 + Math.random() * 10000; // Mock price around $45-55k
    const confidence = 60 + Math.random() * 40; // 60-100% confidence

    const mockEvent: PatternDetectionEvent = {
      id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      pattern: {
        type: pattern,
        name: `${pattern.replace('_', ' ').toUpperCase()} Pattern`,
        confidence,
        timeframe,
        description: `${pattern} pattern detected on ${timeframe} timeframe`,
      },
      price: {
        current: basePrice,
        entry: basePrice * (1 + (Math.random() - 0.5) * 0.02), // ±1% from current
        stopLoss: basePrice * 0.95, // 5% stop loss
        takeProfit: basePrice * 1.1, // 10% take profit
        volume: 100000 + Math.random() * 500000, // Volume in USDT
      },
      timing: {
        detectedAt: new Date(),
        validUntil: new Date(Date.now() + 15 * 60 * 1000), // Valid for 15 minutes
        urgency: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
      },
      metadata: {
        vcoinId: symbol.replace('USDT', ''),
        exchange: 'MEXC',
        indicators: {
          rsi: 30 + Math.random() * 40, // RSI between 30-70
          macd: (Math.random() - 0.5) * 0.001,
          volume_ratio: 1 + Math.random() * 2, // 1-3x average volume
        },
        marketConditions: {
          trend: Math.random() > 0.5 ? 'bullish' : 'bearish',
          volatility: 'medium',
        },
      },
    };

    this.logger.debug('Generated mock pattern event', {
      patternId: mockEvent.id,
      symbol: mockEvent.symbol,
      pattern: mockEvent.pattern.type,
      confidence: mockEvent.pattern.confidence,
    });

    this.emit('pattern_detected', mockEvent);
  }

  /**
   * Apply pattern filters
   */
  private applyPatternFilters(event: PatternDetectionEvent): { passed: boolean; reason: string } {
    // Check confidence score
    if (event.pattern.confidence < this.config.minConfidenceScore) {
      return {
        passed: false,
        reason: `Confidence ${event.pattern.confidence}% below minimum ${this.config.minConfidenceScore}%`,
      };
    }

    // Check pattern type filter
    if (this.config.patternTypeFilters.length > 0 && 
        !this.config.patternTypeFilters.includes(event.pattern.type)) {
      return {
        passed: false,
        reason: `Pattern type ${event.pattern.type} not in allowed types`,
      };
    }

    // Check timeframe filter
    if (this.config.timeframeFilters.length > 0 && 
        !this.config.timeframeFilters.includes(event.pattern.timeframe)) {
      return {
        passed: false,
        reason: `Timeframe ${event.pattern.timeframe} not in allowed timeframes`,
      };
    }

    // Check volume threshold
    if (event.price.volume < this.config.minVolumeThreshold) {
      return {
        passed: false,
        reason: `Volume ${event.price.volume} below minimum ${this.config.minVolumeThreshold}`,
      };
    }

    // Check concurrent pattern snipes limit
    const activePatternSnipes = Array.from(this.activePatterns.values()).filter(
      p => p.timing.validUntil > new Date()
    ).length;

    if (activePatternSnipes >= this.config.maxConcurrentPatternSnipes) {
      return {
        passed: false,
        reason: `Maximum concurrent pattern snipes reached: ${this.config.maxConcurrentPatternSnipes}`,
      };
    }

    // Check if pattern is still valid
    if (event.timing.validUntil < new Date()) {
      return {
        passed: false,
        reason: 'Pattern validity expired',
      };
    }

    return { passed: true, reason: 'All filters passed' };
  }

  /**
   * Create snipe target record for pattern-based snipe
   */
  private async createPatternSnipeTarget(
    event: PatternDetectionEvent, 
    snipeResult: any
  ): Promise<void> {
    try {
      await db.insert(snipeTargets).values({
        userId: 'system', // Pattern-generated
        vcoinId: event.metadata.vcoinId || event.symbol.replace('USDT', ''),
        symbolName: event.symbol,
        entryStrategy: 'market',
        positionSizeUsdt: this.config.riskPerPattern,
        takeProfitCustom: ((event.price.takeProfit - event.price.entry) / event.price.entry) * 100,
        stopLossPercent: ((event.price.entry - event.price.stopLoss) / event.price.entry) * 100,
        status: snipeResult.success ? 'completed' : 'failed',
        priority: event.timing.urgency === 'critical' ? 1 : event.timing.urgency === 'high' ? 2 : 3,
        confidenceScore: event.pattern.confidence,
        riskLevel: event.timing.urgency === 'critical' ? 'high' : 'medium',
        targetExecutionTime: event.timing.detectedAt,
        actualExecutionTime: snipeResult.success ? new Date() : undefined,
        executionPrice: snipeResult.executedPrice,
        actualPositionSize: snipeResult.executedQuantity,
        executionStatus: snipeResult.success ? 'success' : 'failed',
        errorMessage: snipeResult.error,
      });

      this.logger.debug('Pattern snipe target record created', {
        patternId: event.id,
        symbol: event.symbol,
        success: snipeResult.success,
      });

    } catch (error) {
      this.logger.error('Failed to create pattern snipe target record', {
        patternId: event.id,
        error,
      });
    }
  }

  /**
   * Start pattern cleanup process
   */
  private startPatternCleanup(): void {
    setInterval(() => {
      if (this.isActive) {
        this.cleanupExpiredPatterns();
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Clean up expired patterns
   */
  private cleanupExpiredPatterns(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [patternId, pattern] of this.activePatterns) {
      if (pattern.timing.validUntil < now) {
        this.activePatterns.delete(patternId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired patterns`);
    }
  }
}

// Export singleton instance
let patternSnipeIntegration: PatternSnipeIntegration | null = null;

export function getPatternSnipeIntegration(config?: Partial<PatternSnipeConfig>): PatternSnipeIntegration {
  if (!patternSnipeIntegration) {
    patternSnipeIntegration = new PatternSnipeIntegration(config);
  }
  return patternSnipeIntegration;
}

export function resetPatternSnipeIntegration(): void {
  if (patternSnipeIntegration) {
    patternSnipeIntegration.stop();
  }
  patternSnipeIntegration = null;
}