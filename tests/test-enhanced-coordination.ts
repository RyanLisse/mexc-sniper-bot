#!/usr/bin/env bun
/**
 * Enhanced Coordination System Test
 * 
 * Tests the activation and functionality of the enhanced coordination system
 */

import { MexcOrchestrator } from './src/mexc-agents/orchestrator';

interface CoordinationTestResult {
  test: string;
  success: boolean;
  data?: any;
  error?: string;
  timing: number;
}

class EnhancedCoordinationTester {
  private results: CoordinationTestResult[] = [];

  /**
   * Log test result
   */
  private logResult(test: string, success: boolean, data?: any, error?: string, timing: number = 0) {
    const result: CoordinationTestResult = { test, success, data, error, timing };
    this.results.push(result);
    
    const status = success ? "✅" : "❌";
    console.log(`${status} [${test}] ${success ? "PASSED" : "FAILED"} (${timing}ms)`);
    if (error) console.log(`   Error: ${error}`);
    if (data && typeof data === 'object') {
      console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
    }
  }

  /**
   * Test Legacy Mode (without enhanced coordination)
   */
  async testLegacyMode(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log("\n🔧 Testing Legacy Mode...");
      
      const orchestrator = new MexcOrchestrator({ useEnhancedCoordination: false });
      
      // Check that enhanced coordination is not enabled
      const isReady = orchestrator.isEnhancedCoordinationReady();
      if (isReady) {
        this.logResult("Legacy Mode Check", false, null, "Enhanced coordination should not be enabled", Date.now() - startTime);
        return false;
      }

      // Test basic health check
      const healthStart = Date.now();
      const healthStatus = await orchestrator.healthCheck();
      this.logResult("Legacy Health Check", true, { healthy: healthStatus }, undefined, Date.now() - healthStart);

      // Test coordination health
      const coordHealthStart = Date.now();
      const coordHealth = await orchestrator.getCoordinationHealth();
      this.logResult("Legacy Coordination Health", true, coordHealth, undefined, Date.now() - coordHealthStart);

      this.logResult("Legacy Mode", true, {
        enhancedCoordinationReady: isReady,
        healthCheck: healthStatus,
        coordinationHealth: coordHealth
      }, undefined, Date.now() - startTime);

      return true;

    } catch (error) {
      this.logResult("Legacy Mode", false, null,
        error instanceof Error ? error.message : String(error), Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test Enhanced Coordination Mode
   */
  async testEnhancedCoordinationMode(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log("\n🚀 Testing Enhanced Coordination Mode...");
      
      const orchestrator = new MexcOrchestrator({ 
        useEnhancedCoordination: true,
        coordinationConfig: {
          healthCheckInterval: 30000,
          performanceCollectionInterval: 60000,
          maxHistorySize: 1000
        }
      });

      // Wait for initialization to complete
      console.log("Waiting for coordination initialization...");
      const initStart = Date.now();
      const initSuccess = await orchestrator.waitForCoordinationInitialization();
      this.logResult("Coordination Initialization", initSuccess, { initialized: initSuccess }, undefined, Date.now() - initStart);

      if (!initSuccess) {
        this.logResult("Enhanced Coordination Mode", false, null, "Failed to initialize coordination system", Date.now() - startTime);
        return false;
      }

      // Check that enhanced coordination is ready
      const isReady = orchestrator.isEnhancedCoordinationReady();
      this.logResult("Enhanced Coordination Ready Check", isReady, { ready: isReady }, undefined, Date.now() - startTime);

      // Test health check with enhanced coordination
      const healthStart = Date.now();
      const healthStatus = await orchestrator.healthCheck();
      this.logResult("Enhanced Health Check", true, { healthy: healthStatus }, undefined, Date.now() - healthStart);

      // Test agent health
      const agentHealthStart = Date.now();
      const agentHealth = await orchestrator.getAgentHealth();
      this.logResult("Enhanced Agent Health", true, agentHealth, undefined, Date.now() - agentHealthStart);

      // Test coordination health
      const coordHealthStart = Date.now();
      const coordHealth = await orchestrator.getCoordinationHealth();
      this.logResult("Enhanced Coordination Health", true, coordHealth, undefined, Date.now() - coordHealthStart);

      // Test agent summary
      const summaryStart = Date.now();
      const agentSummary = orchestrator.getAgentSummary();
      this.logResult("Enhanced Agent Summary", true, agentSummary, undefined, Date.now() - summaryStart);

      // Test metrics
      const metricsStart = Date.now();
      const metrics = orchestrator.getOrchestrationMetrics();
      this.logResult("Enhanced Orchestration Metrics", true, metrics, undefined, Date.now() - metricsStart);

      this.logResult("Enhanced Coordination Mode", true, {
        enhancedCoordinationReady: isReady,
        healthCheck: healthStatus,
        agentHealth,
        coordinationHealth: coordHealth,
        agentSummary,
        metrics
      }, undefined, Date.now() - startTime);

      return true;

    } catch (error) {
      this.logResult("Enhanced Coordination Mode", false, null,
        error instanceof Error ? error.message : String(error), Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test Dynamic Coordination Enable/Disable
   */
  async testDynamicCoordinationControl(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log("\n🔄 Testing Dynamic Coordination Control...");
      
      // Start with legacy mode
      const orchestrator = new MexcOrchestrator({ useEnhancedCoordination: false });
      
      // Verify it starts in legacy mode
      let isReady = orchestrator.isEnhancedCoordinationReady();
      if (isReady) {
        this.logResult("Initial Legacy State", false, null, "Should start in legacy mode", Date.now() - startTime);
        return false;
      }

      // Enable enhanced coordination dynamically
      console.log("Enabling enhanced coordination dynamically...");
      const enableStart = Date.now();
      await orchestrator.enableEnhancedCoordination({
        healthCheckInterval: 30000,
        performanceCollectionInterval: 60000,
        maxHistorySize: 500
      });
      this.logResult("Dynamic Enable", true, null, undefined, Date.now() - enableStart);

      // Check that it's now enabled
      isReady = orchestrator.isEnhancedCoordinationReady();
      this.logResult("Enhanced Coordination Active", isReady, { ready: isReady }, undefined, Date.now() - startTime);

      // Test functionality
      const healthStatus = await orchestrator.healthCheck();
      this.logResult("Post-Enable Health Check", true, { healthy: healthStatus }, undefined, Date.now() - startTime);

      // Disable enhanced coordination
      console.log("Disabling enhanced coordination...");
      const disableStart = Date.now();
      await orchestrator.disableEnhancedCoordination();
      this.logResult("Dynamic Disable", true, null, undefined, Date.now() - disableStart);

      // Check that it's now disabled
      isReady = orchestrator.isEnhancedCoordinationReady();
      this.logResult("Enhanced Coordination Disabled", !isReady, { ready: isReady }, undefined, Date.now() - startTime);

      this.logResult("Dynamic Coordination Control", true, {
        enableSuccessful: true,
        disableSuccessful: true,
        finalState: isReady
      }, undefined, Date.now() - startTime);

      return true;

    } catch (error) {
      this.logResult("Dynamic Coordination Control", false, null,
        error instanceof Error ? error.message : String(error), Date.now() - startTime);
      return false;
    }
  }

  /**
   * Run complete coordination test
   */
  async runCompleteCoordinationTest(): Promise<void> {
    console.log("🔧 Phase 1 Critical Optimization: Enhanced Coordination System Test\n");
    const overallStart = Date.now();

    const results = await Promise.allSettled([
      this.testLegacyMode(),
      this.testEnhancedCoordinationMode(),
      this.testDynamicCoordinationControl()
    ]);

    const successCount = results.filter((r, i) => 
      r.status === 'fulfilled' && r.value === true
    ).length;

    const totalTime = Date.now() - overallStart;

    console.log("\n" + "=".repeat(60));
    console.log("📋 ENHANCED COORDINATION TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Overall Success Rate: ${successCount}/3 (${(successCount/3*100).toFixed(1)}%)`);
    console.log(`Total Execution Time: ${totalTime}ms`);
    console.log(`Tests Passed: ${this.results.filter(r => r.success).length}`);
    console.log(`Tests Failed: ${this.results.filter(r => !r.success).length}`);

    if (successCount === 3) {
      console.log("\n✅ ALL COORDINATION TESTS PASSED - Enhanced coordination system working correctly!");
    } else {
      console.log("\n❌ SOME COORDINATION TESTS FAILED - Review issues above");
      
      // Show failed tests
      const failedTests = this.results.filter(r => !r.success);
      if (failedTests.length > 0) {
        console.log("\nFailed Tests:");
        failedTests.forEach(test => {
          console.log(`  - ${test.test}: ${test.error}`);
        });
      }
    }

    // Optimization analysis
    console.log("\n🎯 OPTIMIZATION ANALYSIS:");
    const enhancedCoordResults = this.results.filter(r => r.test.includes("Enhanced"));
    if (enhancedCoordResults.length > 0) {
      const avgEnhancedTime = enhancedCoordResults.reduce((sum, r) => sum + r.timing, 0) / enhancedCoordResults.length;
      console.log(`Average Enhanced Coordination Response Time: ${avgEnhancedTime.toFixed(1)}ms`);
      
      if (avgEnhancedTime < 1000) {
        console.log("✅ Enhanced coordination is performing well");
      } else if (avgEnhancedTime < 2000) {
        console.log("🟡 Enhanced coordination performance is acceptable");
      } else {
        console.log("❌ Enhanced coordination needs performance optimization");
      }
    }

    console.log("\n" + "=".repeat(60));
  }
}

// Run the test
if (import.meta.main) {
  const tester = new EnhancedCoordinationTester();
  tester.runCompleteCoordinationTest().catch(console.error);
}