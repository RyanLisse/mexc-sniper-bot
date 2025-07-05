/**
 * Core Trading Service - Type Definitions and Schemas
 *
 * Centralized type definitions for the modular core trading system.
 * Extracted from the original monolithic implementation for better maintainability.
 */

import { z } from "zod";
import type { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import type { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";
import type { ComprehensiveSafetyCoordinator } from "@/src/services/risk/comprehensive-safety-coordinator";

// ============================================================================
// Core Configuration Types
// ============================================================================

export interface CoreTradingConfig {
  // API Configuration
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;

  // User Configuration
  userId?: string;

  // Trading Configuration
  enablePaperTrading: boolean;
  paperTradingMode: boolean;
  defaultStrategy: string;
  maxConcurrentPositions: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerResetTime: number;
  positionManagementEnabled: boolean;

  // Auto-Sniping Configuration
  autoSnipingEnabled: boolean;
  snipeCheckInterval: number;
  confidenceThreshold: number;
  maxConcurrentSnipes: number;

  // Risk Management Configuration
  maxPositionSize?: number;
  globalStopLossPercent?: number;
  globalTakeProfitPercent?: number;
  maxDailyLoss?: number;
  riskManagement: {
    stopLossEnabled: boolean;
    takeProfitEnabled: boolean;
    priceCheckInterval: number;
    maxDailyLossPercent?: number;
    maxPositionRiskPercent?: number;
    emergencyStopEnabled?: boolean;
  };

  // Cache Configuration
  enableCaching: boolean;
  cacheTTL: number;
}

export const CoreTradingConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  secretKey: z.string().min(1, "Secret key is required"),
  baseUrl: z.string().url().optional(),
  timeout: z.number().positive().optional(),
  maxRetries: z.number().positive().optional(),
  userId: z.string().optional(),
  enablePaperTrading: z.boolean().default(true),
  defaultStrategy: z.string().default("conservative"),
  maxConcurrentPositions: z.number().positive().default(5),
  enableCircuitBreaker: z.boolean().default(true),
  circuitBreakerThreshold: z.number().positive().default(5),
  circuitBreakerResetTime: z.number().positive().default(300000), // 5 minutes
  paperTradingMode: z.boolean().default(true),
  positionManagementEnabled: z.boolean().default(true),
  maxConcurrentSnipes: z.number().positive().default(10),
  autoSnipingEnabled: z.boolean().default(false),
  snipeCheckInterval: z.number().positive().default(30000), // 30 seconds
  confidenceThreshold: z.number().min(0).max(100).default(75),
  maxPositionSize: z.number().positive().optional(),
  globalStopLossPercent: z.number().positive().optional(),
  globalTakeProfitPercent: z.number().positive().optional(),
  maxDailyLoss: z.number().positive().optional(),
  riskManagement: z
    .object({
      stopLossEnabled: z.boolean().default(true),
      takeProfitEnabled: z.boolean().default(true),
      priceCheckInterval: z.number().positive().default(5000),
      maxDailyLossPercent: z.number().positive().optional(),
      maxPositionRiskPercent: z.number().positive().optional(),
      emergencyStopEnabled: z.boolean().default(true),
    })
    .default({
      stopLossEnabled: true,
      takeProfitEnabled: true,
      priceCheckInterval: 5000,
      emergencyStopEnabled: true,
    }),
  enableCaching: z.boolean().default(true),
  cacheTTL: z.number().positive().default(60000), // 1 minute
});

// ============================================================================
// Trading Parameter Types
// ============================================================================

export interface TradeParameters {
  symbol: string;
  side: "BUY" | "SELL" | "buy" | "sell";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT";
  quantity?: number;
  quoteOrderQty?: number;
  price?: number;
  targetPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
  newClientOrderId?: string;

  // Enhanced parameters
  strategy?: string;
  isAutoSnipe?: boolean;
  confidenceScore?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;

  // Trade persistence parameters
  snipeTargetId?: string;
  vcoinId?: string;
}

