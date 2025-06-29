#!/usr/bin/env bun

/**
 * Trading System Validation Script
 * 
 * Validates core trading system functionality and auto-sniping readiness
 */

import { getCoreTrading, resetCoreTrading } from "../src/services/trading/consolidated/core-trading.service";

async function validateTradingSystem() {
  console.log("🚀 Trading System Validation\n");

  try {
    // Reset any existing instance
    resetCoreTrading();

    // Test Core Trading Service initialization
    console.log("1. 🔧 Testing Core Trading Service initialization...");
    const tradingService = getCoreTrading({
      enablePaperTrading: true,
      autoSnipingEnabled: false, // Start disabled for safety
      confidenceThreshold: 75,
    });

    const initResult = await tradingService.initialize();
    console.log(`   ✅ Core Trading Service initialization: ${initResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (!initResult.success) {
      console.log(`   ❌ Error: ${initResult.error}`);
      return;
    }

    // Test service status
    console.log("\n2. 📊 Testing service status...");
    const status = await tradingService.getServiceStatus();
    console.log(`   ✅ Service Status: ${JSON.stringify(status, null, 2)}`);

    // Test auto-sniping controls
    console.log("\n3. 🎯 Testing auto-sniping controls...");
    
    // Start auto-sniping
    const startResult = await tradingService.startAutoSniping();
    console.log(`   ✅ Start Auto-Sniping: ${startResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (startResult.error) console.log(`   ⚠️  Error: ${startResult.error}`);

    // Get auto-sniping status
    const autoSnipeStatus = await tradingService.getStatus();
    console.log(`   📊 Auto-Sniping Status: ${JSON.stringify(autoSnipeStatus, null, 2)}`);

    // Test manual trade execution (paper trading)
    console.log("\n4. 💰 Testing manual trade execution (paper mode)...");
    const tradeResult = await tradingService.executeTrade({
      symbol: "BTCUSDT",
      side: "BUY",
      type: "MARKET",
      quoteOrderQty: 10, // $10 USDT
      timeInForce: "IOC",
    });
    console.log(`   ✅ Trade Execution: ${tradeResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (tradeResult.error) console.log(`   ❌ Error: ${tradeResult.error}`);
    if (tradeResult.data) console.log(`   📈 Trade Data: ${JSON.stringify(tradeResult.data, null, 2)}`);

    // Stop auto-sniping
    console.log("\n5. 🛑 Testing auto-sniping stop...");
    const stopResult = await tradingService.stopAutoSniping();
    console.log(`   ✅ Stop Auto-Sniping: ${stopResult.success ? 'SUCCESS' : 'FAILED'}`);

    // Final status
    console.log("\n6. 🏁 Final system status...");
    const finalStatus = await tradingService.getServiceStatus();
    console.log(`   📊 Final Status: ${JSON.stringify(finalStatus, null, 2)}`);

    // Shutdown
    console.log("\n7. 🔒 Testing graceful shutdown...");
    const shutdownResult = await tradingService.shutdown();
    console.log(`   ✅ Shutdown: ${shutdownResult.success ? 'SUCCESS' : 'FAILED'}`);

    console.log("\n✅ Trading System Validation COMPLETED");

  } catch (error) {
    console.error("❌ Trading System Validation FAILED:", error);
  }
}

// Run validation
validateTradingSystem().catch(console.error);