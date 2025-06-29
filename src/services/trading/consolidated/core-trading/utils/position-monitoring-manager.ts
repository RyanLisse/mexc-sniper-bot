/**
 * Position Monitoring Manager
 * 
 * Eliminates redundancy between stop-loss and take-profit monitoring.
 * Consolidates common position monitoring logic into reusable methods.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { ModuleContext, Position, TradeParameters } from "../types";

interface MonitoringConfig {
  checkInterval: number;
  maxRetries: number;
  onTrigger: (position: Position, triggerType: 'stop-loss' | 'take-profit') => Promise<void>;
  onError: (error: Error, position: Position, triggerType: 'stop-loss' | 'take-profit') => void;
  getCurrentPrice: (symbol: string) => Promise<number | null>;
}

export class PositionMonitoringManager {
  private pendingTimers = new Map<string, NodeJS.Timeout>();
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Setup monitoring for both stop-loss and take-profit
   */
  setupPositionMonitoring(position: Position): void {
    if (position.stopLossPrice) {
      this.setupStopLossMonitoring(position);
    }

    if (position.takeProfitPrice) {
      this.setupTakeProfitMonitoring(position);
    }
  }

  /**
   * Setup stop-loss monitoring for a position
   */
  setupStopLossMonitoring(position: Position): void {
    const monitoringKey = `${position.id}-stop-loss`;
    this.setupPriceMonitoring(position, 'stop-loss', monitoringKey, (currentPrice) => {
      if (position.side === "BUY") {
        return currentPrice <= (position.stopLossPrice || 0);
      }
      return currentPrice >= (position.stopLossPrice || 0);
    });
  }

  /**
   * Setup take-profit monitoring for a position
   */
  setupTakeProfitMonitoring(position: Position): void {
    const monitoringKey = `${position.id}-take-profit`;
    this.setupPriceMonitoring(position, 'take-profit', monitoringKey, (currentPrice) => {
      if (position.side === "BUY") {
        return currentPrice >= (position.takeProfitPrice || 0);
      }
      return currentPrice <= (position.takeProfitPrice || 0);
    });
  }

  /**
   * Generic price monitoring setup - eliminates duplication
   */
  private setupPriceMonitoring(
    position: Position,
    triggerType: 'stop-loss' | 'take-profit',
    monitoringKey: string,
    shouldTrigger: (currentPrice: number) => boolean
  ): void {
    const monitor = async () => {
      try {
        const currentPrice = await this.config.getCurrentPrice(position.symbol);
        if (!currentPrice) {
          // Retry monitoring if price fetch fails
          this.scheduleNextCheck(monitoringKey, monitor);
          return;
        }

        // Update position current price
        position.currentPrice = currentPrice;

        if (shouldTrigger(currentPrice)) {
          // Remove timer before triggering
          this.clearMonitoring(monitoringKey);
          await this.config.onTrigger(position, triggerType);
        } else {
          // Continue monitoring
          this.scheduleNextCheck(monitoringKey, monitor);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.config.onError(safeError, position, triggerType);
        
        // Continue monitoring despite errors
        this.scheduleNextCheck(monitoringKey, monitor);
      }
    };

    // Start monitoring
    this.scheduleNextCheck(monitoringKey, monitor);
  }

  /**
   * Schedule the next monitoring check
   */
  private scheduleNextCheck(monitoringKey: string, monitor: () => Promise<void>): void {
    const timer = setTimeout(monitor, this.config.checkInterval);
    this.pendingTimers.set(monitoringKey, timer);
  }

  /**
   * Clear monitoring for a specific key
   */
  clearMonitoring(monitoringKey: string): void {
    const timer = this.pendingTimers.get(monitoringKey);
    if (timer) {
      clearTimeout(timer);
      this.pendingTimers.delete(monitoringKey);
    }
  }

  /**
   * Clear all monitoring for a position
   */
  clearPositionMonitoring(positionId: string): void {
    this.clearMonitoring(`${positionId}-stop-loss`);
    this.clearMonitoring(`${positionId}-take-profit`);
  }

  /**
   * Clear all active monitoring timers
   */
  clearAllMonitoring(): void {
    this.pendingTimers.forEach((timer) => clearTimeout(timer));
    this.pendingTimers.clear();
  }

  /**
   * Update stop-loss monitoring for a position
   */
  updateStopLossMonitoring(position: Position, newStopLossPercent: number): void {
    // Clear existing stop-loss monitoring
    this.clearMonitoring(`${position.id}-stop-loss`);

    // Update stop-loss price
    position.stopLossPercent = newStopLossPercent;
    if (newStopLossPercent > 0) {
      if (position.side === "BUY") {
        position.stopLossPrice = position.entryPrice * (1 - newStopLossPercent / 100);
      } else {
        position.stopLossPrice = position.entryPrice * (1 + newStopLossPercent / 100);
      }

      // Setup new monitoring
      this.setupStopLossMonitoring(position);
    } else {
      position.stopLossPrice = undefined;
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    activeMonitors: number;
    stopLossMonitors: number;
    takeProfitMonitors: number;
  } {
    const activeMonitors = this.pendingTimers.size;
    let stopLossMonitors = 0;
    let takeProfitMonitors = 0;

    for (const key of this.pendingTimers.keys()) {
      if (key.includes('-stop-loss')) {
        stopLossMonitors++;
      } else if (key.includes('-take-profit')) {
        takeProfitMonitors++;
      }
    }

    return {
      activeMonitors,
      stopLossMonitors,
      takeProfitMonitors,
    };
  }
}