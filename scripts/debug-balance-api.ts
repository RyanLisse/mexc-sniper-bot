/**
 * Balance API Debug Test
 * 
 * This script tests the balance API to identify why the UI shows 0 instead of real balance
 */

import { getUnifiedMexcService } from "../src/services/api/unified-mexc-service-factory";

async function debugBalanceAPI() {
  console.log("🔍 Starting Balance API Debug Test...");
  
  try {
    // Test 1: Check environment variables
    console.log("\n📋 Environment Check:");
    console.log("- MEXC_API_KEY exists:", !!process.env.MEXC_API_KEY);
    console.log("- MEXC_SECRET_KEY exists:", !!process.env.MEXC_SECRET_KEY);
    console.log("- API Key length:", process.env.MEXC_API_KEY?.length || 0);
    console.log("- Secret Key length:", process.env.MEXC_SECRET_KEY?.length || 0);
    
    // Test 2: Get MEXC service
    console.log("\n🔧 Service Initialization:");
    const mexcService = await getUnifiedMexcService();
    console.log("- Service created successfully");
    
    // Test 3: Test connectivity
    console.log("\n🌐 Connectivity Test:");
    const connectivityTest = await mexcService.testConnectivity();
    console.log("- Connectivity test result:", connectivityTest);
    
    // Test 4: Test account info
    console.log("\n👤 Account Info Test:");
    const accountInfo = await mexcService.getAccountInfo();
    console.log("- Account info success:", accountInfo.success);
    console.log("- Account info error:", accountInfo.error);
    console.log("- Account info data keys:", accountInfo.data ? Object.keys(accountInfo.data) : "no data");
    
    // Test 5: Test balance retrieval
    console.log("\n💰 Balance Retrieval Test:");
    const balanceResponse = await mexcService.getAccountBalances();
    console.log("- Balance response success:", balanceResponse.success);
    console.log("- Balance response error:", balanceResponse.error);
    
    if (balanceResponse.success && balanceResponse.data) {
      console.log("- Balances count:", balanceResponse.data.balances.length);
      console.log("- Total USDT value:", balanceResponse.data.totalUsdtValue);
      console.log("- Sample balances (first 3):", 
        balanceResponse.data.balances.slice(0, 3).map(b => ({
          asset: b.asset,
          total: b.total,
          usdtValue: b.usdtValue
        }))
      );
    } else {
      console.log("- Balance response data:", balanceResponse.data);
    }
    
    // Test 6: Simulate API call like frontend
    console.log("\n🖥️  Frontend API Simulation:");
    const url = `/api/account/balance?userId=default-user`;
    console.log("- Would call URL:", url);
    
    // Test 7: Direct balance API test (if we can run it)
    console.log("\n📡 Direct API Test Results:");
    if (balanceResponse.success) {
      console.log("✅ MEXC API is working correctly");
      console.log("✅ Real balance data is available");
      
      if (balanceResponse.data.totalUsdtValue === 0) {
        console.log("⚠️  Total USDT value is 0 - this could be why UI shows 0");
        console.log("   This could mean:");
        console.log("   1. Account has no funds");
        console.log("   2. All assets have no USDT conversion rates");
        console.log("   3. Price fetching is failing");
      } else {
        console.log("❌ Balance API returns real data but UI shows 0");
        console.log("   This suggests an issue in the frontend integration");
      }
    } else {
      console.log("❌ MEXC API is failing");
      console.log("   Error:", balanceResponse.error);
      console.log("   This explains why UI shows 0");
    }
    
  } catch (error) {
    console.error("❌ Debug test failed:", error);
  }
}

// Run the debug test
debugBalanceAPI().catch(console.error);