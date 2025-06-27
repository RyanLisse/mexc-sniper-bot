/**
 * Optimized MEXC Trading Service
 *
 * Streamlined trading service with comprehensive validation and error handling.
 * Replaces the 615-line mexc-trading-service.ts with optimized, focused implementation.
 * Under 500 lines with proper Zod validation and TypeScript safety.
 */

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCachedCredentials } from "@/src/lib/credential-cache";
import { getErrorMessage, toSafeError } from "@/src/lib/error-type-utils";
import { db } from "@/src/db";
import type { NewExecutionHistory } from "@/src/db/schema";
import { apiCredentials, executionHistory } from "@/src/db/schema";
import type { OrderParameters } from "./api/mexc-client-types";
import { enhancedRiskManagementService } from "../risk/enhanced-risk-management-service";
import { getRecommendedMexcService } from "../api/mexc-unified-exports";
import {
  type TradingOrderRequest,
  type TradingOrderResponse,
  validateTradingOrderRequest,
  validateTradingOrderResponse,
} from "./optimized-auto-sniping-schemas";
import { transactionLockService } from "../data/transaction-lock-service";

// ============================================================================
// Schemas and Types
// ============================================================================

const TradingContextSchema = z.object({
  requestId: z.string(),
  startTime: z.number(),
  userId: z.string(),
  skipLock: z.boolean().default(false),
  skipRisk: z.boolean().default(false),
});

const TradingCredentialsSchema = z.object({
  apiKey: z.string().min(1),
  secretKey: z.string().min(1),
  source: z.enum(["database", "cache"]),
});

const RiskAssessmentResultSchema = z.object({
  approved: z.boolean(),
  riskLevel: z.string(),
  riskScore: z.number().min(0).max(100),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendations: z.array(z.string()).optional(),
  limits: z.any().optional(),
  compliance: z.any().optional(),
  metadata: z.object({
    assessmentTime: z.string(),
  }),
});

const TradeExecutionResultSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  symbol: z.string(),
  side: z.string(),
  quantity: z.string(),
  price: z.string().optional(),
  status: z.string().optional(),
  executedQty: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
  serviceMetrics: z
    .object({
      executionTimeMs: z.number().optional(),
      cached: z.boolean().optional(),
      requestId: z.string().optional(),
    })
    .optional(),
  riskMetadata: z
    .object({
      riskLevel: z.string(),
      riskScore: z.number(),
      assessmentTime: z.string(),
      portfolioImpact: z.number(),
      emergencyTrade: z.boolean().optional(),
    })
    .optional(),
});

type TradingContext = z.infer<typeof TradingContextSchema>;
type TradingCredentials = z.infer<typeof TradingCredentialsSchema>;
type RiskAssessmentResult = z.infer<typeof RiskAssessmentResultSchema>;
type TradeExecutionResult = z.infer<typeof TradeExecutionResultSchema>;

// ============================================================================
// Optimized Trading Service
// ============================================================================

