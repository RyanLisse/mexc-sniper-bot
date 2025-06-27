#!/usr/bin/env bun
/**
 * Comprehensive Auto-Sniping Workflow Test
 * 
 * Tests the complete workflow:
 * 1. Target Discovery (Inngest + MEXC Agents)
 * 2. Pattern Analysis & Target Readiness
 * 3. Auto-Sniping Execution (Real Implementation)
 * 4. Position Management & Tracking
 */

import { getCoreTrading } from "./src/services/trading/consolidated/core-trading/base-service";
import { MexcOrchestrator } from "./src/mexc-agents/orchestrator";
import { calendarSyncService } from "./src/services/calendar-to-database-sync";
import { db } from "./src/db";
import { snipeTargets } from "./src/db/schema";
import { eq } from "drizzle-orm";

interface WorkflowTestResult {
  stage: string;
  success: boolean;
  data?: any;
  error?: string;
  timing: number;
}

class AutoSnipingWorkflowTester {
  private results: WorkflowTestResult[] = [];
  private orchestrator: MexcOrchestrator;
  private coreTrading: any;

  constructor() {
    this.orchestrator = new MexcOrchestrator({
      useEnhancedCoordination: true
    });
    this.coreTrading = getCoreTrading();
  }

  /**
   * Log test result
   */
  private logResult(stage: string, success: boolean, data?: any, error?: string, timing: number = 0) {
    const result: WorkflowTestResult = { stage, success, data, error, timing };
    this.results.push(result);
    
    const status = success ? "✅" : "❌";
    console.log(`${status} [${stage}] ${success ? "PASSED" : "FAILED"} (${timing}ms)`);
    if (error) console.log(`   Error: ${error}`);
    if (data && typeof data === 'object') {
      console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
    }
  }

