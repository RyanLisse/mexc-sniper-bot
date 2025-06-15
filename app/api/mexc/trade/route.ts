import { NextRequest, NextResponse } from "next/server";
import { getRecommendedMexcService } from "@/src/services/mexc-unified-exports";
import { type OrderParameters } from "@/src/services/unified-mexc-client";
import { transactionLockService } from "@/src/services/transaction-lock-service";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";
import { handleApiError } from "@/src/lib/error-handler";
import { db } from "@/src/db";
import { apiCredentials, executionHistory } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { getEncryptionService } from "@/src/services/secure-encryption-service";
import type { NewExecutionHistory } from "@/src/db/schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, side, type, quantity, price, userId, snipeTargetId, skipLock } = body;

    if (!userId) {
      return apiResponse(
        createErrorResponse("User ID required"),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Get API credentials from database
    const credentials = await db
      .select()
      .from(apiCredentials)
      .where(and(
        eq(apiCredentials.userId, userId),
        eq(apiCredentials.provider, 'mexc'),
        eq(apiCredentials.isActive, true)
      ))
      .limit(1);

    if (!credentials[0]) {
      return apiResponse(
        createErrorResponse("No active MEXC API credentials found", {
          message: "Please configure your MEXC API credentials in settings"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Decrypt API credentials
    const encryptionService = getEncryptionService();
    const apiKey = encryptionService.decrypt(credentials[0].encryptedApiKey);
    const secretKey = encryptionService.decrypt(credentials[0].encryptedSecretKey);

    // Validate required parameters
    if (!symbol || !side || !type || !quantity) {
      return apiResponse(
        createErrorResponse("Missing required trading parameters", {
          message: "Symbol, side, type, and quantity are required"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    console.log(`🚀 Trading API: Processing ${side} order for ${symbol}`);

    // Create resource ID for locking
    const resourceId = `trade:${symbol}:${side}:${snipeTargetId || 'manual'}`;
    
    // Skip lock for certain operations (e.g., emergency sells)
    if (skipLock) {
      console.log(`⚠️ Skipping lock for ${resourceId} (skipLock=true)`);
    } else {
      // Check if resource is already locked
      const lockStatus = await transactionLockService.getLockStatus(resourceId);
      if (lockStatus.isLocked) {
        console.log(`🔒 Resource ${resourceId} is locked. Queue length: ${lockStatus.queueLength}`);
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
      side: side.toUpperCase() as 'BUY' | 'SELL',
      type: type.toUpperCase() as 'LIMIT' | 'MARKET',
      quantity: quantity.toString(),
      ...(price && { price: price.toString() }),
      timeInForce: 'IOC' // Immediate or Cancel for safety
    };

    // Execute with lock protection
    const executeTrade = async () => {
      // Place order via service layer (includes validation and balance checks)
      const orderResponse = await mexcService.placeOrder(orderParams);
      
      if (!orderResponse.success) {
        throw new Error(orderResponse.error || "Order placement failed");
      }
      
      // Service layer returns ServiceResponse<OrderResult>, we need the OrderResult
      const orderResult = orderResponse.data;
      
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
    let result;
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
          priority: side.toUpperCase() === 'SELL' ? 1 : 5, // Prioritize sells
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

    const orderResult = result as { success: boolean; error?: string; [key: string]: unknown };

    if (orderResult.success) {
      console.log(`✅ Trading order executed successfully:`, orderResult);
      
      // Save execution history
      try {
        const orderData = orderResult as any; // Type assertion for MEXC order response
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
          executedQuantity: orderData.executedQty ? parseFloat(orderData.executedQty) : parseFloat(quantity),
          executedPrice: orderData.price ? parseFloat(orderData.price) : null,
          totalCost: orderData.cummulativeQuoteQty ? parseFloat(orderData.cummulativeQuoteQty) : null,
          fees: orderData.fee ? parseFloat(orderData.fee) : null,
          exchangeOrderId: orderData.orderId?.toString() || null,
          exchangeStatus: orderData.status || "filled",
          exchangeResponse: JSON.stringify(orderResult),
          executionLatencyMs: orderData.transactTime ? Date.now() - Number(orderData.transactTime) : null,
          slippagePercent: price && orderData.price ? ((parseFloat(orderData.price) - parseFloat(price)) / parseFloat(price)) * 100 : null,
          status: "success",
          requestedAt: new Date(),
          executedAt: orderData.transactTime ? new Date(Number(orderData.transactTime)) : new Date(),
        };

        await db.insert(executionHistory).values(executionRecord);
        console.log(`📝 Execution history saved for order ${orderResult.orderId}`);
      } catch (error) {
        console.error("Failed to save execution history:", error);
        // Don't fail the trade response if history save fails
      }
      
      return apiResponse(
        createSuccessResponse(orderResult, {
          message: "Order placed successfully"
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
    console.error("Trading API Error:", error);
    
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}