import { NextRequest, NextResponse } from "next/server";
import { MexcTradingApi, OrderParameters } from "@/src/services/mexc-trading-api";
import { transactionLockService } from "@/src/services/transaction-lock-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, side, type, quantity, price, userId, snipeTargetId, skipLock } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 400 }
      );
    }

    // Get API credentials from environment
    const apiKey = process.env.MEXC_API_KEY;
    const secretKey = process.env.MEXC_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return NextResponse.json({
        success: false,
        error: "MEXC API credentials not configured",
        message: "Configure MEXC API keys in environment variables for trading"
      }, { status: 400 });
    }

    // Validate required parameters
    if (!symbol || !side || !type || !quantity) {
      return NextResponse.json({
        success: false,
        error: "Missing required trading parameters",
        message: "Symbol, side, type, and quantity are required"
      }, { status: 400 });
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
        return NextResponse.json({
          success: false,
          error: "Trade already in progress",
          message: `Another trade for ${symbol} ${side} is being processed. Queue position: ${lockStatus.queueLength + 1}`,
          lockStatus,
        }, { status: 409 });
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
        return NextResponse.json({
          success: false,
          error: lockResult.error,
          message: "Trade execution failed",
          lockId: lockResult.lockId,
          executionTimeMs: lockResult.executionTimeMs,
        }, { status: 400 });
      }

      result = lockResult.result;
    }

    const orderResult = result as any;

    if (orderResult.success) {
      console.log(`✅ Trading order executed successfully:`, orderResult);
      
      return NextResponse.json({
        success: true,
        message: "Order placed successfully",
        order: orderResult,
        timestamp: new Date().toISOString()
      });
    } else {
      console.error(`❌ Trading order failed:`, orderResult);
      
      return NextResponse.json({
        success: false,
        error: orderResult.error,
        message: "Order placement failed",
        details: orderResult,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

  } catch (error) {
    console.error("Trading API Error:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown trading error",
      message: "Trading execution failed",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}