  /**
   * Test 1: Calendar Discovery & Target Creation
   */
  async testCalendarDiscoveryAndTargetCreation(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log("\n🔍 Testing Calendar Discovery & Target Creation...");

      // Test calendar sync service
      const syncResult = await calendarSyncService.syncCalendarToDatabase("system", {
        timeWindowHours: 24,
        forceSync: false,
        dryRun: false
      });

      if (!syncResult.success) {
        this.logResult("Calendar Sync", false, syncResult, "Sync failed", Date.now() - startTime);
        return false;
      }

      this.logResult("Calendar Sync", true, {
        processed: syncResult.processed,
        created: syncResult.created,
        updated: syncResult.updated
      }, undefined, Date.now() - startTime);

      // Test orchestrator calendar discovery workflow
      const orchestratorStart = Date.now();
      const discoveryResult = await this.orchestrator.executeCalendarDiscoveryWorkflow({
        trigger: "test",
        force: false,
        syncData: {
          processed: syncResult.processed,
          created: syncResult.created,
          updated: syncResult.updated
        }
      });

      this.logResult("Calendar Discovery Workflow", discoveryResult.success, 
        discoveryResult.data, discoveryResult.error, Date.now() - orchestratorStart);

      return discoveryResult.success;

    } catch (error) {
      this.logResult("Calendar Discovery & Target Creation", false, null, 
        error instanceof Error ? error.message : String(error), Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 2: Pattern Analysis & Symbol Workflow
   */
  async testPatternAnalysisWorkflow(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log("\n🧠 Testing Pattern Analysis & Symbol Workflow...");

      // Test symbol analysis workflow
      const symbolResult = await this.orchestrator.executeSymbolAnalysisWorkflow({
        vcoinId: "test-vcoin-123",
        symbolName: "TESTUSDT",
        projectName: "Test Token",
        launchTime: new Date().toISOString(),
        attempt: 1
      });

      this.logResult("Symbol Analysis Workflow", symbolResult.success,
        symbolResult.data, symbolResult.error, Date.now() - startTime);

      if (!symbolResult.success) return false;

      // Test pattern analysis workflow
      const patternStart = Date.now();
      const patternResult = await this.orchestrator.executePatternAnalysisWorkflow({
        vcoinId: "test-vcoin-123",
        symbols: ["TESTUSDT"],
        analysisType: "discovery"
      });

      this.logResult("Pattern Analysis Workflow", patternResult.success,
        patternResult.data, patternResult.error, Date.now() - patternStart);

      return patternResult.success;

    } catch (error) {
      this.logResult("Pattern Analysis Workflow", false, null,
        error instanceof Error ? error.message : String(error), Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 3: Auto-Sniping Execution Engine
   */
  async testAutoSnipingExecution(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log("\n⚡ Testing Auto-Sniping Execution Engine...");

      // Get auto-sniping module status
      const status = await this.coreTrading.getStatus();
      this.logResult("Auto-Sniping Status Check", true, {
        status: status.status,
        activeTargets: status.activeTargets,
        readyTargets: status.readyTargets
      }, undefined, Date.now() - startTime);

      // Test auto-sniping start/stop
      const startResult = await this.coreTrading.startAutoSniping();
      this.logResult("Auto-Sniping Start", startResult.success, 
        startResult.data, startResult.error, Date.now() - startTime);

      if (!startResult.success) return false;

      // Create a test target for execution
      const testTarget = {
        id: Math.floor(Math.random() * 1000000),
        symbolName: "BTCUSDT",
        vcoinId: 999,
        confidenceScore: 85,
        positionSizeUsdt: 10,
        stopLossPercent: 5,
        takeProfitCustom: 10,
        status: "ready" as const,
        priority: "high" as const,
        targetExecutionTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        actualExecutionTime: null,
        errorMessage: null
      };

      // Test snipe target processing
      const processStart = Date.now();
      const processResult = await this.coreTrading.autoSniping.processSnipeTargets();
      this.logResult("Process Snipe Targets", processResult.success,
        processResult.data, processResult.error, Date.now() - processStart);

      // Test stop auto-sniping
      const stopResult = await this.coreTrading.stopAutoSniping();
      this.logResult("Auto-Sniping Stop", stopResult.success,
        stopResult.data, stopResult.error, Date.now() - startTime);

      return processResult.success && stopResult.success;

    } catch (error) {
      this.logResult("Auto-Sniping Execution", false, null,
        error instanceof Error ? error.message : String(error), Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 4: Position Management & Tracking
   */
  async testPositionManagement(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log("\n📊 Testing Position Management & Tracking...");

      // Test get positions
      const positions = await this.coreTrading.getPositions();
      this.logResult("Get Positions", true, {
        count: positions.length,
        hasActivePositions: positions.length > 0
      }, undefined, Date.now() - startTime);

      // Test execution report
      const reportStart = Date.now();
      const executionReport = await this.coreTrading.getExecutionReport();
      this.logResult("Execution Report", true, {
        status: executionReport.status,
        activePositions: executionReport.activePositions?.length || 0,
        recentExecutions: executionReport.recentExecutions?.length || 0,
        stats: executionReport.stats
      }, undefined, Date.now() - reportStart);

      // Test performance metrics
      const metricsStart = Date.now();
      const metrics = await this.coreTrading.getPerformanceMetrics();
      this.logResult("Performance Metrics", true, {
        totalTrades: metrics.totalTrades,
        successRate: metrics.successRate,
        totalPnL: metrics.totalPnL
      }, undefined, Date.now() - metricsStart);

      return true;

    } catch (error) {
      this.logResult("Position Management", false, null,
        error instanceof Error ? error.message : String(error), Date.now() - startTime);
      return false;
    }
  }

  /**
   * Test 5: Integration Health Check
   */
  async testIntegrationHealth(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      console.log("\n🏥 Testing Integration Health...");

      // Test orchestrator health
      const orchestratorHealth = await this.orchestrator.healthCheck();
      this.logResult("Orchestrator Health", orchestratorHealth, {
        healthy: orchestratorHealth
      }, undefined, Date.now() - startTime);

      // Test agent health
      const agentHealth = await this.orchestrator.getAgentHealth();
      this.logResult("Agent Health", true, agentHealth, undefined, Date.now() - startTime);

      // Test core trading health
      const coreHealthStart = Date.now();
      const coreStatus = await this.coreTrading.getServiceStatus();
      this.logResult("Core Trading Health", coreStatus.isHealthy, {
        isConnected: coreStatus.isConnected,
        tradingEnabled: coreStatus.tradingEnabled,
        autoSnipingEnabled: coreStatus.autoSnipingEnabled
      }, undefined, Date.now() - coreHealthStart);

      return orchestratorHealth && coreStatus.isHealthy;

    } catch (error) {
      this.logResult("Integration Health", false, null,
        error instanceof Error ? error.message : String(error), Date.now() - startTime);
      return false;
    }
  }

  /**
   * Run complete workflow test
   */
  async runCompleteWorkflowTest(): Promise<void> {
    console.log("🚀 Starting Comprehensive Auto-Sniping Workflow Test\n");
    const overallStart = Date.now();

    const results = await Promise.allSettled([
      this.testCalendarDiscoveryAndTargetCreation(),
      this.testPatternAnalysisWorkflow(),
      this.testAutoSnipingExecution(),
      this.testPositionManagement(),
      this.testIntegrationHealth()
    ]);

    const successCount = results.filter((r, i) => 
      r.status === 'fulfilled' && r.value === true
    ).length;

    const totalTime = Date.now() - overallStart;

    console.log("\n" + "=".repeat(60));
    console.log("📋 WORKFLOW TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Overall Success Rate: ${successCount}/5 (${(successCount/5*100).toFixed(1)}%)`);
    console.log(`Total Execution Time: ${totalTime}ms`);
    console.log(`Tests Passed: ${this.results.filter(r => r.success).length}`);
    console.log(`Tests Failed: ${this.results.filter(r => !r.success).length}`);

    if (successCount === 5) {
      console.log("\n✅ ALL WORKFLOW TESTS PASSED - Auto-sniping workflow fully functional!");
    } else {
      console.log("\n❌ SOME WORKFLOW TESTS FAILED - Review issues above");
      
      // Show failed tests
      const failedTests = this.results.filter(r => !r.success);
      if (failedTests.length > 0) {
        console.log("\nFailed Tests:");
        failedTests.forEach(test => {
          console.log(`  - ${test.stage}: ${test.error}`);
        });
      }
    }

    console.log("\n" + "=".repeat(60));
  }
}

// Run the test
if (import.meta.main) {
  const tester = new AutoSnipingWorkflowTester();
  tester.runCompleteWorkflowTest().catch(console.error);
}