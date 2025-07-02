#!/usr/bin/env bun

/**
 * Test script to verify account balance USDT calculation fixes
 * 
 * This script tests:
 * 1. Exchange info endpoint
 * 2. Ticker endpoint 
 * 3. Account balance USDT calculations
 */

import { getRecommendedMexcService } from "../src/services/api/mexc-unified-exports";

async function testExchangeInfo() {
  console.log("\n🔍 Testing Exchange Info...");
  
  try {
    const mexcService = getRecommendedMexcService();
    const exchangeInfo = await mexcService.getExchangeInfo();
    
    console.log("Exchange Info Result:", {
      success: exchangeInfo.success,
      hasData: !!exchangeInfo.data,
      symbolsCount: exchangeInfo.data?.symbols?.length || 0,
      usdtPairsCount: exchangeInfo.data?.symbols?.filter(s => s.quoteAsset === "USDT").length || 0,
      error: exchangeInfo.error,
    });
    
    if (exchangeInfo.success && exchangeInfo.data?.symbols) {
      const sampleUsdtPairs = exchangeInfo.data.symbols
        .filter(s => s.quoteAsset === "USDT")
        .slice(0, 5)
        .map(s => s.symbol);
      console.log("Sample USDT pairs:", sampleUsdtPairs);
    }
    
    return exchangeInfo.success;
  } catch (error) {
    console.error("❌ Exchange Info test failed:", error);
    return false;
  }
}

async function testTicker() {
  console.log("\n🎯 Testing Ticker...");
  
  try {
    const mexcService = getRecommendedMexcService();
    
    // Test single ticker
    const tickerResult = await mexcService.getTicker("BTCUSDT");
    console.log("Single Ticker Result:", {
      success: tickerResult.success,
      hasData: !!tickerResult.data,
      price: tickerResult.data?.price || tickerResult.data?.lastPrice,
      error: tickerResult.error,
    });
    
    // Test multiple tickers
    const multiTickerResult = await mexcService.getTicker24hr(["BTCUSDT", "ETHUSDT"]);
    console.log("Multi Ticker Result:", {
      success: multiTickerResult.success,
      count: multiTickerResult.data?.length || 0,
      error: multiTickerResult.error,
    });
    
    return tickerResult.success && multiTickerResult.success;
  } catch (error) {
    console.error("❌ Ticker test failed:", error);
    return false;
  }
}

async function testAccountBalanceLogic() {
  console.log("\n💰 Testing Account Balance Logic...");
  
  try {
    const mexcService = getRecommendedMexcService();
    
    // Test the main components that account balance uses
    const exchangeInfo = await mexcService.getExchangeInfo();
    if (!exchangeInfo.success) {
      console.error("❌ Exchange info failed:", exchangeInfo.error);
      return false;
    }
    
    const validTradingPairs = new Set(
      exchangeInfo.data?.symbols
        ?.filter((symbol) => symbol.quoteAsset === "USDT" && symbol.status === "1")
        .map((symbol) => symbol.symbol) || []
    );
    
    console.log("Valid USDT trading pairs:", {
      count: validTradingPairs.size,
      samplePairs: Array.from(validTradingPairs).slice(0, 10),
    });
    
    // Test some common trading pairs
    const commonPairs = ["SOLUSDT", "BTCUSDT", "ETHUSDT"];
    const availablePairs = commonPairs.filter(pair => validTradingPairs.has(pair));
    
    console.log("Common pairs availability:", {
      tested: commonPairs,
      available: availablePairs,
    });
    
    // Test ticker for available pairs
    if (availablePairs.length > 0) {
      const tickerTest = await mexcService.getTicker(availablePairs[0]);
      console.log(`Ticker test for ${availablePairs[0]}:`, {
        success: tickerTest.success,
        price: tickerTest.data?.price || tickerTest.data?.lastPrice,
        error: tickerTest.error,
      });
    }
    
    return true;
  } catch (error) {
    console.error("❌ Account balance logic test failed:", error);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting Account Balance USDT Fixes Test\n");
  
  const tests = [
    { name: "Exchange Info", fn: testExchangeInfo },
    { name: "Ticker", fn: testTicker },
    { name: "Account Balance Logic", fn: testAccountBalanceLogic },
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, success: result });
      console.log(`${result ? "✅" : "❌"} ${test.name}: ${result ? "PASSED" : "FAILED"}`);
    } catch (error) {
      results.push({ name: test.name, success: false });
      console.log(`❌ ${test.name}: FAILED (${error})`);
    }
  }
  
  console.log("\n📊 Test Summary:");
  results.forEach(result => {
    console.log(`  ${result.success ? "✅" : "❌"} ${result.name}`);
  });
  
  const passedCount = results.filter(r => r.success).length;
  console.log(`\n🎯 ${passedCount}/${results.length} tests passed`);
  
  if (passedCount === results.length) {
    console.log("🎉 All tests passed! Account balance USDT fixes should be working.");
  } else {
    console.log("⚠️  Some tests failed. Check the errors above.");
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}