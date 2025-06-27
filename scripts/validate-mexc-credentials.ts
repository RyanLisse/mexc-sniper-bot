#!/usr/bin/env tsx

/**
 * MEXC Credentials Validation Test
 * 
 * Simple test to validate MEXC API credentials are working correctly.
 * This disproves the claims in ZERO_BALANCE_FIX_REPORT.md that credentials are invalid.
 */

import { getMexcService } from "../src/services/api/mexc-unified-exports";

async function validateMexcCredentials() {
  console.log("🔍 MEXC Credentials Validation Test");
  console.log("=====================================");

  try {
    // Test environment variables
    const hasApiKey = !!process.env.MEXC_API_KEY;
    const hasSecretKey = !!process.env.MEXC_SECRET_KEY;
    
    console.log("📋 Environment Check:");
    console.log(`   API Key Present: ${hasApiKey ? "✅" : "❌"}`);
    console.log(`   Secret Key Present: ${hasSecretKey ? "✅" : "❌"}`);
    
    if (!hasApiKey || !hasSecretKey) {
      console.log("❌ Missing credentials in environment");
      process.exit(1);
    }

    // Test MEXC service creation
    console.log("\n🔧 MEXC Service Creation:");
    const mexcService = getMexcService();
    console.log("   Service Instance: ✅ Created successfully");

    // Test account balance retrieval (authenticated endpoint)
    console.log("\n💰 Account Balance Test:");
    const balanceResponse = await mexcService.getAccountBalances();
    
    if (!balanceResponse.success) {
      console.log(`❌ Balance API failed: ${balanceResponse.error}`);
      process.exit(1);
    }

    const { balances, totalUsdtValue } = balanceResponse.data;
    console.log(`   API Response: ✅ Success`);
    console.log(`   Total USDT Value: ${totalUsdtValue} USDT`);
    console.log(`   Balance Count: ${balances.length} assets`);

    // Test market data retrieval (public endpoint)
    console.log("\n📊 Market Data Test:");
    const symbolsResponse = await mexcService.getSymbolsV2();
    
    if (!symbolsResponse.success) {
      console.log(`❌ Symbols API failed: ${symbolsResponse.error}`);
      process.exit(1);
    }

    console.log(`   Symbols Count: ${symbolsResponse.data?.length || 0} trading pairs`);
    console.log("   Public API: ✅ Working");

    // Test calendar data (public endpoint)
    console.log("\n📅 Calendar Data Test:");
    const calendarResponse = await mexcService.getCalendarListings();
    
    if (!calendarResponse.success) {
      console.log(`❌ Calendar API failed: ${calendarResponse.error}`);
      process.exit(1);
    }

    console.log(`   Calendar Entries: ${calendarResponse.data?.length || 0} listings`);
    console.log("   Calendar API: ✅ Working");

    // Test ticker data (public endpoint)
    console.log("\n🎯 Ticker Test:");
    const tickerResponse = await mexcService.get24hrTicker("BTCUSDT");
    
    if (!tickerResponse.success) {
      console.log(`❌ Ticker API failed: ${tickerResponse.error}`);
      process.exit(1);
    }

    const btcPrice = tickerResponse.data?.[0]?.lastPrice;
    console.log(`   BTC Price: $${btcPrice}`);
    console.log("   Ticker API: ✅ Working");

    // Final validation summary
    console.log("\n🎉 VALIDATION RESULTS:");
    console.log("=====================================");
    console.log("✅ MEXC API Key: VALID");
    console.log("✅ MEXC Secret Key: VALID");
    console.log("✅ Authentication: WORKING");
    console.log("✅ Account Access: WORKING");
    console.log("✅ Market Data: WORKING");
    console.log(`✅ Available Balance: ${totalUsdtValue} USDT`);
    
    console.log("\n📝 CONCLUSION:");
    console.log("The MEXC credentials are VALID and WORKING correctly.");
    console.log("The ZERO_BALANCE_FIX_REPORT.md is INCORRECT and should be updated.");

  } catch (error) {
    console.error("\n❌ VALIDATION FAILED:");
    console.error("Error:", error instanceof Error ? error.message : error);
    console.error("\nThis suggests there may be an issue with the credentials or network connectivity.");
    process.exit(1);
  }
}

// Run validation
validateMexcCredentials().catch(console.error);