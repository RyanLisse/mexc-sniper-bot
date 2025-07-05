import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/src/db";
import type { NewExecutionHistory } from "@/src/db/schemas/supabase-trading";
import { apiCredentials, executionHistory } from "@/src/db/schemas/supabase-trading";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
} from "@/src/lib/api-response";
import { getCachedCredentials } from "@/src/lib/credential-cache";
import type { OrderParameters } from "@/src/services/api/mexc-client-types";
import { getRecommendedMexcService } from "@/src/services/api/mexc-unified-exports";
import { transactionLockService } from "@/src/services/data/transaction-lock-service";
import { enhancedRiskManagementService } from "@/src/services/risk/enhanced-risk-management-service";

// Risk metadata interface
interface RiskMetadata {
  riskLevel: string;
  riskScore: number;
  assessmentTime: string;
  portfolioImpact: number;
  emergencyTrade?: boolean;
}

// Extended order parameters interface
interface OrderParametersWithRisk extends OrderParameters {
  riskMetadata?: RiskMetadata;
}

// MEXC order response interface
interface MexcOrderResponse {
  success: boolean;
  executedQty?: string;
  orderId?: string;
  clientOrderId?: string;
  transactTime?: number;
  price?: string;
  origQty?: string;
  status?: string;
  timeInForce?: string;
  type?: string;
  side?: string;
  fills?: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
  cached?: boolean;
  requestId?: string;
  timestamp?: string;
  data?: unknown;
  error?: string;
}

