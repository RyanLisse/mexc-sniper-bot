#!/usr/bin/env tsx

/**
 * Safe MEXC Credential Testing Script
 * 
 * This script allows you to test your MEXC API credentials safely
 * without exposing them in the codebase.
 * 
 * Usage:
 *   npm run test:mexc-credentials
 *   
 * Or directly:
 *   npx tsx scripts/test-mexc-credentials.ts
 */

import { getRecommendedMexcService } from "../src/services/mexc-unified-exports";

async function testMexcCredentials() {
  console.log("🔐 MEXC Credential Testing Script");
  console.log("=================================\n");

  // Check if credentials are provided via environment variables
  const apiKey = process.env.MEXC_API_KEY;
  const secretKey = process.env.MEXC_SECRET_KEY;
  const passphrase = process.env.MEXC_PASSPHRASE;

  if (!apiKey || !secretKey) {
    console.error("❌ Error: MEXC credentials not found!");
    console.log("\nTo test your credentials, set them as environment variables:");
    console.log("  export MEXC_API_KEY='your-api-key'");
    console.log("  export MEXC_SECRET_KEY='your-secret-key'");
    console.log("  export MEXC_PASSPHRASE='your-passphrase'  # (optional)");
    console.log("\nThen run:");
    console.log("  npm run test:mexc-credentials");
    process.exit(1);
  }

  console.log("📋 Credentials Found:");
  console.log(`  API Key: ${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`  Secret Key: ${secretKey.substring(0, 6)}...${secretKey.substring(secretKey.length - 4)}`);
  if (passphrase) {
    console.log(`  Passphrase: ${"*".repeat(passphrase.length)}`);
  }
  console.log();

  try {
    // Test 1: Create MEXC Service
    console.log("🔧 Test 1: Creating MEXC Service...");
    const mexcService = getRecommendedMexcService({
      apiKey,
      secretKey,
      passphrase
    });
    console.log("✅ MEXC service created successfully");

    // Test 2: Check credentials loaded by testing account balances
    console.log("\n🔍 Test 2: Checking credential loading...");
    try {
      // Try to get account balances to validate credentials are loaded
      const balanceTestResult = await mexcService.getAccountBalances();
      if (balanceTestResult.success) {
        console.log("✅ Credentials loaded and validated successfully");
      } else {
        console.log("❌ Credentials not properly loaded or invalid");
        console.log(`   Error: ${balanceTestResult.error}`);
        process.exit(1);
      }
    } catch (credError) {
      console.log("❌ Failed to validate credentials");
      console.log(`   Error: ${credError instanceof Error ? credError.message : String(credError)}`);
      process.exit(1);
    }

    // Test 3: Basic connectivity
    console.log("\n🌐 Test 3: Testing basic connectivity...");
    const connectivityResult = await mexcService.testConnectivity();
    if (connectivityResult.success && connectivityResult.data) {
      console.log("✅ MEXC API is reachable");
    } else {
      console.log("❌ MEXC API is not reachable");
      console.log(`   Error: ${connectivityResult.error || 'Unknown connectivity error'}`);
      process.exit(1);
    }

    // Test 4: Credential authentication
    console.log("\n🔑 Test 4: Testing credential authentication...");
    const accountResult = await mexcService.getAccountBalances();
    
    if (!accountResult.success) {
      console.log("❌ Authentication failed:");
      console.log(`   Error: ${accountResult.error}`);
      
      // Provide specific guidance based on error
      if (accountResult.error?.includes('signature')) {
        console.log("\n💡 Suggestions:");
        console.log("   - Check if your secret key is correct");
        console.log("   - Ensure server time is synchronized");
        console.log("   - Verify API key and secret are for the same MEXC account");
      } else if (accountResult.error?.includes('key')) {
        console.log("\n💡 Suggestions:");
        console.log("   - Verify your API key is correct");
        console.log("   - Check if API key has required permissions");
        console.log("   - Ensure API key is active and not expired");
      } else if (accountResult.error?.includes('IP')) {
        console.log("\n💡 Suggestions:");
        console.log("   - Add your server IP to MEXC API allowlist");
        console.log("   - Check MEXC API management settings");
      }
      
      process.exit(1);
    }

    const { balances, totalUsdtValue } = accountResult.data;
    console.log("✅ Authentication successful!");
    console.log(`   Found ${balances?.length || 0} assets with balances`);
    console.log(`   Total value: ${totalUsdtValue?.toFixed(2) || '0.00'} USDT`);

    // Test 5: Display some balance details (if any)
    if (balances && balances.length > 0) {
      console.log("\n💰 Account Balance Summary:");
      const topBalances = balances
        .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .slice(0, 5);
      
      if (topBalances.length > 0) {
        topBalances.forEach(balance => {
          const total = parseFloat(balance.free) + parseFloat(balance.locked);
          if (total > 0) {
            console.log(`   ${balance.coin}: ${total.toFixed(8)} (${balance.usdtValue?.toFixed(2) || '0.00'} USDT)`);
          }
        });
      } else {
        console.log("   No assets with positive balances found");
      }
    }

    console.log("\n🎉 All tests passed! Your MEXC credentials are working correctly.");
    console.log("\n📝 Next steps:");
    console.log("   1. Add these credentials to your production environment");
    console.log("   2. Set ENCRYPTION_MASTER_KEY in production");
    console.log("   3. Test saving credentials via the web interface");

  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof Error && error.stack) {
      console.log("\n🔍 Debug information:");
      console.log(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the test
testMexcCredentials().catch(error => {
  console.error("Unexpected error:", error);
  process.exit(1);
});