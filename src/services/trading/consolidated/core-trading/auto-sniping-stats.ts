/**
 * Auto-Sniping Statistics Module
 *
 * Handles metrics collection and statistics tracking for auto-sniping operations.
 * Extracted from auto-sniping.ts for better modularity.
 */

import type { ModuleContext } from "./types";

export interface AutoSnipingMetrics {
  processedTargets: number;
  successfulSnipes: number;
  failedSnipes: number;
  averageConfidence: number;
  totalVolume?: number;
  averageExecutionTime?: number;
  lastActivity?: Date;
}

export interface StatsUpdate {
  totalTrades?: number;
  successfulTrades?: number;
  failedTrades?: number;
  averageConfidence?: number;
  timestamp?: number;
  volume?: number;
  executionTime?: number;
}

export class AutoSnipingStats {
  private metrics: AutoSnipingMetrics;
  private executionTimes: number[] = [];
  private confidenceScores: number[] = [];
  private volumeHistory: number[] = [];

  constructor(private context: ModuleContext) {
    this.metrics = {
      processedTargets: 0,
      successfulSnipes: 0,
      failedSnipes: 0,
      averageConfidence: 0,
      totalVolume: 0,
      averageExecutionTime: 0,
      lastActivity: new Date(),
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): AutoSnipingMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = {
      processedTargets: 0,
      successfulSnipes: 0,
      failedSnipes: 0,
      averageConfidence: 0,
      totalVolume: 0,
      averageExecutionTime: 0,
      lastActivity: new Date(),
    };

    this.executionTimes = [];
    this.confidenceScores = [];
    this.volumeHistory = [];

    this.context.logger.info("Auto-sniping metrics reset");
  }

  /**
   * Update metrics with new data
   */
  updateStats(update: StatsUpdate): void {
    if (update.totalTrades !== undefined) {
      this.metrics.processedTargets = update.totalTrades;
    }

    if (update.successfulTrades !== undefined) {
      this.metrics.successfulSnipes = update.successfulTrades;
    }

    if (update.failedTrades !== undefined) {
      this.metrics.failedSnipes = update.failedTrades;
    }

    if (update.averageConfidence !== undefined) {
      this.confidenceScores.push(update.averageConfidence);
      this.metrics.averageConfidence = this.calculateAverageConfidence();
    }

    if (update.volume !== undefined) {
      this.volumeHistory.push(update.volume);
      this.metrics.totalVolume = this.volumeHistory.reduce(
        (sum, vol) => sum + vol,
        0
      );
    }

    if (update.executionTime !== undefined) {
      this.executionTimes.push(update.executionTime);
      this.metrics.averageExecutionTime = this.calculateAverageExecutionTime();
    }

    this.metrics.lastActivity = new Date();

    this.context.logger.debug("Auto-sniping stats updated", {
      metrics: this.metrics,
      update,
    });
  }

  /**
   * Record successful snipe
   */
  recordSuccessfulSnipe(
    confidence: number,
    volume: number,
    executionTime: number
  ): void {
    this.metrics.processedTargets++;
    this.metrics.successfulSnipes++;
    this.metrics.lastActivity = new Date();

    this.confidenceScores.push(confidence);
    this.volumeHistory.push(volume);
    this.executionTimes.push(executionTime);

    this.metrics.averageConfidence = this.calculateAverageConfidence();
    this.metrics.totalVolume = this.volumeHistory.reduce(
      (sum, vol) => sum + vol,
      0
    );
    this.metrics.averageExecutionTime = this.calculateAverageExecutionTime();

    this.context.logger.info("Successful snipe recorded", {
      confidence,
      volume,
      executionTime,
      totalSuccessful: this.metrics.successfulSnipes,
      successRate: this.getSuccessRate(),
    });
  }

  /**
   * Record failed snipe
   */
  recordFailedSnipe(reason: string, confidence?: number): void {
    this.metrics.processedTargets++;
    this.metrics.failedSnipes++;
    this.metrics.lastActivity = new Date();

    if (confidence !== undefined) {
      this.confidenceScores.push(confidence);
      this.metrics.averageConfidence = this.calculateAverageConfidence();
    }

    this.context.logger.warn("Failed snipe recorded", {
      reason,
      confidence,
      totalFailed: this.metrics.failedSnipes,
      successRate: this.getSuccessRate(),
    });
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    if (this.metrics.processedTargets === 0) return 0;
    return (
      (this.metrics.successfulSnipes / this.metrics.processedTargets) * 100
    );
  }