// Create logger at module level like other working routes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      symbol,
      side,
      type,
      quantity,
      price,
      userId,
      snipeTargetId,
      skipLock,
    } = body;

    if (!userId) {
      return apiResponse(
        createErrorResponse("User ID required"),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Get API credentials from database
    const credentials = await db
      .select({
        id: apiCredentials.id,
        encryptedApiKey: apiCredentials.encryptedApiKey,
        encryptedSecretKey: apiCredentials.encryptedSecretKey,
        encryptedPassphrase: apiCredentials.encryptedPassphrase,
        userId: apiCredentials.userId,
        provider: apiCredentials.provider,
        isActive: apiCredentials.isActive,
      })
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
      return apiResponse(
        createErrorResponse("No active MEXC API credentials found", {
          message: "Please configure your MEXC API credentials in settings",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // PERFORMANCE OPTIMIZATION: Use cached credentials to reduce decryption overhead
    const { apiKey, secretKey } = await getCachedCredentials(
      userId,
      credentials[0].encryptedApiKey,
      credentials[0].encryptedSecretKey,
      credentials[0].encryptedPassphrase
    );

    // Validate required parameters
    if (!symbol || !side || !type || !quantity) {
      return apiResponse(
        createErrorResponse("Missing required trading parameters", {
          message: "Symbol, side, type, and quantity are required",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    console.info(`🚀 Trading API: Processing ${side} order for ${symbol}`);

    // Create resource ID for locking
    const resourceId = `trade:${symbol}:${side}:${snipeTargetId || "manual"}`;

    // Skip lock for certain operations (e.g., emergency sells)
    if (skipLock) {
      console.info(`⚠️ Skipping lock for ${resourceId} (skipLock=true)`);
    } else {
      // Check if resource is already locked
      const lockStatus = await transactionLockService.getLockStatus(resourceId);
      if (lockStatus.isLocked) {
        console.info(
          `🔒 Resource ${resourceId} is locked. Queue length: ${lockStatus.queueLength}`
        );
        return apiResponse(
          createErrorResponse("Trade already in progress", {
            message: `Another trade for ${symbol} ${side} is being processed. Queue position: ${lockStatus.queueLength + 1}`,
            lockStatus,
          }),
          HTTP_STATUS.CONFLICT
        );
      }
    }

    // Initialize service layer
    const mexcService = getRecommendedMexcService({
      apiKey,
      secretKey,
    });

    // Prepare order parameters
    const orderParams: OrderParameters = {
      symbol,
      side: side.toUpperCase() as "BUY" | "SELL",
      type: type.toUpperCase() as "LIMIT" | "MARKET",
      quantity: quantity.toString(),
      ...(price && { price: price.toString() }),
      timeInForce: "IOC", // Immediate or Cancel for safety
    };

    // Enhanced Risk Assessment (if not skipped)
    if (!skipLock) {
      console.info(
        `🎯 Risk Assessment: Evaluating trade risk for ${userId} - ${symbol} ${side}`
      );

      try {
        const riskAssessment =
          await enhancedRiskManagementService.assessTradingRisk(
            userId,
            orderParams
          );

        console.info(`🎯 Risk Assessment Result:`, {
          approved: riskAssessment.approved,
          riskLevel: riskAssessment.riskLevel,
          riskScore: riskAssessment.riskScore,
          errors: riskAssessment.errors.length,
          warnings: riskAssessment.warnings.length,
        });

        if (!riskAssessment.approved) {
          return apiResponse(
            createErrorResponse("Trade blocked by risk management", {
              message: "Trade does not meet risk management criteria",
              code: "RISK_MANAGEMENT_BLOCK",
              riskAssessment: {
                riskLevel: riskAssessment.riskLevel,
                riskScore: riskAssessment.riskScore,
                errors: riskAssessment.errors,
                warnings: riskAssessment.warnings,
                recommendations: riskAssessment.recommendations,
                limits: riskAssessment.limits,
                compliance: riskAssessment.compliance,
              },
            }),
            HTTP_STATUS.FORBIDDEN
          );
        }

        // Log warnings even for approved trades
        if (riskAssessment.warnings.length > 0) {
          console.warn(
            `⚠️ Risk Management Warnings for ${symbol}:`,
            riskAssessment.warnings
          );
        }

        // Add risk metadata to order for tracking
        (orderParams as OrderParametersWithRisk).riskMetadata = {
          riskLevel: riskAssessment.riskLevel,
          riskScore: riskAssessment.riskScore,
          assessmentTime: riskAssessment.metadata.assessmentTime,
          portfolioImpact: riskAssessment.limits.portfolioImpact,
        };
      } catch (riskError) {
        console.error(`❌ Risk Assessment Failed for ${symbol}:`, {
          error:
            riskError instanceof Error ? riskError.message : String(riskError),
        });

        // On risk assessment failure, block the trade for safety
        return apiResponse(
          createErrorResponse("Risk assessment system error", {
            message: "Unable to assess trade risk - blocking for safety",
            code: "RISK_ASSESSMENT_ERROR",
            details:
              riskError instanceof Error
                ? riskError.message
                : "Unknown risk assessment error",
          }),
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    } else {
      console.info(`⚠️ Risk Assessment: Skipped for ${symbol} (skipLock=true)`);

      // Add minimal risk metadata for emergency trades
      (orderParams as OrderParametersWithRisk).riskMetadata = {
        riskLevel: "unknown",
        riskScore: 0,
        assessmentTime: new Date().toISOString(),
        portfolioImpact: 0,
        emergencyTrade: true,
      };
    }

    // Execute with lock protection
    const executeTrade = async () => {
      // Place order via service layer (includes validation and balance checks)
      const orderResponse = await mexcService.placeOrder(orderParams);

      if (!orderResponse.success) {
        throw new Error(orderResponse.error || "Order placement failed");
      }

      // Service layer returns ServiceResponse<OrderResult>, we need the OrderResult
      const orderResult = orderResponse.data;

      if (!orderResult) {
        throw new Error("Order result is missing from response");
      }

      if (!orderResult.success) {
        throw new Error(orderResult.error || "Order execution failed");
      }

      return {
        ...orderResult,
        serviceMetrics: {
          executionTimeMs: orderResponse.executionTimeMs,
          cached: orderResponse.cached,
          requestId: orderResponse.requestId,
        },
      };
    };

    // Execute with or without lock
    let result: MexcOrderResponse;
    if (skipLock) {
      result = await executeTrade();
    } else {
      const lockResult = await transactionLockService.executeWithLock(
        {
          resourceId,
          ownerId: userId,
          ownerType: "user",
          transactionType: "trade",
          transactionData: {
            symbol,
            side,
            type,
            quantity,
            price,
            snipeTargetId,
          },
          timeoutMs: 30000, // 30 second timeout
          priority: side.toUpperCase() === "SELL" ? 1 : 5, // Prioritize sells
        },
        executeTrade
      );

      if (!lockResult.success) {
        return apiResponse(
          createErrorResponse(lockResult.error || "Trade execution failed", {
            message: "Trade execution failed",
            lockId: lockResult.lockId,
            executionTimeMs: lockResult.executionTimeMs,
          }),
          HTTP_STATUS.BAD_REQUEST
        );
      }

      result = lockResult.result;
    }

    const orderResult = result as {
      success: boolean;
      error?: string;
      [key: string]: unknown;
    };

    if (orderResult.success) {
      console.info(`✅ Trading order executed successfully:`, orderResult);

      // Save execution history
      try {
        const orderData = orderResult as MexcOrderResponse; // Type assertion for MEXC order response
        const executionRecord: NewExecutionHistory = {
          userId,
          snipeTargetId: snipeTargetId || null,
          vcoinId: body.vcoinId || symbol,
          symbolName: symbol,
          action: side.toLowerCase() as "buy" | "sell",
          orderType: type.toLowerCase(),
          orderSide: side.toLowerCase(),
          requestedQuantity: parseFloat(quantity),
          requestedPrice: price ? parseFloat(price) : null,
          executedQuantity: orderData.executedQty
            ? parseFloat(orderData.executedQty)
            : parseFloat(quantity),
          executedPrice: orderData.price ? parseFloat(orderData.price) : null,
          totalCost: orderData.cummulativeQuoteQty
            ? parseFloat(orderData.cummulativeQuoteQty)
            : null,
          fees: orderData.fee ? parseFloat(orderData.fee) : null,
          exchangeOrderId: orderData.orderId?.toString() || null,
          exchangeStatus: orderData.status || "filled",
          exchangeResponse: JSON.stringify(orderResult),
          executionLatencyMs: orderData.transactTime
            ? Date.now() - Number(orderData.transactTime)
            : null,
          slippagePercent:
            price && orderData.price
              ? ((parseFloat(orderData.price) - parseFloat(price)) /
                  parseFloat(price)) *
                100
              : null,
          status: "success",
          requestedAt: new Date(),
          executedAt: orderData.transactTime
            ? new Date(Number(orderData.transactTime))
            : new Date(),
        };

        await db.insert(executionHistory).values(executionRecord);
        console.info(
          `📝 Execution history saved for order ${orderResult.orderId}`
        );
      } catch (error) {
        console.error("Failed to save execution history:", { error: error });
        // Don't fail the trade response if history save fails
      }

      return apiResponse(
        createSuccessResponse(orderResult, {
          message: "Order placed successfully",
        }),
        HTTP_STATUS.CREATED
      );
    } else {
      console.error(`❌ Trading order failed:`, orderResult);

      return apiResponse(
        createErrorResponse(orderResult.error || "Order placement failed", {
          message: "Order placement failed",
          details: orderResult,
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }
  } catch (error) {
    console.error("Trading API Error:", { error: error });

    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
