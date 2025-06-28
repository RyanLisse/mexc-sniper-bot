/**
 * Trading Metrics Collector
 * 
 * Specialized metrics collection for trading operations with real-time
 * performance tracking, profitability analysis, and risk monitoring.
 * 
 * Phase 3 Enhancement Features:
 * - Real-time P&L tracking
 * - Trade execution success rates
 * - Market timing analysis
 * - Risk exposure monitoring
 * - Pattern detection effectiveness
 */

import { metrics, trace } from '@opentelemetry/api';
import { enhancedPerformanceMonitor } from './enhanced-performance-monitor';

export interface TradeExecutionMetrics {
  symbol: string;
  executionTime: number;
  slippage: number;
  fillRate: number;
  success: boolean;
  orderType: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
}

export interface PatternDetectionMetrics {
  symbol: string;
  patternType: string;
  confidence: number;
  processingTime: number;
  accuracy?: number;
  historicalPerformance?: number;
}

export interface RiskMetrics {
  portfolioExposure: number;
  maxDrawdown: number;
  valueAtRisk: number;
  stopLossHitRate: number;
  positionSizing: number;
}

export interface MarketDataMetrics {
  latency: number;
  dataQuality: number;
  missedUpdates: number;
  websocketUptime: number;
}

/**
 * Trading Metrics Collector
 * Comprehensive metrics collection for trading system performance
 */
export class TradingMetricsCollector {
  private meter = metrics.getMeter('trading-metrics', '1.0.0');
  private tracer = trace.getTracer('trading-metrics', '1.0.0');

  // Trading-specific counters and histograms
  private tradesCounter = this.meter.createCounter('trades_total', {
    description: 'Total number of trades executed',
  });

  private pnlGauge = this.meter.createUpDownCounter('pnl_total', {
    description: 'Total profit and loss',
    unit: 'USD',
  });

  private executionLatencyHistogram = this.meter.createHistogram('trade_execution_latency_ms', {
    description: 'Trade execution latency in milliseconds',
    unit: 'ms',
  });

  private slippageHistogram = this.meter.createHistogram('trade_slippage_bp', {
    description: 'Trade slippage in basis points',
    unit: 'bp',
  });

  private patternAccuracyHistogram = this.meter.createHistogram('pattern_accuracy_percent', {
    description: 'Pattern detection accuracy percentage',
    unit: 'percent',
  });

  private riskExposureGauge = this.meter.createUpDownCounter('risk_exposure_percent', {
    description: 'Current risk exposure as percentage of portfolio',
    unit: 'percent',
  });

  private marketDataLatencyHistogram = this.meter.createHistogram('market_data_latency_ms', {
    description: 'Market data latency in milliseconds',
    unit: 'ms',
  });

  private readonly metricsCache = new Map<string, any>();
  private readonly realtimeMetrics = {
    totalTrades: 0,
    successfulTrades: 0,
    totalPnL: 0,
    currentExposure: 0,
    averageExecutionTime: 0,
    averageSlippage: 0,
  };

  /**
   * Record trade execution metrics
   */
  recordTradeExecution(metrics: TradeExecutionMetrics): void {
    const span = this.tracer.startSpan('trading.execution.record');
    
    try {
      // Update counters
      this.tradesCounter.add(1, {
        symbol: metrics.symbol,
        side: metrics.side,
        order_type: metrics.orderType,
        success: metrics.success.toString(),
      });

      // Record execution latency
      this.executionLatencyHistogram.record(metrics.executionTime, {
        symbol: metrics.symbol,
        order_type: metrics.orderType,
      });

      // Record slippage
      this.slippageHistogram.record(metrics.slippage, {
        symbol: metrics.symbol,
        side: metrics.side,
      });

      // Update real-time metrics
      this.realtimeMetrics.totalTrades++;
      if (metrics.success) {
        this.realtimeMetrics.successfulTrades++;
      }

      // Calculate rolling averages
      this.realtimeMetrics.averageExecutionTime = 
        (this.realtimeMetrics.averageExecutionTime * 0.9) + (metrics.executionTime * 0.1);
      
      this.realtimeMetrics.averageSlippage = 
        (this.realtimeMetrics.averageSlippage * 0.9) + (metrics.slippage * 0.1);

      // Cache for reporting
      this.metricsCache.set(`trade_${Date.now()}`, metrics);

      // Track with enhanced performance monitor
      enhancedPerformanceMonitor.trackTradingExecution(
        'trade_execution',
        async () => metrics,
        {
          symbol: metrics.symbol,
          order_type: metrics.orderType,
          side: metrics.side,
        }
      );

      span.setAttributes({
        'trading.symbol': metrics.symbol,
        'trading.execution_time': metrics.executionTime,
        'trading.slippage': metrics.slippage,
        'trading.success': metrics.success,
      });

    } finally {
      span.end();
    }
  }

  /**
   * Record pattern detection performance
   */
  recordPatternDetection(metrics: PatternDetectionMetrics): void {
    const span = this.tracer.startSpan('pattern.detection.record');
    
    try {
      // Record accuracy
      this.patternAccuracyHistogram.record(metrics.confidence, {
        symbol: metrics.symbol,
        pattern_type: metrics.patternType,
      });

      // Track processing time
      enhancedPerformanceMonitor.trackPatternDetection(
        metrics.processingTime,
        metrics.confidence,
        1 // single symbol
      );

      span.setAttributes({
        'pattern.symbol': metrics.symbol,
        'pattern.type': metrics.patternType,
        'pattern.confidence': metrics.confidence,
        'pattern.processing_time': metrics.processingTime,
      });

    } finally {
      span.end();
    }
  }