export const TradeParametersSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP_LIMIT"]),
  quantity: z.number().positive().optional(),
  quoteOrderQty: z.number().positive().optional(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
  newClientOrderId: z.string().optional(),
  strategy: z.string().optional(),
  isAutoSnipe: z.boolean().optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  stopLossPercent: z.number().positive().optional(),
  takeProfitPercent: z.number().positive().optional(),
  snipeTargetId: z.string().optional(),
  vcoinId: z.string().optional(),
});

// ============================================================================
// Trade Result Types
// ============================================================================

export interface TradeResult {
  success: boolean;
  orderId?: string | null;
  clientOrderId?: string;
  symbol?: string;
  side?: string;
  type?: string;
  quantity?: string;
  price?: string;
  status?: string;
  executedPrice?: number;
  executedQuantity?: number;
  executedQty?: string;
  cummulativeQuoteQty?: string;
  fees?: number;
  timestamp?: Date | string;
  autoSnipe?: boolean;
  confidenceScore?: number;
  paperTrade?: boolean;
  simulatedPrice?: number;
  error?: Error | string;
  executionTime?: number;
  data?: any;
}

// ============================================================================
// Position Management Types
// ============================================================================

export interface Position {
  id: string;
  symbol: string;
  side: "BUY" | "SELL" | "buy" | "sell";
  orderId: string;
  clientOrderId?: string;
  entryPrice: number;
  quantity: number;
  currentPrice?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: string;
  status: "open" | "closed" | "partially_filled";
  openTime: Date;
  closeTime?: Date;
  strategy: string;
  confidenceScore?: number;
  autoSnipe?: boolean;
  paperTrade?: boolean;
  realizedPnL?: number;
  unrealizedPnL?: number;
  pnlPercentage?: number;
  fees?: number;
  notes?: string;
  tags: string[];

  // Enhanced risk metrics
  riskMetrics?: {
    valueAtRisk: number;
    expectedShortfall: number;
    volatility: number;
    beta: number;
    sharpeRatio: number;
    maxFavorableExcursion: number;
    maxAdverseExcursion: number;
  };
}

// ============================================================================
// Multi-Phase Trading Types
// ============================================================================

export interface MultiPhaseConfig {
  symbol: string;
  totalAmount: number;
  strategy: string;
  phaseCount: number;
  phaseDelayMs: number;
  phaseAllocation?: number[];
}

export interface MultiPhaseResult {
  success: boolean;
  totalPhases: number;
  completedPhases: number;
  strategy: string;
  phases: Array<{
    phaseId: number;
    status: "executing" | "completed" | "failed";
    allocation: number;
    executionTime: Date;
    result?: TradeResult;
  }>;
  totalExecuted: number;
  averagePrice?: number;
  totalFees: number;
  executionTimeMs: number;
}

// ============================================================================
// Strategy Types
// ============================================================================

export interface TradingStrategy {
  name: string;
  description: string;
  maxPositionSize: number;
  positionSizingMethod: "fixed" | "kelly" | "percentage";
  stopLossPercent: number;
  takeProfitPercent: number;
  maxDrawdownPercent: number;
  orderType: "MARKET" | "LIMIT";
  timeInForce: "GTC" | "IOC" | "FOK";
  slippageTolerance: number;
  enableMultiPhase: boolean;
  phaseCount: number;
  phaseDelayMs: number;
  confidenceThreshold: number;
  enableAutoSnipe: boolean;
  snipeDelayMs: number;
  enableTrailingStop: boolean;
  trailingStopPercent?: number;
  enablePartialTakeProfit: boolean;
  partialTakeProfitPercent?: number;
}

// ============================================================================
// Performance Analytics Types
// ============================================================================

export interface PerformanceMetrics {
  // Trading Statistics
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;

  // Financial Performance
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalVolume: number;
  averageTradeSize: number;

  // Risk Metrics
  maxDrawdown: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;

  // Execution Metrics
  averageExecutionTime: number;
  slippageAverage: number;
  fillRate: number;

