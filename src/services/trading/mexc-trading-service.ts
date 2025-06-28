/**
 * MEXC Trading Service
 *
 * Optimized service for handling MEXC trading operations with comprehensive
 * validation, risk management, and execution tracking.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import type { NewExecutionHistory } from "@/src/db/schema";
import { apiCredentials, executionHistory } from "@/src/db/schema";
import { getCachedCredentials } from "@/src/lib/credential-cache";
// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import {
  type TradingOrderRequest,
  type TradingOrderResponse,
  TradingOrderResponseSchema,
  validateMexcApiResponse,
} from "@/src/schemas/mexc-api-validation-schemas";
import type { OrderParameters } from "@/src/services/api/mexc-client-types";
import { getRecommendedMexcService } from "@/src/services/api/mexc-unified-exports";
import { transactionLockService } from "@/src/services/data/transaction-lock-service";
import { enhancedRiskManagementService } from "@/src/services/risk/enhanced-risk-management-service";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TradingContext {
  requestId: string;
  startTime: number;
  userId: string;
  skipLock: boolean;
  skipRisk: boolean;
}

export interface TradingCredentials {
  apiKey: string;
  secretKey: string;
  source: "database" | "cache";
}

export interface RiskAssessmentResult {
  approved: boolean;
  riskLevel: string;
  riskScore: number;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
  limits?: any;
  compliance?: any;
  metadata: {
    assessmentTime: string;
  };
}

export interface TradeExecutionResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  side: string;
  quantity: string;
  price?: string;
  status?: string;
  executedQty?: string;
  error?: string;
  timestamp: string;
  serviceMetrics?: {
    executionTimeMs?: number;
    cached?: boolean;
    requestId?: string;
  };
  riskMetadata?: {
    riskLevel: string;
    riskScore: number;
    assessmentTime: string;
    portfolioImpact: number;
    emergencyTrade?: boolean;
  };
}

// ============================================================================
// Main Service Class
// ============================================================================

export class MexcTradingService {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-trading-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-trading-service]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[mexc-trading-service]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-trading-service]", message, context || ""),
  };

  /**
   * Execute a trading order with comprehensive validation and risk management
   */
  async executeTrade(
    request: TradingOrderRequest
  ): Promise<
    | { success: true; data: TradingOrderResponse }
    | { success: false; error: string; code: string; details?: any }
  > {
    const context: TradingContext = {
      requestId: `trade_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      startTime: Date.now(),
      userId: request.userId,
      skipLock: false, // Always use locks for API-level trades
      skipRisk: false,
    };

    this.logger.info("[MexcTradingService] Starting trade execution", {
      requestId: context.requestId,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      userId: context.userId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Get and validate credentials
      const credentials = await this.getValidatedCredentials(context.userId, context);
      if (!credentials) {
        return {
          success: false,
          error: "No active MEXC API credentials found",
          code: "NO_CREDENTIALS",
          details: {
            message: "Please configure your MEXC API credentials in settings",
            userId: context.userId,
          },
        };
      }

      // Initialize MEXC service
      const mexcService = this.initializeMexcService(credentials, context);

      // Prepare order parameters
      const orderParams = this.prepareOrderParameters(request, context);

      // Create resource ID for locking
      const resourceId = `trade:${request.symbol}:${request.side}:${Date.now()}`;

      // Check resource lock
      const lockCheck = await this.checkResourceLock(resourceId, context);
      if (!lockCheck.success) {
        return {
          success: false,
          error: lockCheck.error || "Trade already in progress",
          code: "RESOURCE_LOCKED",
          details: lockCheck.details,
        };
      }

      // Risk assessment
      const riskAssessment = await this.performRiskAssessment(context.userId, orderParams, context);

      if (!riskAssessment.approved && !context.skipRisk) {
        return {
          success: false,
          error: "Trade blocked by risk management",
          code: "RISK_MANAGEMENT_BLOCK",
          details: {
            riskLevel: riskAssessment.riskLevel,
            riskScore: riskAssessment.riskScore,
            errors: riskAssessment.errors,
            warnings: riskAssessment.warnings,
          },
        };
      }

      // Execute trade with lock protection
      const executionResult = await this.executeTradeWithLock(
        resourceId,
        orderParams,
        mexcService,
        riskAssessment,
        context
      );

      if (!executionResult.success) {
        return {
          success: false,
          error: executionResult.error || "Trade execution failed",
          code: "EXECUTION_FAILED",
          details: executionResult,
        };
      }

      // Save execution history
      await this.saveExecutionHistory(executionResult, request, context);

      // Build and validate response
      const response: TradingOrderResponse = {
        success: executionResult.success,
        orderId: executionResult.orderId,
        symbol: executionResult.symbol,
        side: executionResult.side,
        quantity: executionResult.quantity,
        price: executionResult.price,
        status: executionResult.status,
        executedQty: executionResult.executedQty,
        timestamp: executionResult.timestamp,
      };

      // Validate response structure
      const responseValidation = validateMexcApiResponse(
        TradingOrderResponseSchema,
        response,
        "trading order"
      );

      if (!responseValidation.success) {
        this.logger.error(
          "[MexcTradingService] Response validation failed:",
          responseValidation.error
        );
        // Continue anyway but log the issue
      }

      this.logger.info("[MexcTradingService] Trade execution completed successfully", {
        requestId: context.requestId,
        orderId: response.orderId,
        symbol: response.symbol,
        duration: `${Date.now() - context.startTime}ms`,
      });

      return { success: true, data: response };
    } catch (error) {
      this.logger.error("[MexcTradingService] Unexpected error:", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${Date.now() - context.startTime}ms`,
      });

      return {
        success: false,
        error: "Trade execution failed",
        code: "TRADING_ERROR",
        details: {
          requestId: context.requestId,
          message:
            error instanceof Error
              ? error.message
              : "Unknown error occurred during trade execution",
          duration: `${Date.now() - context.startTime}ms`,
        },
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async getValidatedCredentials(
    userId: string,
    context: TradingContext
  ): Promise<TradingCredentials | null> {
    try {
      this.logger.info("[MexcTradingService] Retrieving credentials", {
        requestId: context.requestId,
        userId,
      });

      // Get API credentials from database
      const credentials = await db
        .select()
        .from(apiCredentials)
        .where(
          and(
            eq(apiCredentials.userId, userId),
            eq(apiCredentials.provider, "mexc"),
            eq(apiCredentials.isActive, true)
          )
        )
        .limit(1);

      if (!credentials[0]) {
        return null;
      }

      // Use cached credentials to reduce decryption overhead
      const { apiKey, secretKey } = await getCachedCredentials(
        userId,
        credentials[0].encryptedApiKey,
        credentials[0].encryptedSecretKey,
        credentials[0].encryptedPassphrase
      );

      this.logger.info("[MexcTradingService] Credentials retrieved successfully", {
        requestId: context.requestId,
        hasApiKey: !!apiKey,
        hasSecretKey: !!secretKey,
        source: "cache",
      });

      return { apiKey, secretKey, source: "cache" };
    } catch (error) {
      this.logger.error("[MexcTradingService] Failed to retrieve credentials:", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private initializeMexcService(credentials: TradingCredentials, context: TradingContext) {
    this.logger.info("[MexcTradingService] Initializing MEXC service", {
      requestId: context.requestId,
      credentialSource: credentials.source,
    });

    return getRecommendedMexcService({
      apiKey: credentials.apiKey,
      secretKey: credentials.secretKey,
    });
  }

  private prepareOrderParameters(
    request: TradingOrderRequest,
    context: TradingContext
  ): OrderParameters {
    const orderParams: OrderParameters = {
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      quantity: request.quantity || undefined,
      quoteOrderQty: request.quoteOrderQty || undefined,
      price: request.price || undefined,
      timeInForce: request.timeInForce || "IOC", // Immediate or Cancel for safety
    };

    this.logger.info("[MexcTradingService] Order parameters prepared", {
      requestId: context.requestId,
      symbol: orderParams.symbol,
      side: orderParams.side,
      type: orderParams.type,
      hasQuantity: !!orderParams.quantity,
      hasPrice: !!orderParams.price,
    });

    return orderParams;
  }

  private async checkResourceLock(
    resourceId: string,
    context: TradingContext
  ): Promise<{ success: boolean; error?: string; details?: any }> {
    if (context.skipLock) {
      this.logger.info("[MexcTradingService] Skipping lock check", {
        requestId: context.requestId,
        resourceId,
      });
      return { success: true };
    }

    try {
      const lockStatus = await transactionLockService.getLockStatus(resourceId);
      if (lockStatus.isLocked) {
        this.logger.info("[MexcTradingService] Resource is locked", {
          requestId: context.requestId,
          resourceId,
          queueLength: lockStatus.queueLength,
        });

        return {
          success: false,
          error: "Trade already in progress",
          details: {
            message: `Another trade is being processed. Queue position: ${lockStatus.queueLength + 1}`,
            lockStatus,
            resourceId,
          },
        };
      }

      return { success: true };
    } catch (error) {
      this.logger.error("[MexcTradingService] Lock check failed:", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: "Lock check failed",
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  private async performRiskAssessment(
    userId: string,
    orderParams: OrderParameters,
    context: TradingContext
  ): Promise<RiskAssessmentResult> {
    if (context.skipRisk) {
      this.logger.info("[MexcTradingService] Skipping risk assessment", {
        requestId: context.requestId,
      });

      return {
        approved: true,
        riskLevel: "unknown",
        riskScore: 0,
        errors: [],
        warnings: ["Risk assessment skipped"],
        metadata: {
          assessmentTime: new Date().toISOString(),
        },
      };
    }

    try {
      this.logger.info("[MexcTradingService] Performing risk assessment", {
        requestId: context.requestId,
        userId,
        symbol: orderParams.symbol,
      });

      const riskAssessment = await enhancedRiskManagementService.assessTradingRisk(
        userId,
        orderParams
      );

      this.logger.info("[MexcTradingService] Risk assessment completed", {
        requestId: context.requestId,
        approved: riskAssessment.approved,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        errorCount: riskAssessment.errors.length,
        warningCount: riskAssessment.warnings.length,
      });

      return riskAssessment;
    } catch (error) {
      this.logger.error("[MexcTradingService] Risk assessment failed:", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      // On risk assessment failure, block the trade for safety
      return {
        approved: false,
        riskLevel: "high",
        riskScore: 100,
        errors: ["Risk assessment system error"],
        warnings: [],
        metadata: {
          assessmentTime: new Date().toISOString(),
        },
      };
    }
  }

  private async executeTradeWithLock(
    resourceId: string,
    orderParams: OrderParameters,
    mexcService: any,
    riskAssessment: RiskAssessmentResult,
    context: TradingContext
  ): Promise<TradeExecutionResult> {
    const executeTrade = async (): Promise<TradeExecutionResult> => {
      try {
        this.logger.info("[MexcTradingService] Executing trade", {
          requestId: context.requestId,
          symbol: orderParams.symbol,
        });

        const orderResponse = await mexcService.placeOrder(orderParams);

        if (!orderResponse.success) {
          throw new Error(orderResponse.error || "Order placement failed");
        }

        const orderResult = orderResponse.data;

        if (!orderResult || !orderResult.success) {
          throw new Error(orderResult?.error || "Order execution failed");
        }

        return {
          success: true,
          orderId: orderResult.orderId,
          symbol: orderParams.symbol,
          side: orderParams.side,
          quantity: orderParams.quantity?.toString() || orderParams.quoteOrderQty?.toString() || "",
          price: orderParams.price?.toString(),
          status: orderResult.status,
          executedQty: orderResult.executedQty,
          timestamp: new Date().toISOString(),
          serviceMetrics: {
            executionTimeMs: orderResponse.executionTimeMs,
            cached: orderResponse.cached,
            requestId: orderResponse.requestId,
          },
          riskMetadata: {
            riskLevel: riskAssessment.riskLevel,
            riskScore: riskAssessment.riskScore,
            assessmentTime: riskAssessment.metadata.assessmentTime,
            portfolioImpact: riskAssessment.limits?.portfolioImpact || 0,
          },
        };
      } catch (error) {
        this.logger.error("[MexcTradingService] Trade execution failed:", {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          success: false,
          symbol: orderParams.symbol,
          side: orderParams.side,
          quantity: orderParams.quantity?.toString() || orderParams.quoteOrderQty?.toString() || "",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Trade execution failed",
        };
      }
    };

    // Execute with lock protection
    if (context.skipLock) {
      return await executeTrade();
    } else {
      const lockResult = await transactionLockService.executeWithLock(
        {
          resourceId,
          ownerId: context.userId,
          ownerType: "user",
          transactionType: "trade",
          transactionData: {
            symbol: orderParams.symbol,
            side: orderParams.side,
            type: orderParams.type,
          },
          timeoutMs: 30000, // 30 second timeout
          priority: orderParams.side === "SELL" ? 1 : 5, // Prioritize sells
        },
        executeTrade
      );

      if (!lockResult.success) {
        return {
          success: false,
          symbol: orderParams.symbol,
          side: orderParams.side,
          quantity: orderParams.quantity?.toString() || orderParams.quoteOrderQty?.toString() || "",
          timestamp: new Date().toISOString(),
          error: lockResult.error || "Trade execution failed",
        };
      }

      return lockResult.result as TradeExecutionResult;
    }
  }

  private async saveExecutionHistory(
    result: TradeExecutionResult,
    request: TradingOrderRequest,
    context: TradingContext
  ): Promise<void> {
    if (!result.success) {
      return; // Don't save failed executions
    }

    try {
      this.logger.info("[MexcTradingService] Saving execution history", {
        requestId: context.requestId,
        orderId: result.orderId,
      });

      const executionRecord: NewExecutionHistory = {
        userId: context.userId,
        snipeTargetId: null,
        vcoinId: request.symbol,
        symbolName: request.symbol,
        action: request.side.toLowerCase() as "buy" | "sell",
        orderType: request.type.toLowerCase(),
        orderSide: request.side.toLowerCase(),
        requestedQuantity: parseFloat(
          request.quantity?.toString() || request.quoteOrderQty?.toString() || "0"
        ),
        requestedPrice: request.price ? parseFloat(request.price.toString()) : null,
        executedQuantity: result.executedQty ? parseFloat(result.executedQty) : null,
        executedPrice: result.price ? parseFloat(result.price) : null,
        totalCost: null, // Would need to calculate from executedQty * executedPrice
        fees: null,
        exchangeOrderId: result.orderId || null,
        exchangeStatus: result.status || "filled",
        exchangeResponse: JSON.stringify(result),
        executionLatencyMs: result.serviceMetrics?.executionTimeMs || null,
        slippagePercent: null,
        status: "success",
        requestedAt: new Date(context.startTime),
        executedAt: new Date(),
      };

      await db.insert(executionHistory).values(executionRecord);

      this.logger.info("[MexcTradingService] Execution history saved", {
        requestId: context.requestId,
        orderId: result.orderId,
      });
    } catch (error) {
      this.logger.error("[MexcTradingService] Failed to save execution history:", {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the trade response if history save fails
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const mexcTradingService = new MexcTradingService();
