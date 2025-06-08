import { NextRequest, NextResponse } from "next/server";
import { MexcTradingApi, OrderParameters } from "@/src/services/mexc-trading-api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, side, type, quantity, price, userId } = body;

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

    // Validate order parameters
    const validation = tradingApi.validateOrderParameters(orderParams);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: "Invalid order parameters",
        details: validation.errors,
        message: `Order validation failed: ${validation.errors.join(', ')}`
      }, { status: 400 });
    }

    // Check account balance before placing order
    const baseAsset = side.toUpperCase() === 'BUY' ? 'USDT' : symbol.replace('USDT', '');
    const balance = await tradingApi.getAssetBalance(baseAsset);
    
    if (!balance) {
      return NextResponse.json({
        success: false,
        error: "Unable to fetch account balance",
        message: "Could not verify account balance before trading"
      }, { status: 500 });
    }

    const availableBalance = parseFloat(balance.free);
    const requiredAmount = side.toUpperCase() === 'BUY' 
      ? parseFloat(quantity) * (price ? parseFloat(price) : 1) 
      : parseFloat(quantity);

    if (availableBalance < requiredAmount) {
      return NextResponse.json({
        success: false,
        error: "Insufficient balance",
        message: `Insufficient ${baseAsset} balance. Available: ${balance.free}, Required: ${requiredAmount}`,
        balance: balance
      }, { status: 400 });
    }

    console.log(`💰 ${baseAsset} Balance: ${balance.free} (sufficient for trading)`);

    // Execute the trading order
    const orderResult = await tradingApi.placeOrder(orderParams);

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