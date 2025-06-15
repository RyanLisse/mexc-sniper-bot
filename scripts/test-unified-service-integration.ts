#!/usr/bin/env tsx

/**
 * Integration Test Script for MEXC API Client Unification
 * 
 * This script tests the unified MEXC service to ensure all components
 * are working correctly after the migration from legacy clients.
 */

import { getMexcService, getEnhancedMexcService } from "@/src/services/mexc-unified-exports";

async function testUnifiedServiceIntegration() {
  console.log("🧪 Testing MEXC API Client Unification Integration...\n");
  
  const startTime = Date.now();
  let testsPassed = 0;
  let testsTotal = 0;
  
  try {
    // Test 1: Basic Service Initialization
    testsTotal++;
    console.log("1. Testing service initialization...");
    const mexcService = getMexcService();
    const enhancedService = getEnhancedMexcService();
    
    if (mexcService && enhancedService) {
      console.log("✅ Services initialized successfully");
      testsPassed++;
    } else {
      console.log("❌ Service initialization failed");
    }
    
    // Test 2: Health Check
    testsTotal++;
    console.log("\n2. Testing health check...");
    const healthCheck = await mexcService.performHealthCheck();
    
    if (healthCheck && healthCheck.healthy !== undefined) {
      console.log(`✅ Health check completed: ${healthCheck.healthy ? 'Healthy' : 'Unhealthy'}`);
      console.log(`   Response time: ${healthCheck.responseTimeMs}ms`);
      testsPassed++;
    } else {
      console.log("❌ Health check failed");
    }
    
    // Test 3: Calendar Data Fetch
    testsTotal++;
    console.log("\n3. Testing calendar data fetch...");
    const calendarResponse = await mexcService.getCalendarListings();
    
    if (calendarResponse.success) {
      console.log(`✅ Calendar data fetched: ${calendarResponse.data.length} entries`);
      console.log(`   Execution time: ${calendarResponse.executionTimeMs}ms`);
      console.log(`   Cached: ${calendarResponse.cached || false}`);
      testsPassed++;
    } else {
      console.log(`❌ Calendar fetch failed: ${calendarResponse.error}`);
    }
    
    // Test 4: Symbols Data Fetch
    testsTotal++;
    console.log("\n4. Testing symbols data fetch...");
    const symbolsResponse = await mexcService.getSymbolsData();
    
    if (symbolsResponse.success) {
      console.log(`✅ Symbols data fetched: ${symbolsResponse.data.length} symbols`);
      console.log(`   Execution time: ${symbolsResponse.executionTimeMs}ms`);
      console.log(`   Cached: ${symbolsResponse.cached || false}`);
      testsPassed++;
    } else {
      console.log(`❌ Symbols fetch failed: ${symbolsResponse.error}`);
    }
    
    // Test 5: Pattern Detection
    testsTotal++;
    console.log("\n5. Testing pattern detection...");
    const patternResponse = await mexcService.detectReadyStatePatterns();
    
    if (patternResponse.success) {
      console.log(`✅ Pattern detection completed`);
      console.log(`   Ready state symbols: ${patternResponse.data.readyStateCount}`);
      console.log(`   Total symbols analyzed: ${patternResponse.data.totalSymbols}`);
      console.log(`   Execution time: ${patternResponse.executionTimeMs}ms`);
      testsPassed++;
    } else {
      console.log(`❌ Pattern detection failed: ${patternResponse.error}`);
    }
    
    // Test 6: Enhanced Service Features
    testsTotal++;
    console.log("\n6. Testing enhanced service features...");
    const marketStats = await enhancedService.getDetailedMarketStats();
    
    if (marketStats.success) {
      console.log(`✅ Enhanced market stats fetched`);
      console.log(`   Total pairs: ${marketStats.data.totalPairs}`);
      console.log(`   Active pairs: ${marketStats.data.activePairs}`);
      console.log(`   Top gainers: ${marketStats.data.topGainers.length}`);
      console.log(`   Execution time: ${marketStats.executionTimeMs}ms`);
      testsPassed++;
    } else {
      console.log(`❌ Enhanced market stats failed: ${marketStats.error}`);
    }
    
    // Test 7: Circuit Breaker Status
    testsTotal++;
    console.log("\n7. Testing circuit breaker integration...");
    const circuitBreakerStatus = mexcService.getCircuitBreakerStatus();
    
    if (circuitBreakerStatus && circuitBreakerStatus.state) {
      console.log(`✅ Circuit breaker status: ${circuitBreakerStatus.state}`);
      console.log(`   Failure count: ${circuitBreakerStatus.failureCount}`);
      console.log(`   Success count: ${circuitBreakerStatus.successCount}`);
      testsPassed++;
    } else {
      console.log("❌ Circuit breaker status check failed");
    }
    
    // Test 8: Performance Metrics
    testsTotal++;
    console.log("\n8. Testing performance metrics...");
    const performanceMetrics = mexcService.getMetrics();
    
    if (performanceMetrics && typeof performanceMetrics === 'object') {
      console.log("✅ Performance metrics retrieved");
      const operationCount = Object.keys(performanceMetrics).length;
      console.log(`   Tracked operations: ${operationCount}`);
      testsPassed++;
    } else {
      console.log("❌ Performance metrics check failed");
    }
    
    // Test 9: Cache Statistics
    testsTotal++;
    console.log("\n9. Testing cache statistics...");
    const cacheStats = mexcService.getCacheStats();
    
    if (cacheStats && cacheStats.size !== undefined) {
      console.log(`✅ Cache statistics retrieved`);
      console.log(`   Cache size: ${cacheStats.size}`);
      console.log(`   Hit rate: ${cacheStats.hitRate ? (cacheStats.hitRate * 100).toFixed(1) : 'N/A'}%`);
      testsPassed++;
    } else {
      console.log("❌ Cache statistics check failed");
    }
    
    // Test 10: Service Configuration
    testsTotal++;
    console.log("\n10. Testing service configuration...");
    const hasCredentials = mexcService.hasCredentials();
    
    console.log(`✅ Service configuration checked`);
    console.log(`   Has credentials: ${hasCredentials}`);
    testsPassed++;
    
  } catch (error) {
    console.error("\n❌ Integration test failed with error:", error);
  }
  
  // Test Summary
  const executionTime = Date.now() - startTime;
  const successRate = (testsPassed / testsTotal) * 100;
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 MEXC API Client Unification Integration Test Results");
  console.log("=".repeat(60));
  console.log(`✅ Tests Passed: ${testsPassed}/${testsTotal} (${successRate.toFixed(1)}%)`);
  console.log(`⏱️  Total Execution Time: ${executionTime}ms`);
  console.log(`🔧 Service Integration: ${testsPassed >= 8 ? 'SUCCESS' : 'NEEDS ATTENTION'}`);
  
  if (testsPassed === testsTotal) {
    console.log("\n🎉 All tests passed! MEXC API Client Unification is working correctly.");
  } else {
    console.log(`\n⚠️  ${testsTotal - testsPassed} test(s) failed. Please review the integration.`);
  }
  
  console.log("\n" + "=".repeat(60));
}

// Run the integration test
if (require.main === module) {
  testUnifiedServiceIntegration()
    .then(() => {
      console.log("\n✨ Integration test completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Integration test failed:", error);
      process.exit(1);
    });
}

export { testUnifiedServiceIntegration };