  // Auto-Sniping Metrics
  autoSnipeCount: number;
  autoSnipeSuccessRate: number;
  averageConfidenceScore: number;

  // Time-based Metrics
  timeframe: string;
  startDate: Date;
  endDate: Date;
  tradingDays: number;

  // Strategy Performance
  strategyPerformance: Record<
    string,
    {
      trades: number;
      successRate: number;
      averagePnL: number;
      maxDrawdown: number;
    }
  >;
}

// ============================================================================
// Service Status Types
// ============================================================================

export interface ServiceStatus {
  // Service Health
  isHealthy: boolean;
  isConnected: boolean;
  isAuthenticated: boolean;

  // Trading Status
  tradingEnabled: boolean;
  autoSnipingEnabled: boolean;
  paperTradingMode: boolean;

  // Position Status
  activePositions: number;
  maxPositions: number;
  availableCapacity: number;

  // Circuit Breaker Status
  circuitBreakerOpen: boolean;
  circuitBreakerFailures: number;
  circuitBreakerResetTime?: Date | null;

  // Performance Status
  lastTradeTime?: Date;
  averageResponseTime: number;
  cacheHitRate: number;

  // Risk Status
  currentRiskLevel: "low" | "medium" | "high" | "critical";
  dailyPnL: number;
  dailyVolume: number;

  // System Status
  uptime: number;
  lastHealthCheck: Date;
  version: string;
}

// Extended interface for frontend-specific status data
export interface ExtendedServiceStatus extends ServiceStatus {
  // Frontend-specific fields
  status?: string;
  targetCounts?: {
    memory: number;
    database: number;
    unified: number;
    isConsistent: boolean;
    source: string;
    warning?: string;
  };
  stateConsistency?: {
    isConsistent: boolean;
    inconsistencies: string[];
    recommendedActions: string[];
    lastSyncTime: string;
  };
  executedToday?: number;
  successRate?: number;
  totalProfit?: number;
  lastExecution?: string;
  safetyStatus?: string;
  patternDetectionActive?: boolean;
  executionCount?: number;
  successCount?: number;
  errorCount?: number;
  readyTargets?: number;
  activeTargets?: number;
  config?: {
    maxConcurrentTargets?: number;
    retryAttempts?: number;
    executionDelay?: number;
  };
}

export const ServiceStatusSchema = z.object({
  isHealthy: z.boolean(),
  isConnected: z.boolean(),
  isAuthenticated: z.boolean(),
  tradingEnabled: z.boolean(),
  autoSnipingEnabled: z.boolean(),
  paperTradingMode: z.boolean(),
  activePositions: z.number().nonnegative(),
  maxPositions: z.number().positive(),
  availableCapacity: z.number().min(0).max(1),
  circuitBreakerOpen: z.boolean(),
  circuitBreakerFailures: z.number().nonnegative(),
  circuitBreakerResetTime: z.date().nullable().optional(),
  lastTradeTime: z.date().optional(),
  averageResponseTime: z.number().nonnegative(),
  cacheHitRate: z.number().min(0).max(100),
  currentRiskLevel: z.enum(["low", "medium", "high", "critical"]),
  dailyPnL: z.number(),
  dailyVolume: z.number().nonnegative(),
  uptime: z.number().nonnegative(),
  lastHealthCheck: z.date(),
  version: z.string(),
});

// ============================================================================
// Auto-Sniping Types
// ============================================================================

// Use the database schema for AutoSnipeTarget with extended properties for processing
import type { SnipeTarget } from "@/src/db/schemas/supabase-auth";

