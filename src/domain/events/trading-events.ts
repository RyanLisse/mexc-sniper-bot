/**
 * Trading Domain Events
 * Events that represent important things that happen in the trading domain
 */

import type { DomainEvent } from "./domain-event";

// Base trading event interface
interface BaseTradingEvent extends DomainEvent {
  readonly aggregateId: string; // Trade ID or Strategy ID
  readonly userId: string;
}

// Trade Execution Events
export interface TradeExecutionStartedEvent extends BaseTradingEvent {
  readonly type: "trade.execution.started";
  readonly payload: {
    symbol: string;
    side: "BUY" | "SELL";
    orderType: "MARKET" | "LIMIT";
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    strategy?: string;
    isAutoSnipe: boolean;
    confidenceScore?: number;
  };
}

export interface TradeExecutionCompletedEvent extends BaseTradingEvent {
  readonly type: "trade.execution.completed";
  readonly payload: {
    orderId: string;
    symbol: string;
    side: "BUY" | "SELL";
    executedQuantity: string;
    executedPrice: string;
    totalCost: number;
    fees: number;
    executionTimeMs: number;
    slippagePercent?: number;
    status: "FILLED" | "PARTIALLY_FILLED";
  };
}

export interface TradeExecutionFailedEvent extends BaseTradingEvent {
  readonly type: "trade.execution.failed";
  readonly payload: {
    symbol: string;
    side: "BUY" | "SELL";
    reason: string;
    errorCode?: string;
    attemptedQuantity?: number;
    attemptedPrice?: number;
  };
}

// Position Management Events
export interface PositionOpenedEvent extends BaseTradingEvent {
  readonly type: "position.opened";
  readonly payload: {
    positionId: string;
    symbol: string;
    entryPrice: number;
    quantity: number;
    side: "LONG" | "SHORT";
    strategy: string;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    autoSnipe: boolean;
    confidenceScore?: number;
  };
}

export interface PositionClosedEvent extends BaseTradingEvent {
  readonly type: "position.closed";
  readonly payload: {
    positionId: string;
    symbol: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    realizedPnL: number;
    pnlPercentage: number;
    fees: number;
    holdingTimeMs: number;
    closedBy: "STOP_LOSS" | "TAKE_PROFIT" | "MANUAL" | "STRATEGY";
  };
}

export interface PositionModifiedEvent extends BaseTradingEvent {
  readonly type: "position.modified";
  readonly payload: {
    positionId: string;
    symbol: string;
    changes: {
      stopLossPercent?: { from: number; to: number };
      takeProfitPercent?: { from: number; to: number };
      quantity?: { from: number; to: number };
    };
    modifiedBy: "USER" | "STRATEGY" | "RISK_MANAGEMENT";
  };
}

// Auto-Sniping Events
export interface AutoSnipeTriggeredEvent extends BaseTradingEvent {
  readonly type: "auto_snipe.triggered";
  readonly payload: {
    targetId: number;
    symbol: string;
    confidenceScore: number;
    positionSizeUsdt: number;
    triggeredBy: "PATTERN_DETECTION" | "MANUAL" | "SCHEDULED";
    triggerConditions: string[];
  };
}

export interface AutoSnipeExecutedEvent extends BaseTradingEvent {
  readonly type: "auto_snipe.executed";
  readonly payload: {
    targetId: number;
    symbol: string;
    executionResult: {
      success: boolean;
      orderId?: string;
      executedPrice?: number;
      executedQuantity?: number;
      error?: string;
    };
    confidenceScore: number;
    executionLatencyMs: number;
  };
}

// Strategy Events
export interface TradingStrategyActivatedEvent extends BaseTradingEvent {
  readonly type: "strategy.activated";
  readonly payload: {
    strategyId: string;
    strategyName: string;
    symbols: string[];
    parameters: Record<string, any>;
    activatedBy: "USER" | "SYSTEM" | "SCHEDULED";
  };
}

export interface TradingStrategyDeactivatedEvent extends BaseTradingEvent {
  readonly type: "strategy.deactivated";
  readonly payload: {
    strategyId: string;
    strategyName: string;
    reason: string;
    deactivatedBy: "USER" | "SYSTEM" | "RISK_MANAGEMENT";
    finalMetrics: {
      totalTrades: number;
      successRate: number;
      totalPnL: number;
      maxDrawdown: number;
    };
  };
}

