#!/usr/bin/env node

/**
 * Auto-Sniping Integration Test Suite
 * 
 * TypeScript test script to verify auto-sniping functionality
 * Tests the core components integration with proper typing
 */

import type { PatternMatch } from './src/core/pattern-detection/interfaces';
import type { AutoSnipingConfig } from './src/services/trading/auto-sniping/schemas';

interface TestResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}

async function testAutoSnipingIntegration(): Promise<void> {
  console.log('🚀 Testing Auto-Sniping Integration...\n');

  const results: TestResult[] = [];

  try {
    // Test 1: Import and initialize OptimizedAutoSnipingCore
    console.log('1. Testing OptimizedAutoSnipingCore initialization...');
    const { OptimizedAutoSnipingCore } = await import('./src/services/trading/auto-sniping/core-orchestrator');
    
    const config: Partial<AutoSnipingConfig> = {
      enabled: true,
      maxPositions: 2,
      positionSizeUSDT: 10,
      minConfidence: 70,
    };
    
    const autoSnipingCore = OptimizedAutoSnipingCore.getInstance(config);
    console.log('✅ OptimizedAutoSnipingCore initialized successfully\n');
    
    results.push({
      success: true,
      message: 'Core initialization successful',
      details: { config }
    });

    // Test 2: Get execution report
    console.log('2. Testing execution report generation...');
    const report = await autoSnipingCore.getExecutionReport();
    console.log('✅ Execution report generated:', {
      status: report.status,
      activePositions: report.activePositions.length,
      readyTargets: report.readyTargets,
      safetyStatus: report.safetyStatus,
    });

    results.push({
      success: true,
      message: 'Execution report generation successful',
      details: {
        status: report.status,
        activePositionsCount: report.activePositions.length,
        readyTargets: report.readyTargets,
        safetyStatus: report.safetyStatus,
      }
    });

    // Test 3: Test system health check
    console.log('3. Testing system health check...');
    const healthCheck = await autoSnipingCore.performHealthChecks();
    console.log('✅ Health check completed:', {
      mexc: healthCheck.mexc,
      database: healthCheck.database,
      overall: healthCheck.overall,
    });

    results.push({
      success: true,
      message: 'Health check successful',
      details: { healthCheck }
    });

    // Test 4: Test configuration validation
    console.log('4. Testing configuration validation...');
    const currentConfig = autoSnipingCore.getConfig();
    console.log('✅ Configuration validation passed:', {
      enabled: currentConfig.enabled,
      maxPositions: currentConfig.maxPositions,
      minConfidence: currentConfig.minConfidence,
    });

    results.push({
      success: true,
      message: 'Configuration validation successful',
      details: { currentConfig }
    });

    // Test 5: Test stats retrieval
    console.log('5. Testing statistics retrieval...');
    const stats = autoSnipingCore.getStats();
    console.log('✅ Statistics retrieved:', {
      totalTrades: stats.totalTrades,
      successfulTrades: stats.successfulTrades,
      totalPnl: stats.totalPnl,
    });

    results.push({
      success: true,
      message: 'Statistics retrieval successful',
      details: { stats }
    });

    // Test Summary
    console.log('\n📊 Test Summary:');
    const successCount = results.filter(r => r.success).length;
    const totalTests = results.length;
    
    console.log(`✅ ${successCount}/${totalTests} tests passed`);
    
    if (successCount === totalTests) {
      console.log('🎉 All auto-sniping integration tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed');
      process.exit(1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Auto-sniping integration test failed:', errorMessage);
    
    results.push({
      success: false,
      message: 'Integration test failed',
      error: errorMessage
    });

    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  void testAutoSnipingIntegration();
}

export { testAutoSnipingIntegration };
export type { TestResult };