  /**
   * Get failure rate as percentage
   */
  getFailureRate(): number {
    if (this.metrics.processedTargets === 0) return 0;
    return (this.metrics.failedSnipes / this.metrics.processedTargets) * 100;
  }

  /**
   * Get detailed statistics report
   */
  getStatsReport(): {
    summary: AutoSnipingMetrics;
    rates: {
      successRate: number;
      failureRate: number;
    };
    trends: {
      recentConfidence: number[];
      recentVolume: number[];
      recentExecutionTimes: number[];
    };
    performance: {
      bestExecutionTime: number;
      worstExecutionTime: number;
      averageVolume: number;
      totalValue: number;
    };
  } {
    const recentLimit = 10;

    return {
      summary: this.getMetrics(),
      rates: {
        successRate: this.getSuccessRate(),
        failureRate: this.getFailureRate(),
      },
      trends: {
        recentConfidence: this.confidenceScores.slice(-recentLimit),
        recentVolume: this.volumeHistory.slice(-recentLimit),
        recentExecutionTimes: this.executionTimes.slice(-recentLimit),
      },
      performance: {
        bestExecutionTime: Math.min(...this.executionTimes) || 0,
        worstExecutionTime: Math.max(...this.executionTimes) || 0,
        averageVolume:
          this.volumeHistory.length > 0
            ? this.volumeHistory.reduce((sum, vol) => sum + vol, 0) /
              this.volumeHistory.length
            : 0,
        totalValue: this.metrics.totalVolume || 0,
      },
    };
  }

  /**
   * Calculate average confidence from stored scores
   */
  private calculateAverageConfidence(): number {
    if (this.confidenceScores.length === 0) return 0;

    const sum = this.confidenceScores.reduce((acc, score) => acc + score, 0);
    return sum / this.confidenceScores.length;
  }

  /**
   * Calculate average execution time from stored times
   */
  private calculateAverageExecutionTime(): number {
    if (this.executionTimes.length === 0) return 0;

    const sum = this.executionTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.executionTimes.length;
  }

  /**
   * Clean up old data to prevent memory leaks
   */
  cleanupOldData(maxEntries = 1000): void {
    if (this.confidenceScores.length > maxEntries) {
      this.confidenceScores = this.confidenceScores.slice(-maxEntries);
    }

    if (this.executionTimes.length > maxEntries) {
      this.executionTimes = this.executionTimes.slice(-maxEntries);
    }

    if (this.volumeHistory.length > maxEntries) {
      this.volumeHistory = this.volumeHistory.slice(-maxEntries);
    }

    this.context.logger.debug("Old statistics data cleaned up", {
      confidenceEntries: this.confidenceScores.length,
      executionTimeEntries: this.executionTimes.length,
      volumeEntries: this.volumeHistory.length,
    });
  }

  /**
   * Export stats to JSON for persistence
   */
  exportStats(): string {
    const exportData = {
      metrics: this.metrics,
      confidenceScores: this.confidenceScores,
      executionTimes: this.executionTimes,
      volumeHistory: this.volumeHistory,
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import stats from JSON
   */
  importStats(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);

      if (data.metrics) {
        this.metrics = { ...data.metrics };
      }

      if (Array.isArray(data.confidenceScores)) {
        this.confidenceScores = data.confidenceScores;
      }

      if (Array.isArray(data.executionTimes)) {
        this.executionTimes = data.executionTimes;
      }

      if (Array.isArray(data.volumeHistory)) {
        this.volumeHistory = data.volumeHistory;
      }

      this.context.logger.info("Auto-sniping stats imported successfully", {
        metricsImported: !!data.metrics,
        confidenceEntriesImported: this.confidenceScores.length,
        executionTimeEntriesImported: this.executionTimes.length,
        volumeEntriesImported: this.volumeHistory.length,
      });

      return true;
    } catch (error) {
      this.context.logger.error("Failed to import auto-sniping stats", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
