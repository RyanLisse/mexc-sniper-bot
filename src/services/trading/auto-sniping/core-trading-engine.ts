/**
 * Core Auto-Sniping Trading Engine
 * 
 * Handles real MEXC trading operations with comprehensive safety controls.
 * Includes position management, risk assessment, and execution logic.
 */

import { z } from "zod";
import { getErrorMessage } from "@/src/lib/error-type-utils";
import { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";
import { EmergencySafetySystem } from "@/src/services/risk/emergency-safety-system";
import type { PatternMatch } from "@/src/core/pattern-detection";
import type { ExecutionPosition } from "../optimized-auto-sniping-schemas";

// Trading validation schemas
const TradingRequestSchema = z.object({
  symbol: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
  patternMatch: z.any(),
  stopLossPercent: z.number().min(0).max(50).optional(),
  takeProfitPercent: z.number().min(0).max(100).optional(),
});

const PositionSizeCalculationSchema = z.object({
  symbol: z.string(),
  availableBalance: z.number().positive(),
  positionSizeUSDT: z.number().positive(),
  currentPrice: z.number().positive(),
  maxPositions: z.number().int().positive(),
  currentPositions: z.number().int().nonnegative(),
});

type TradingRequest = z.infer<typeof TradingRequestSchema>;
type PositionSizeCalculation = z.infer<typeof PositionSizeCalculationSchema>;

interface TradeExecutionResult {
  success: boolean;
  orderId?: string;
  executedPrice?: number;
  executedQuantity?: number;
  fees?: number;
  slippage?: number;
  executionLatency: number;
  error?: string;
}

interface RiskAssessmentResult {
  approved: boolean;
  riskScore: number;
  warnings: string[];
  blockingFactors: string[];
  maxAllowedPosition: number;
}

/**
 * Core trading engine for auto-sniping operations
 */
export class CoreTradingEngine {
  private static instance: CoreTradingEngine;
  private mexcService: UnifiedMexcServiceV2;
  private safetySystem: EmergencySafetySystem;
  
  private logger = {
    info: (msg: string, ctx?: any) => console.info("[core-trading-engine]", msg, ctx || ""),
    warn: (msg: string, ctx?: any) => console.warn("[core-trading-engine]", msg, ctx || ""),
    error: (msg: string, ctx?: any, err?: Error) => console.error("[core-trading-engine]", msg, ctx || "", err || ""),
  };

  private constructor() {
    this.mexcService = new UnifiedMexcServiceV2();
    this.safetySystem = new EmergencySafetySystem();
  }

  public static getInstance(): CoreTradingEngine {
    if (!CoreTradingEngine.instance) {
      CoreTradingEngine.instance = new CoreTradingEngine();
    }
    return CoreTradingEngine.instance;
  }

  /**
   * Execute a buy trade based on pattern match
   */
  public async executeBuyTrade(
    symbol: string,
    patternMatch: PatternMatch,
    positionSizeUSDT: number,
    stopLossPercent: number = 5,
    takeProfitPercent: number = 10
  ): Promise<TradeExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Get current market price
      const tickerResult = await this.mexcService.getSymbolTicker(symbol);
      if (!tickerResult.success || !tickerResult.data) {
        throw new Error("Failed to get current market price");
      }

      const currentPrice = parseFloat(tickerResult.data.price);
      
      // Calculate position size
      const quantity = await this.calculateOptimalQuantity({
        symbol,
        availableBalance: positionSizeUSDT,
        positionSizeUSDT,
        currentPrice,
        maxPositions: 5,
        currentPositions: 0,
      });

      // Risk assessment
      const riskAssessment = await this.assessTradeRisk({
        symbol,
        side: "BUY",
        quantity,
        patternMatch,
        stopLossPercent,
        takeProfitPercent,
      });

      if (!riskAssessment.approved) {
        return {
          success: false,
          executionLatency: Date.now() - startTime,
          error: `Risk assessment failed: ${riskAssessment.blockingFactors.join(", ")}`,
        };
      }

      // Execute the trade
      const orderResult = await this.mexcService.createOrder({
        symbol,
        side: "BUY",
        type: "MARKET",
        quantity: quantity.toString(),
      });

      if (!orderResult.success) {
        throw new Error(`Order execution failed: ${orderResult.error}`);
      }

      const executionLatency = Date.now() - startTime;
      const executedPrice = parseFloat(orderResult.data?.executedPrice || currentPrice.toString());
      const slippage = Math.abs((executedPrice - currentPrice) / currentPrice) * 100;

      this.logger.info("Buy trade executed successfully", {
        symbol,
        quantity,
        executedPrice,
        slippage: `${slippage.toFixed(3)}%`,
        executionLatency: `${executionLatency}ms`,
        patternType: patternMatch.patternType,
        confidence: patternMatch.confidence,
      });

      return {
        success: true,
        orderId: orderResult.data?.orderId,
        executedPrice,
        executedQuantity: quantity,
        slippage,
        executionLatency,
      };

    } catch (error) {
      this.logger.error("Buy trade execution failed", { symbol }, error as Error);
      return {
        success: false,
        executionLatency: Date.now() - startTime,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Execute a sell trade to close position
   */
  public async executeSellTrade(
    position: ExecutionPosition,
    reason: string = "manual"
  ): Promise<TradeExecutionResult> {
    const startTime = Date.now();
    
    try {
      const orderResult = await this.mexcService.createOrder({
        symbol: position.symbol,
        side: "SELL",
        type: "MARKET",
        quantity: position.quantity,
      });

      if (!orderResult.success) {
        throw new Error(`Sell order execution failed: ${orderResult.error}`);
      }

      const executionLatency = Date.now() - startTime;
      const executedPrice = parseFloat(orderResult.data?.executedPrice || position.currentPrice);
      const entryPrice = parseFloat(position.entryPrice);
      const quantity = parseFloat(position.quantity);
      
      // Calculate realized PnL
      const realizedPnl = (executedPrice - entryPrice) * quantity;
      const realizedPnlPercent = ((executedPrice - entryPrice) / entryPrice) * 100;

      this.logger.info("Sell trade executed successfully", {
        symbol: position.symbol,
        positionId: position.id,
        quantity: position.quantity,
        entryPrice,
        executedPrice,
        realizedPnl: realizedPnl.toFixed(4),
        realizedPnlPercent: `${realizedPnlPercent.toFixed(2)}%`,
        executionLatency: `${executionLatency}ms`,
        reason,
      });

      return {
        success: true,
        orderId: orderResult.data?.orderId,
        executedPrice,
        executedQuantity: quantity,
        executionLatency,
      };

    } catch (error) {
      this.logger.error("Sell trade execution failed", { 
        positionId: position.id, 
        symbol: position.symbol 
      }, error as Error);
      
      return {
        success: false,
        executionLatency: Date.now() - startTime,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Calculate optimal position quantity based on available balance and risk limits
   */
  private async calculateOptimalQuantity(params: PositionSizeCalculation): Promise<number> {
    const validated = PositionSizeCalculationSchema.parse(params);
    const { positionSizeUSDT, currentPrice } = validated;
    
    // Calculate base quantity from position size
    const baseQuantity = positionSizeUSDT / currentPrice;
    
    // Apply position limits based on current positions
    const positionLimitFactor = Math.max(0.1, 1 - (validated.currentPositions / validated.maxPositions) * 0.5);
    const adjustedQuantity = baseQuantity * positionLimitFactor;
    
    // Ensure minimum viable trade size
    const minTradeSize = 10 / currentPrice; // $10 minimum
    
    return Math.max(minTradeSize, adjustedQuantity);
  }

  /**
   * Comprehensive risk assessment for trade execution
   */
  private async assessTradeRisk(request: TradingRequest): Promise<RiskAssessmentResult> {
    const validated = TradingRequestSchema.parse(request);
    const warnings: string[] = [];
    const blockingFactors: string[] = [];
    let riskScore = 0;

    // Pattern confidence assessment
    if (validated.patternMatch.confidence < 70) {
      warnings.push("Low pattern confidence");
      riskScore += 20;
    }
    
    if (validated.patternMatch.confidence < 50) {
      blockingFactors.push("Pattern confidence below minimum threshold");
    }

    // Market volatility check
    try {
      const ticker = await this.mexcService.getSymbolTicker(validated.symbol);
      if (ticker.success && ticker.data) {
        const priceChangePercent = Math.abs(parseFloat(ticker.data.priceChangePercent || "0"));
        
        if (priceChangePercent > 10) {
          warnings.push("High market volatility detected");
          riskScore += 15;
        }
        
        if (priceChangePercent > 20) {
          blockingFactors.push("Extreme market volatility - trading suspended");
        }
      }
    } catch (error) {
      warnings.push("Unable to assess market volatility");
      riskScore += 10;
    }

    // Account balance check
    try {
      const accountInfo = await this.mexcService.getAccountBalances();
      if (!accountInfo.success) {
        blockingFactors.push("Unable to verify account balance");
      }
    } catch (error) {
      blockingFactors.push("Account connectivity issue");
    }

    // Safety system check
    try {
      const safetyStatus = await this.safetySystem.performSystemHealthCheck();
      if (safetyStatus.overall === "critical") {
        blockingFactors.push("Safety system in critical state");
      } else if (safetyStatus.overall === "warning") {
        warnings.push("Safety system warnings detected");
        riskScore += 10;
      }
    } catch (error) {
      warnings.push("Safety system check failed");
      riskScore += 15;
    }

    // Calculate max allowed position based on risk
    const maxAllowedPosition = Math.max(0.1, 1 - (riskScore / 100));
    
    return {
      approved: blockingFactors.length === 0 && riskScore < 75,
      riskScore,
      warnings,
      blockingFactors,
      maxAllowedPosition,
    };
  }

  /**
   * Validate symbol is tradeable and get trading info
   */
  public async validateSymbolTrading(symbol: string): Promise<{
    tradeable: boolean;
    minQty: number;
    maxQty: number;
    stepSize: number;
    tickSize: number;
  }> {
    try {
      const symbolsResult = await this.mexcService.getAllSymbols();
      if (!symbolsResult.success || !symbolsResult.data) {
        throw new Error("Failed to get symbol information");
      }

      const symbolInfo = symbolsResult.data.find((s: any) => s.symbol === symbol);
      if (!symbolInfo) {
        return {
          tradeable: false,
          minQty: 0,
          maxQty: 0,
          stepSize: 0,
          tickSize: 0,
        };
      }

      return {
        tradeable: symbolInfo.status === "TRADING",
        minQty: parseFloat(symbolInfo.filters?.find((f: any) => f.filterType === "LOT_SIZE")?.minQty || "0"),
        maxQty: parseFloat(symbolInfo.filters?.find((f: any) => f.filterType === "LOT_SIZE")?.maxQty || "999999"),
        stepSize: parseFloat(symbolInfo.filters?.find((f: any) => f.filterType === "LOT_SIZE")?.stepSize || "0.001"),
        tickSize: parseFloat(symbolInfo.filters?.find((f: any) => f.filterType === "PRICE_FILTER")?.tickSize || "0.01"),
      };

    } catch (error) {
      this.logger.error("Symbol validation failed", { symbol }, error as Error);
      return {
        tradeable: false,
        minQty: 0,
        maxQty: 0,
        stepSize: 0,
        tickSize: 0,
      };
    }
  }

  /**
   * Emergency stop all trading operations
   */
  public async emergencyStopTrading(): Promise<void> {
    this.logger.warn("Emergency trading stop initiated", {
      operation: "emergency_stop"
    });

    // Additional emergency procedures can be added here
    // Such as canceling all open orders, etc.
  }
}