export interface StrategyPerformanceUpdatedEvent extends BaseTradingEvent {
  readonly type: "strategy.performance.updated";
  readonly payload: {
    strategyId: string;
    strategyName: string;
    metrics: {
      totalTrades: number;
      successfulTrades: number;
      successRate: number;
      totalPnL: number;
      unrealizedPnL: number;
      maxDrawdown: number;
      sharpeRatio?: number;
      averageExecutionTime: number;
    };
    timeframe: "1h" | "24h" | "7d" | "30d";
  };
}

// Risk Management Events
export interface RiskLimitExceededEvent extends BaseTradingEvent {
  readonly type: "risk.limit.exceeded";
  readonly payload: {
    limitType: "POSITION_SIZE" | "DAILY_LOSS" | "DRAWDOWN" | "EXPOSURE";
    currentValue: number;
    limitValue: number;
    action: "BLOCK_TRADES" | "CLOSE_POSITIONS" | "REDUCE_SIZE" | "ALERT_ONLY";
    affectedPositions?: string[];
  };
}

export interface CircuitBreakerTriggeredEvent extends BaseTradingEvent {
  readonly type: "circuit_breaker.triggered";
  readonly payload: {
    reason: string;
    failureCount: number;
    threshold: number;
    blockedUntil: Date;
    affectedOperations: string[];
  };
}

// Profit Target Events
export interface ProfitTargetReachedEvent extends BaseTradingEvent {
  readonly type: "profit_target.reached";
  readonly payload: {
    positionId: string;
    symbol: string;
    targetLevel: number;
    targetPercentage: number;
    currentPnL: number;
    currentPnLPercentage: number;
    action: "PARTIAL_CLOSE" | "FULL_CLOSE" | "TRAILING_STOP";
    executedQuantity?: number;
  };
}

// Union type of all trading events
export type TradingDomainEvent =
  | TradeExecutionStartedEvent
  | TradeExecutionCompletedEvent
  | TradeExecutionFailedEvent
  | PositionOpenedEvent
  | PositionClosedEvent
  | PositionModifiedEvent
  | AutoSnipeTriggeredEvent
  | AutoSnipeExecutedEvent
  | TradingStrategyActivatedEvent
  | TradingStrategyDeactivatedEvent
  | StrategyPerformanceUpdatedEvent
  | RiskLimitExceededEvent
  | CircuitBreakerTriggeredEvent
  | ProfitTargetReachedEvent;

// Event creation helpers
export class TradingEventFactory {
  static createTradeExecutionStarted(
    tradeId: string,
    userId: string,
    payload: TradeExecutionStartedEvent["payload"]
  ): TradeExecutionStartedEvent {
    return {
      type: "trade.execution.started",
      aggregateId: tradeId,
      userId,
      payload,
      occurredAt: new Date(),
      eventId: `trade-exec-start-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  static createTradeExecutionCompleted(
    tradeId: string,
    userId: string,
    payload: TradeExecutionCompletedEvent["payload"]
  ): TradeExecutionCompletedEvent {
    return {
      type: "trade.execution.completed",
      aggregateId: tradeId,
      userId,
      payload,
      occurredAt: new Date(),
      eventId: `trade-exec-complete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  static createPositionOpened(
    positionId: string,
    userId: string,
    payload: PositionOpenedEvent["payload"]
  ): PositionOpenedEvent {
    return {
      type: "position.opened",
      aggregateId: positionId,
      userId,
      payload,
      occurredAt: new Date(),
      eventId: `position-open-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  static createAutoSnipeTriggered(
    targetId: string,
    userId: string,
    payload: AutoSnipeTriggeredEvent["payload"]
  ): AutoSnipeTriggeredEvent {
    return {
      type: "auto_snipe.triggered",
      aggregateId: targetId,
      userId,
      payload,
      occurredAt: new Date(),
      eventId: `auto-snipe-trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  static createRiskLimitExceeded(
    aggregateId: string,
    userId: string,
    payload: RiskLimitExceededEvent["payload"]
  ): RiskLimitExceededEvent {
    return {
      type: "risk.limit.exceeded",
      aggregateId,
      userId,
      payload,
      occurredAt: new Date(),
      eventId: `risk-limit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }
}