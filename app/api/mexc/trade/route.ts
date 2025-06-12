import { NextRequest, NextResponse } from "next/server";
import { MexcTradingApi, OrderParameters } from "@/src/services/mexc-trading-api";
import { transactionLockService } from "@/src/services/transaction-lock-service";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  handleApiError, 
  apiResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";

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

    // Get API credentials from environment
    const apiKey = process.env.MEXC_API_KEY;
    const secretKey = process.env.MEXC_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return apiResponse(
        createErrorResponse("MEXC API credentials not configured", {
          message: "Configure MEXC API keys in environment variables for trading"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

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

    // Initialize trading API
    const tradingApi = new MexcTradingApi(apiKey, secretKey);

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
      // Validate order parameters
      const validation = tradingApi.validateOrderParameters(orderParams);
      if (!validation.valid) {
        throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
      }

      // Check account balance before placing order
      const baseAsset = side.toUpperCase() === 'BUY' ? 'USDT' : symbol.replace('USDT', '');
      const balance = await tradingApi.getAssetBalance(baseAsset);
      
      if (!balance) {
        throw new Error("Unable to fetch account balance");
      }

      const availableBalance = parseFloat(balance.free);
      const requiredAmount = side.toUpperCase() === 'BUY' 
        ? parseFloat(quantity) * (price ? parseFloat(price) : 1) 
        : parseFloat(quantity);

      if (availableBalance < requiredAmount) {
        throw new Error(`Insufficient ${baseAsset} balance. Available: ${balance.free}, Required: ${requiredAmount}`);
      }

      console.log(`💰 ${baseAsset} Balance: ${balance.free} (sufficient for trading)`);

      // Execute the trading order
      const orderResult = await tradingApi.placeOrder(orderParams);
      
      if (!orderResult.success) {
        throw new Error(orderResult.error || "Order placement failed");
      }
      
      return orderResult;
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
      handleApiError(error),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}