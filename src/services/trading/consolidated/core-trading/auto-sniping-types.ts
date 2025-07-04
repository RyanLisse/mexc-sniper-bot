/**
 * Auto-Sniping Module Types
 *
 * Type definitions for auto-sniping functionality.
 * Extracted from auto-sniping.ts for better modularity.
 */

import type {
  AutoSnipeTarget,
  CoreTradingConfig,
  ModuleContext,
  ModuleState,
  Position,
  ServiceResponse,
  TradeParameters,
  TradeResult,
  TradingStrategy,
} from "./types";

// Extended strategy interface for multi-phase strategies
export interface MultiPhaseStrategy extends TradingStrategy {
  id: string;
  levels: Array<{
    percentage: number;
    action: string;
    delay?: number;
  }>;
}

// Statistics interface for updateStats method
export interface StatsUpdate {
  totalTrades?: number;
  successfulTrades?: number;
  failedTrades?: number;
  averageConfidence?: number;
  timestamp?: number;
}

// Position monitoring context
export interface PositionMonitoringContext {
  symbol: string;
  strategyId: string;
  entryPrice: number;
  totalQuantity: number;
  remainingQuantity: number;
  originalOrderId: string;
  levels: Array<{
    percentage: number;
    action: string;
    delay?: number;
  }>;
  executedLevels: number[];
  createdAt: string;
}

// Trade info for strategy setup
export interface TradeInfo {
  entryPrice: number;
  quantity: number;
  orderId: string;
}

// Auto-sniping module status
export interface AutoSnipingStatus {
  isActive: boolean;
  isHealthy: boolean;
  lastSnipeCheck: Date | null;
  processedTargets: number;
  successfulSnipes: number;
  failedSnipes: number;
  successRate: number;
}

// Module statistics
export interface ModuleStats {
  activePositions: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  totalPnL: number;
  averagePnL: number;
  pendingStopLosses: number;
  pendingTakeProfits: number;
  timestamp: number;
}

// Re-export main types
export type {
  AutoSnipeTarget,
  CoreTradingConfig,
  ModuleContext,
  ModuleState,
  Position,
  ServiceResponse,
  TradeParameters,
  TradeResult,
  TradingStrategy,
};