export interface AutoSnipeTarget extends SnipeTarget {
  // Mapped properties for trading processing
  symbol: string; // Maps to symbolName
  side?: "BUY" | "SELL" | "buy" | "sell"; // Defaults to "buy"
  orderType?: "MARKET" | "LIMIT" | "STOP_LIMIT"; // Maps to entryStrategy
  quantity: number; // Maps to positionSizeUsdt
  amount: number; // Alias for quantity for compatibility
  price?: number; // Maps to entryPrice
  targetPrice?: number; // Maps to entryPrice
  stopLoss?: number; // Calculated from stopLossPercent
  takeProfit?: number; // Calculated from takeProfitLevel/takeProfitCustom
  takeProfitPercent?: number; // Maps to takeProfitCustom from database
  timeInForce?: "GTC" | "IOC" | "FOK"; // Default "GTC"
  strategy?: {
    name: string;
    type: string;
    parameters: Record<string, string | number | boolean>;
    metadata?: Record<string, string | number>;
  }; // Trading strategy object
  confidence: number; // Maps to confidenceScore
  scheduledAt?: string | null; // Maps to targetExecutionTime
  executedAt?: string | null; // Maps to actualExecutionTime
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status?: string;
  finalStatus?: string;
  timestamp?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Event Types
// ============================================================================

export interface CoreTradingEvents {
  trade_executed: [result: TradeResult];
  position_opened: [position: Position];
  position_closed: [position: Position];
  auto_snipe_executed: [data: { target: AutoSnipeTarget; result: TradeResult }];
  circuit_breaker_triggered: [data: { reason: string; timestamp: Date }];
  strategy_changed: [data: { oldStrategy: string; newStrategy: string }];
  performance_updated: [metrics: PerformanceMetrics];
  error_occurred: [error: Error];
}

// ============================================================================
// Internal Module Types
// ============================================================================

export interface ModuleContext {
  config: CoreTradingConfig;
  mexcService: UnifiedMexcServiceV2;
  safetyCoordinator?: ComprehensiveSafetyCoordinator;
  manualTradingModule?: {
    executeTrade: (params: TradeParameters) => Promise<TradeResult>;
  };
  tradingStrategy: {
    closePosition: (
      positionId: string,
      reason: string
    ) => Promise<ServiceResponse<any>>;
  };
  orderExecutor: {
    executePaperSnipe: (params: TradeParameters) => Promise<TradeResult>;
    executeRealSnipe: (params: TradeParameters) => Promise<TradeResult>;
    createPositionEntry: (
      params: TradeParameters,
      result: TradeResult
    ) => Promise<Position>;
  };
  positionManager: {
    setupPositionMonitoring: (
      position: Position,
      result: TradeResult
    ) => Promise<void>;
    updatePositionStopLoss: (
      positionId: string,
      newStopLoss: number
    ) => Promise<ServiceResponse<void>>;
    updatePositionTakeProfit: (
      positionId: string,
      newTakeProfit: number
    ) => Promise<ServiceResponse<void>>;
    getActivePositions: () => Map<string, Position>;
    createPositionEntry: (
      tradeParams: any,
      symbol: string,
      stopLoss?: any,
      takeProfit?: any
    ) => Promise<Position>;
  };
  marketDataService: {
    getCurrentPrice: (symbol: string) => Promise<{ price: number } | null>;
  };
  logger: {
    info: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
    debug: (message: string, context?: Record<string, unknown>) => void;
  };
  eventEmitter: BrowserCompatibleEventEmitter;
}

export interface ModuleState {
  isInitialized: boolean;
  isHealthy: boolean;
  lastActivity: Date;
  metrics: Record<string, number> & {
    strategyPerformance?: Record<
      string,
      {
        trades: number;
        successRate: number;
        averagePnL: number;
        maxDrawdown: number;
        totalVolume: number;
      }
    >;
    portfolioRiskMetrics?: {
      concentrationRisk: number;
      correlationRisk: number;
      portfolioBeta: number;
      diversificationRatio: number;
      maxDrawdownPercent: number;
    };
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateConfig(config: unknown): CoreTradingConfig {
  return CoreTradingConfigSchema.parse(config) as CoreTradingConfig;
}

export function validateTradeParams(params: unknown): TradeParameters {
  return TradeParametersSchema.parse(params) as TradeParameters;
}

export function validateServiceStatus(status: unknown): ServiceStatus {
  return ServiceStatusSchema.parse(status) as ServiceStatus;
}
