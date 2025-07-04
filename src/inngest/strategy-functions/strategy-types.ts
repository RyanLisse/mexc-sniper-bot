/**
 * Multi-Phase Strategy Types
 *
 * Shared type definitions for multi-phase trading strategy workflows.
 * Extracted from multi-phase-strategy-functions.ts for better modularity.
 */

// Strategy analysis result interface
export interface StrategyAnalysisResult {
  strategy: TradingStrategy;
  analytics: {
    executionTrend?: string;
    progress?: number;
    [key: string]: unknown;
  };
  performanceMetrics: {
    totalPnlPercent?: number;
    successRate?: number;
    totalTrades?: number;
    [key: string]: unknown;
  };
  currentPhases: number;
  totalPhases: number;
  efficiency: string;
}

// Strategy recommendation result interface
export interface StrategyRecommendationResult {
  recommendedStrategy: {
    name: string;
    description: string;
    levels: any[];
  };
  riskAssessment: {
    riskLevel: string;
    timeHorizon: string;
    suitabilityScore: number;
  };
  alternativeStrategies: Array<{
    name: string;
    description: string;
    levels: any[];
  }>;
  executionGuidance: {
    optimalEntryConditions: string[];
    monitoringPoints: string[];
    riskManagement: string[];
  };
  reasoning: string;
}

// Trading strategy interface (imported from service)
export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  type: string;
  parameters: Record<string, any>;
  phases: StrategyPhase[];
  createdAt: string;
  updatedAt: string;
}

// Strategy phase interface
export interface StrategyPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  riskParameters: Record<string, any>;
}

// Market data interface
export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
  [key: string]: unknown;
}

// Strategy creation input interface
export interface StrategyCreationInput {
  userId: string;
  symbol: string;
  marketData: MarketData;
  riskTolerance: "low" | "medium" | "high";
  timeframe: string;
  capital: number;
  preferences?: Record<string, any>;
}

// Strategy optimization input interface
export interface StrategyOptimizationInput {
  strategyId: string;
  userId: string;
  marketData: MarketData;
  performanceData: Record<string, any>;
  constraints?: Record<string, any>;
}

// Strategy execution input interface
export interface StrategyExecutionInput {
  strategyId: string;
  userId: string;
  symbol: string;
  marketData: MarketData;
  executionParameters?: Record<string, any>;
}

// Type guard functions
export function isStrategyAnalysisResult(
  value: unknown
): value is StrategyAnalysisResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).strategy === "object" &&
    typeof (value as any).analytics === "object" &&
    typeof (value as any).performanceMetrics === "object" &&
    typeof (value as any).currentPhases === "number" &&
    typeof (value as any).totalPhases === "number" &&
    typeof (value as any).efficiency === "string"
  );
}

export function isStrategyRecommendationResult(
  value: unknown
): value is StrategyRecommendationResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).recommendedStrategy === "object" &&
    typeof (value as any).riskAssessment === "object" &&
    Array.isArray((value as any).alternativeStrategies) &&
    typeof (value as any).executionGuidance === "object" &&
    typeof (value as any).reasoning === "string"
  );
}

export function isTradingStrategy(value: unknown): value is TradingStrategy {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).id === "string" &&
    typeof (value as any).name === "string" &&
    typeof (value as any).description === "string" &&
    typeof (value as any).type === "string" &&
    typeof (value as any).parameters === "object" &&
    Array.isArray((value as any).phases)
  );
}

export function isMarketData(value: unknown): value is MarketData {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).symbol === "string" &&
    typeof (value as any).price === "number" &&
    typeof (value as any).volume === "number" &&
    typeof (value as any).timestamp === "number"
  );
}

// Strategy execution status enum
export enum StrategyExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

// Risk level enum
export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  EXTREME = "extreme",
}

// Timeframe enum
export enum Timeframe {
  MINUTE_1 = "1m",
  MINUTE_5 = "5m",
  MINUTE_15 = "15m",
  HOUR_1 = "1h",
  HOUR_4 = "4h",
  DAY_1 = "1d",
  WEEK_1 = "1w",
}

// Strategy pattern types
export enum StrategyPatternType {
  MOMENTUM = "momentum",
  REVERSAL = "reversal",
  BREAKOUT = "breakout",
  SCALPING = "scalping",
  SWING = "swing",
  ARBITRAGE = "arbitrage",
}

// Error types for strategy operations
export class StrategyError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = "StrategyError";
  }
}

export class StrategyValidationError extends StrategyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "VALIDATION_ERROR", context);
    this.name = "StrategyValidationError";
  }
}

export class StrategyExecutionError extends StrategyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "EXECUTION_ERROR", context);
    this.name = "StrategyExecutionError";
  }
}

export class StrategyOptimizationError extends StrategyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "OPTIMIZATION_ERROR", context);
    this.name = "StrategyOptimizationError";
  }
}
