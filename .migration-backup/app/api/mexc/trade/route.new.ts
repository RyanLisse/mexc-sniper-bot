/**
 * Trading API - Migrated to new middleware system
 * 
 * This demonstrates how the new middleware system handles complex trading operations
 * with transaction locking, comprehensive validation, and enhanced security.
 */

import { NextRequest } from 'next/server';
import { MexcTradingApi, OrderParameters } from "@/src/services/mexc-trading-api";
import { transactionLockService } from "@/src/services/transaction-lock-service";
import { 
  tradingHandler,
  type ApiContext 
} from '@/src/lib/api-middleware';
import { 
  CompleteTradingOrderSchema 
} from '@/src/lib/api-schemas';
import { db } from "@/src/db";
import { apiCredentials, executionHistory } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { getEncryptionService } from "@/src/services/secure-encryption-service";
import type { NewExecutionHistory } from "@/src/db/schema";
import { HTTP_STATUS } from '@/src/lib/api-response';

// POST /api/mexc/trade
export const POST = tradingHandler({
  validation: CompleteTradingOrderSchema,
})(async (request: NextRequest, context: ApiContext) => {
  const { symbol, side, type, quantity, price, userId, snipeTargetId, skipLock } = context.body;

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
    return context.error("No active MEXC API credentials found", HTTP_STATUS.BAD_REQUEST, {
      message: "Please configure your MEXC API credentials in settings"
    });
  }

  // Decrypt API credentials
  const encryptionService = getEncryptionService();
  const apiKey = encryptionService.decrypt(credentials[0].encryptedApiKey);
  const secretKey = encryptionService.decrypt(credentials[0].encryptedSecretKey);

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
      return context.error("Trade already in progress", HTTP_STATUS.CONFLICT, {
        message: `Another trade for ${symbol} ${side} is being processed. Queue position: ${lockStatus.queueLength + 1}`,
        lockStatus,
      });
    }
  }

  // Initialize trading API
  const tradingApi = new MexcTradingApi(apiKey, secretKey);

  // Prepare order parameters
  const orderParams: OrderParameters = {
    symbol,
    side: side as 'BUY' | 'SELL',
    type: type as 'LIMIT' | 'MARKET',
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
    const baseAsset = side === 'BUY' ? 'USDT' : symbol.replace('USDT', '');
    const balance = await tradingApi.getAssetBalance(baseAsset);
    
    if (!balance) {
      throw new Error("Unable to fetch account balance");
    }

    const availableBalance = parseFloat(balance.free);
    const requiredAmount = side === 'BUY' 
      ? quantity * (price || 1) 
      : quantity;

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
        priority: side === 'SELL' ? 1 : 5, // Prioritize sells
      },
      executeTrade
    );

    if (!lockResult.success) {
      return context.error(lockResult.error || "Trade execution failed", HTTP_STATUS.BAD_REQUEST, {
        message: "Trade execution failed",
        lockId: lockResult.lockId,
        executionTimeMs: lockResult.executionTimeMs,
      });
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
        vcoinId: context.body.vcoinId || symbol,
        symbolName: symbol,
        action: side.toLowerCase() as "buy" | "sell",
        orderType: type.toLowerCase(),
        orderSide: side.toLowerCase(),
        requestedQuantity: quantity,
        requestedPrice: price || null,
        executedQuantity: orderData.executedQty ? parseFloat(orderData.executedQty) : quantity,
        executedPrice: orderData.price ? parseFloat(orderData.price) : null,
        totalCost: orderData.cummulativeQuoteQty ? parseFloat(orderData.cummulativeQuoteQty) : null,
        fees: orderData.fee ? parseFloat(orderData.fee) : null,
        exchangeOrderId: orderData.orderId?.toString() || null,
        exchangeStatus: orderData.status || "filled",
        exchangeResponse: JSON.stringify(orderResult),
        executionLatencyMs: orderData.transactTime ? Date.now() - Number(orderData.transactTime) : null,
        slippagePercent: price && orderData.price ? ((parseFloat(orderData.price) - price) / price) * 100 : null,
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
    
    return context.success(orderResult, {
      message: "Order placed successfully"
    });
  } else {
    console.error(`❌ Trading order failed:`, orderResult);
    
    return context.error(orderResult.error || "Order placement failed", HTTP_STATUS.BAD_REQUEST, {
      message: "Order placement failed",
      details: orderResult,
    });
  }
});