export class OptimizedMexcTradingService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[optimized-mexc-trading]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[optimized-mexc-trading]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[optimized-mexc-trading]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[optimized-mexc-trading]", message, context || ""),
  };

  /**
   * Execute trading order with comprehensive validation and risk management
   */
  async executeTrade(
    request: unknown
  ): Promise<
    | { success: true; data: TradingOrderResponse }
    | { success: false; error: string; code: string; details?: any }
  > {
    // Validate request
    const validatedRequest = validateTradingOrderRequest(request);

    const context = TradingContextSchema.parse({
      requestId: `trade_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      startTime: Date.now(),
      userId: validatedRequest.userId,
      skipLock: false,
      skipRisk: false,
    });

    console.info("Starting optimized trade execution", {
      requestId: context.requestId,
      symbol: validatedRequest.symbol,
      side: validatedRequest.side,
      type: validatedRequest.type,
      userId: context.userId,
    });

    try {
      // Get validated credentials
      const credentials = await this.getValidatedCredentials(context.userId, context);
      if (!credentials) {
        return this.createErrorResponse("NO_CREDENTIALS", "No active MEXC API credentials found", {
          message: "Please configure your MEXC API credentials in settings",
          userId: context.userId,
        });
      }

      // Initialize services and prepare order
      const mexcService = this.initializeMexcService(credentials, context);
      const orderParams = this.prepareOrderParameters(validatedRequest, context);
      const resourceId = `trade:${validatedRequest.symbol}:${validatedRequest.side}:${Date.now()}`;

      // Check locks and assess risk
      const lockCheck = await this.checkResourceLock(resourceId, context);
      if (!lockCheck.success) {
        return this.createErrorResponse(
          "RESOURCE_LOCKED",
          lockCheck.error || "Trade already in progress",
          lockCheck.details
        );
      }

      const riskAssessment = await this.performRiskAssessment(context.userId, orderParams, context);
      if (!riskAssessment.approved && !context.skipRisk) {
        return this.createErrorResponse(
          "RISK_MANAGEMENT_BLOCK",
          "Trade blocked by risk management",
          {
            riskLevel: riskAssessment.riskLevel,
            riskScore: riskAssessment.riskScore,
            errors: riskAssessment.errors,
            warnings: riskAssessment.warnings,
          }
        );
      }

      // Execute trade
      const executionResult = await this.executeTradeWithLock(
        resourceId,
        orderParams,
        mexcService,
        riskAssessment,
        context
      );

      if (!executionResult.success) {
        return this.createErrorResponse(
          "EXECUTION_FAILED",
          executionResult.error || "Trade execution failed",
          executionResult
        );
      }

      // Save history and build response
      await this.saveExecutionHistory(executionResult, validatedRequest, context);
      const response = this.buildTradingResponse(executionResult);

      console.info("Trade execution completed successfully", {
        requestId: context.requestId,
        orderId: response.orderId,
        symbol: response.symbol,
        duration: `${Date.now() - context.startTime}ms`,
      });

      return { success: true, data: response };
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "Unexpected trade execution error",
        {
          requestId: context.requestId,
          error: safeError.message,
          duration: `${Date.now() - context.startTime}ms`,
        },
        error
      );

      return this.createErrorResponse("TRADING_ERROR", "Trade execution failed", {
        requestId: context.requestId,
        message: safeError.message,
        duration: `${Date.now() - context.startTime}ms`,
      });
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
      console.info("Retrieving credentials", {
        requestId: context.requestId,
        userId,
      });

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

      if (!credentials[0]) return null;

      const { apiKey, secretKey } = await getCachedCredentials(
        userId,
        credentials[0].encryptedApiKey,
        credentials[0].encryptedSecretKey,
        credentials[0].encryptedPassphrase
      );

      const result = TradingCredentialsSchema.parse({
        apiKey,
        secretKey,
        source: "cache",
      });

      console.info("Credentials retrieved successfully", {
        requestId: context.requestId,
        hasApiKey: !!result.apiKey,
        hasSecretKey: !!result.secretKey,
        source: result.source,
      });

      return result;
    } catch (error) {
      console.error("Failed to retrieve credentials", {
        requestId: context.requestId,
        error: getErrorMessage(error),
      });
      return null;
    }
  }

  private initializeMexcService(credentials: TradingCredentials, context: TradingContext) {
    console.info("Initializing MEXC service", {
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

    console.info("Order parameters prepared", {
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
      return { success: true };
    }

    try {
      const lockStatus = await transactionLockService.getLockStatus(resourceId);
      if (lockStatus.isLocked) {
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
      console.error("Lock check failed", {
        requestId: context.requestId,
        error: getErrorMessage(error),
      });
      return {
        success: false,
        error: "Lock check failed",
        details: { error: getErrorMessage(error) },
      };
    }
  }

  private async performRiskAssessment(
    userId: string,
    orderParams: OrderParameters,
    context: TradingContext
  ): Promise<RiskAssessmentResult> {
    if (context.skipRisk) {
      return RiskAssessmentResultSchema.parse({
        approved: true,
        riskLevel: "unknown",
        riskScore: 0,
        errors: [],
        warnings: ["Risk assessment skipped"],
        metadata: {
          assessmentTime: new Date().toISOString(),
        },
      });
    }

    try {
      console.info("Performing risk assessment", {
        requestId: context.requestId,
        userId,
        symbol: orderParams.symbol,
      });

      const riskAssessment = await enhancedRiskManagementService.assessTradingRisk(
        userId,
        orderParams
      );

      const result = RiskAssessmentResultSchema.parse(riskAssessment);

      console.info("Risk assessment completed", {
        requestId: context.requestId,
        approved: result.approved,
        riskLevel: result.riskLevel,
        riskScore: result.riskScore,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      console.error("Risk assessment failed", {
        requestId: context.requestId,
        error: getErrorMessage(error),
      });

      // On risk assessment failure, block the trade for safety
      return RiskAssessmentResultSchema.parse({
        approved: false,
        riskLevel: "high",
        riskScore: 100,
        errors: ["Risk assessment system error"],
        warnings: [],
        metadata: {
          assessmentTime: new Date().toISOString(),
        },
      });
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
        console.info("Executing trade", {
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

        return TradeExecutionResultSchema.parse({
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
        });
      } catch (error) {
        console.error("Trade execution failed", {
          requestId: context.requestId,
          error: getErrorMessage(error),
        });

        return TradeExecutionResultSchema.parse({
          success: false,
          symbol: orderParams.symbol,
          side: orderParams.side,
          quantity: orderParams.quantity?.toString() || orderParams.quoteOrderQty?.toString() || "",
          timestamp: new Date().toISOString(),
          error: getErrorMessage(error),
        });
      }
    };

    // Execute with or without lock protection
    if (context.skipLock) {
      return await executeTrade();
    }

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
        timeoutMs: 30000,
        priority: orderParams.side === "SELL" ? 1 : 5,
      },
      executeTrade
    );

    if (!lockResult.success) {
      return TradeExecutionResultSchema.parse({
        success: false,
        symbol: orderParams.symbol,
        side: orderParams.side,
        quantity: orderParams.quantity?.toString() || orderParams.quoteOrderQty?.toString() || "",
        timestamp: new Date().toISOString(),
        error: lockResult.error || "Trade execution failed",
      });
    }

    return lockResult.result as TradeExecutionResult;
  }

  private async saveExecutionHistory(
    result: TradeExecutionResult,
    request: TradingOrderRequest,
    context: TradingContext
  ): Promise<void> {
    if (!result.success) return;

    try {
      console.info("Saving execution history", {
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
        totalCost: null,
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

      console.info("Execution history saved", {
        requestId: context.requestId,
        orderId: result.orderId,
      });
    } catch (error) {
      console.error("Failed to save execution history", {
        requestId: context.requestId,
        error: getErrorMessage(error),
      });
    }
  }

  private buildTradingResponse(result: TradeExecutionResult): TradingOrderResponse {
    const response: TradingOrderResponse = {
      success: result.success,
      orderId: result.orderId,
      symbol: result.symbol,
      side: result.side,
      quantity: result.quantity,
      price: result.price,
      status: result.status,
      executedQty: result.executedQty,
      timestamp: result.timestamp,
    };

    return validateTradingOrderResponse(response);
  }

  private createErrorResponse(
    code: string,
    error: string,
    details?: any
  ): { success: false; error: string; code: string; details?: any } {
    return {
      success: false,
      error,
      code,
      details,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const optimizedMexcTradingService = new OptimizedMexcTradingService();