  /**
   * Update P&L metrics
   */
  updatePnL(pnl: number, symbol: string): void {
    this.pnlGauge.add(pnl, {
      symbol,
    });

    this.realtimeMetrics.totalPnL += pnl;
  }

  /**
   * Update risk exposure metrics
   */
  updateRiskExposure(exposure: number): void {
    this.riskExposureGauge.add(exposure - this.realtimeMetrics.currentExposure, {
      timestamp: Date.now().toString(),
    });

    this.realtimeMetrics.currentExposure = exposure;
  }

  /**
   * Record market data quality metrics
   */
  recordMarketDataMetrics(metrics: MarketDataMetrics): void {
    this.marketDataLatencyHistogram.record(metrics.latency, {
      data_quality: metrics.dataQuality.toString(),
    });

    enhancedPerformanceMonitor.trackWebSocketLatency(metrics.latency, 'market_data');
  }

  /**
   * Get trading performance summary
   */
  getTradingPerformanceSummary(): {
    execution: {
      totalTrades: number;
      successRate: number;
      averageExecutionTime: number;
      averageSlippage: number;
    };
    profitability: {
      totalPnL: number;
      profitableTrades: number;
      averagePnL: number;
      maxDrawdown: number;
    };
    risk: {
      currentExposure: number;
      maxExposure: number;
      riskScore: number;
    };
    patterns: {
      detectionsToday: number;
      averageConfidence: number;
      successRate: number;
    };
  } {
    const trades = this.realtimeMetrics.totalTrades;
    const successfulTrades = this.realtimeMetrics.successfulTrades;
    
    return {
      execution: {
        totalTrades: trades,
        successRate: trades > 0 ? (successfulTrades / trades) * 100 : 0,
        averageExecutionTime: this.realtimeMetrics.averageExecutionTime,
        averageSlippage: this.realtimeMetrics.averageSlippage,
      },
      profitability: {
        totalPnL: this.realtimeMetrics.totalPnL,
        profitableTrades: this.getProfitableTradesCount(),
        averagePnL: trades > 0 ? this.realtimeMetrics.totalPnL / trades : 0,
        maxDrawdown: this.calculateMaxDrawdown(),
      },
      risk: {
        currentExposure: this.realtimeMetrics.currentExposure,
        maxExposure: this.calculateMaxExposure(),
        riskScore: this.calculateRiskScore(),
      },
      patterns: {
        detectionsToday: this.getPatternDetectionsToday(),
        averageConfidence: this.calculateAveragePatternConfidence(),
        successRate: this.calculatePatternSuccessRate(),
      },
    };
  }

  /**
   * Get real-time trading metrics for dashboard
   */
  getRealtimeMetrics(): typeof this.realtimeMetrics {
    return { ...this.realtimeMetrics };
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const data = {
      timestamp: new Date().toISOString(),
      performance: this.getTradingPerformanceSummary(),
      realtime: this.getRealtimeMetrics(),
      cached_trades: Array.from(this.metricsCache.entries())
        .filter(([key]) => key.startsWith('trade_'))
        .slice(-100), // Last 100 trades
    };

    if (format === 'csv') {
      // Convert to CSV format (simplified)
      const csv = [
        'timestamp,total_trades,success_rate,total_pnl,current_exposure',
        `${data.timestamp},${data.performance.execution.totalTrades},${data.performance.execution.successRate},${data.performance.profitability.totalPnL},${data.performance.risk.currentExposure}`
      ].join('\n');
      return csv;
    }

    return JSON.stringify(data, null, 2);
  }

  // Private helper methods
  private getProfitableTradesCount(): number {
    return Array.from(this.metricsCache.entries())
      .filter(([key, trade]) => key.startsWith('trade_') && trade.pnl > 0)
      .length;
  }

  private calculateMaxDrawdown(): number {
    // Simplified calculation - would need historical P&L data for accurate calculation
    return Math.abs(Math.min(0, this.realtimeMetrics.totalPnL));
  }

  private calculateMaxExposure(): number {
    // Would track maximum exposure over time
    return this.realtimeMetrics.currentExposure;
  }

  private calculateRiskScore(): number {
    // Risk score from 0-100 based on multiple factors
    const exposureScore = Math.min(100, this.realtimeMetrics.currentExposure);
    const drawdownScore = Math.min(100, this.calculateMaxDrawdown() / 100);
    return Math.max(0, 100 - (exposureScore + drawdownScore) / 2);
  }

  private getPatternDetectionsToday(): number {
    const today = new Date().toDateString();
    return Array.from(this.metricsCache.entries())
      .filter(([key, data]) => 
        key.startsWith('pattern_') && 
        new Date(data.timestamp).toDateString() === today
      ).length;
  }

  private calculateAveragePatternConfidence(): number {
    const patterns = Array.from(this.metricsCache.entries())
      .filter(([key]) => key.startsWith('pattern_'))
      .map(([, data]) => data.confidence);
    
    return patterns.length > 0 
      ? patterns.reduce((sum, conf) => sum + conf, 0) / patterns.length 
      : 0;
  }

  private calculatePatternSuccessRate(): number {
    // Would need to track pattern outcomes vs predictions
    return 0; // Placeholder - requires historical tracking
  }
}

// Global instance
export const tradingMetricsCollector = new TradingMetricsCollector();