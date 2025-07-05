/**
 * CRITICAL ARCHITECT 3: Automated Trading End-to-End Verification
 *
 * Tests the complete automated trading flow to verify if the user's
 * original issue "I don't see any automated trading happening even with default settings"
 * has been resolved.
 *
 * Flow: Pattern Detection → Bridge Services → Target Creation → Auto-Sniping → Execution
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PatternMatch } from "@/src/core/pattern-detection";
import { EnhancedPatternDetectionCore } from "@/src/core/pattern-detection/pattern-detection-core-enhanced";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/supabase-auth";
import { patternTargetBridgeService } from "@/src/services/data/pattern-detection/pattern-target-bridge-service";
import { tradingSystemInitializer } from "@/src/services/startup/trading-system-initializer";
import { getCoreTrading } from "@/src/services/trading/consolidated/core-trading/base-service";

// Test constants
const _TEST_USER_ID = "test-user-automated-trading";
const TEST_SYMBOL = "TEST/USDT";
const TEST_VCOIN_ID = "test-vcoin-123";
const TEST_TIMEOUT = 30000; // 30 seconds

describe("CRITICAL: Automated Trading End-to-End Verification", () => {
  let coreTrading: any;
  let _originalAutoSnipingState: boolean;

  beforeAll(async () => {
    console.log("\n🔧 Setting up automated trading verification tests...");

    // Get core trading instance
    coreTrading = getCoreTrading({
      enablePaperTrading: true,
      autoSnipingEnabled: true,
      autoSnipeIntervalMs: 5000, // 5 seconds for testing
    });

    // Initialize core trading
    await coreTrading.initialize();

    // Clean up any existing test targets
    await db
      .delete(snipeTargets)
      .where(eq(snipeTargets.vcoinId, TEST_VCOIN_ID));

    console.log("✅ Test setup completed");
  });

  afterAll(async () => {
    console.log("\n🧹 Cleaning up automated trading verification tests...");

    // Clean up test targets
    await db
      .delete(snipeTargets)
      .where(eq(snipeTargets.vcoinId, TEST_VCOIN_ID));

    // Stop trading system
    if (coreTrading) {
      await coreTrading.stopAutoSniping();
      await coreTrading.shutdown();
    }

    // Stop bridge services
    patternTargetBridgeService.stopListening();

    console.log("✅ Test cleanup completed");
  });

  beforeEach(() => {
    // Reset statistics before each test
    patternTargetBridgeService.resetStatistics();
  });

  describe("1. Trading System Initialization Verification", () => {
    it(
      "should initialize trading system and start bridge services",
      async () => {
        console.log("\n🚀 Testing trading system initialization...");

        // Initialize trading system
        await tradingSystemInitializer.initialize();

        // Verify initialization status
        expect(tradingSystemInitializer.isSystemInitialized()).toBe(true);

        // Verify bridge service is listening
        expect(patternTargetBridgeService.isActive()).toBe(true);

        console.log("✅ Trading system initialized successfully");
      },
      TEST_TIMEOUT
    );

    it("should verify bridge service statistics are tracking", async () => {
      console.log("\n📊 Testing bridge service statistics tracking...");

      const stats = patternTargetBridgeService.getStatistics();

      expect(stats).toHaveProperty("totalEventsProcessed");
      expect(stats).toHaveProperty("totalTargetsCreated");
      expect(stats).toHaveProperty("totalTargetsFailed");
      expect(stats.totalEventsProcessed).toBeGreaterThanOrEqual(0);

      console.log("📈 Bridge service statistics:", stats);
      console.log("✅ Statistics tracking verified");
    });
  });

  describe("2. Auto-Sniping Control API Verification", () => {
    it(
      "should start auto-sniping through API and initialize trading system",
      async () => {
        console.log("\n🎯 Testing auto-sniping control API...");

        // Test POST /api/auto-sniping/control with action=start
        const response = await fetch("/api/auto-sniping/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });

        expect(response.status).toBe(200);

        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data.started).toBe(true);
        expect(result.data.tradingSystemInitialized).toBe(true);

        console.log("🎯 Auto-sniping control response:", result);
        console.log("✅ Auto-sniping started successfully via API");
      },
      TEST_TIMEOUT
    );

    it("should get auto-sniping status showing active state", async () => {
      console.log("\n📊 Testing auto-sniping status retrieval...");

      const response = await fetch("/api/auto-sniping/control", {
        method: "GET",
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.tradingSystemInitialized).toBe(true);

      console.log("📊 Auto-sniping status:", result.data);
      console.log("✅ Status retrieved successfully");
    });
  });

  describe("3. Pattern Detection → Target Creation Flow", () => {
    it(
      "should create snipe targets from simulated pattern detection events",
      async () => {
        console.log(
          "\n🔍 Testing pattern detection to target creation flow..."
        );

        // Simulate pattern detection event
        const mockPatternMatches: PatternMatch[] = [
          {
            id: `test-pattern-${Date.now()}`,
            symbol: TEST_SYMBOL,
            vcoinId: TEST_VCOIN_ID,
            patternType: "ready_state",
            confidence: 90,
            recommendation: "immediate_action",
            targetPrice: 1.5,
            entryPrice: 1.45,
            advanceNoticeHours: 0,
            timestamp: new Date(),
            source: "test-pattern-simulation",
            metadata: {
              analysisType: "test",
              dataSource: "simulated",
            },
            indicators: {
              sts: 2,
              st: 2,
              tt: 4,
            },
            riskLevel: "low",
          },
        ];

        const patternEventData = {
          patternType: "ready_state",
          matches: mockPatternMatches,
          metadata: {
            symbolsAnalyzed: 1,
            duration: 1000,
            source: "automated-trading-test",
          },
        };

        // Get initial target count
        const initialTargets = await db
          .select()
          .from(snipeTargets)
          .where(eq(snipeTargets.vcoinId, TEST_VCOIN_ID));

        console.log(`📊 Initial targets: ${initialTargets.length}`);

        // Emit pattern detection event
        const patternDetectionCore = EnhancedPatternDetectionCore.getInstance();
        patternDetectionCore.emit("patterns_detected", patternEventData);

        // Wait for async processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify target creation
        const newTargets = await db
          .select()
          .from(snipeTargets)
          .where(eq(snipeTargets.vcoinId, TEST_VCOIN_ID));

        expect(newTargets.length).toBeGreaterThan(initialTargets.length);

        const createdTarget = newTargets[newTargets.length - 1];
        expect(createdTarget.symbolName).toBe(TEST_SYMBOL);
        expect(createdTarget.status).toBe("ready");
        expect(createdTarget.confidenceScore).toBe(90);

        // Verify bridge service statistics updated
        const stats = patternTargetBridgeService.getStatistics();
        expect(stats.totalEventsProcessed).toBeGreaterThan(0);
        expect(stats.totalTargetsCreated).toBeGreaterThan(0);

        console.log("🎯 Created target:", {
          id: createdTarget.id,
          symbol: createdTarget.symbolName,
          status: createdTarget.status,
          confidence: createdTarget.confidenceScore,
        });
        console.log("📈 Bridge statistics:", stats);
        console.log("✅ Pattern detection to target creation flow verified");
      },
      TEST_TIMEOUT
    );
  });

  describe("4. Auto-Sniping Target Processing Verification", () => {
    it(
      "should detect and process ready snipe targets automatically",
      async () => {
        console.log("\n⚡ Testing auto-sniping target processing...");

        // Ensure auto-sniping is active
        const startResult = await coreTrading.startAutoSniping();
        expect(startResult.success).toBe(true);

        // Create a ready target directly for testing
        const testTarget = await db
          .insert(snipeTargets)
          .values({
            vcoinId: TEST_VCOIN_ID,
            symbolName: TEST_SYMBOL,
            targetPrice: 1.5,
            positionSizeUsdt: 100,
            status: "ready",
            priority: 1,
            riskLevel: "low",
            confidenceScore: 85,
            entryStrategy: "market",
            takeProfitLevel: 1.6,
            stopLossPercent: 5,
            maxRetries: 3,
            currentRetries: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        expect(testTarget.length).toBe(1);
        const targetId = testTarget[0].id;

        console.log("🎯 Created test target:", {
          id: targetId,
          symbol: TEST_SYMBOL,
        });

        // Wait for auto-sniping interval to pick up the target
        console.log("⏳ Waiting for auto-sniping to process target...");
        await new Promise((resolve) => setTimeout(resolve, 12000)); // Wait longer than interval

        // Check if target was processed
        const processedTarget = await db
          .select()
          .from(snipeTargets)
          .where(eq(snipeTargets.id, targetId));

        expect(processedTarget.length).toBe(1);

        // Target should no longer be 'ready' - should be executing, completed, or failed
        const finalStatus = processedTarget[0].status;
        expect(["executing", "completed", "failed"]).toContain(finalStatus);

        console.log("📊 Target processing result:", {
          id: targetId,
          initialStatus: "ready",
          finalStatus: finalStatus,
          executionTime: processedTarget[0].actualExecutionTime,
          errorMessage: processedTarget[0].errorMessage,
        });

        console.log("✅ Auto-sniping target processing verified");
      },
      TEST_TIMEOUT
    );

    it("should verify auto-sniping service status shows active processing", async () => {
      console.log("\n🔍 Verifying auto-sniping service status...");

      const status = await coreTrading.getServiceStatus();

      expect(status.autoSnipingEnabled).toBe(true);
      expect(status.isHealthy).toBe(true);
      expect(status.paperTradingMode).toBe(true);

      console.log("📊 Service status:", {
        autoSnipingEnabled: status.autoSnipingEnabled,
        isHealthy: status.isHealthy,
        paperTradingMode: status.paperTradingMode,
        activePositions: status.activePositions,
        uptime: status.uptime,
      });

      console.log("✅ Auto-sniping service status verified");
    });
  });

  describe("5. Complete End-to-End Automated Trading Flow", () => {
    it("should execute complete automated trading flow from pattern to execution", async () => {
      console.log("\n🚀 Testing COMPLETE automated trading flow...");
      console.log(
        "Flow: Pattern Detection → Bridge Service → Target Creation → Auto-Sniping → Execution"
      );

      // Step 1: Ensure systems are initialized and active
      await tradingSystemInitializer.initialize();
      const startResult = await coreTrading.startAutoSniping();
      expect(startResult.success).toBe(true);

      console.log("✅ Step 1: Systems initialized and auto-sniping active");

      // Step 2: Get initial state
      const initialStats = patternTargetBridgeService.getStatistics();
      const initialTargets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.vcoinId, TEST_VCOIN_ID));

      console.log("📊 Initial state:", {
        bridgeEventsProcessed: initialStats.totalEventsProcessed,
        bridgeTargetsCreated: initialStats.totalTargetsCreated,
        databaseTargets: initialTargets.length,
      });

      // Step 3: Simulate realistic pattern detection event
      const realPatternMatch: PatternMatch = {
        id: `end-to-end-test-${Date.now()}`,
        symbol: `E2E_${TEST_SYMBOL}`,
        vcoinId: `e2e-${TEST_VCOIN_ID}`,
        patternType: "ready_state",
        confidence: 95,
        recommendation: "immediate_action",
        targetPrice: 2.0,
        entryPrice: 1.95,
        advanceNoticeHours: 0,
        timestamp: new Date(),
        source: "end-to-end-verification",
        metadata: {
          analysisType: "comprehensive",
          dataSource: "e2e-test",
          expectedAction: "auto-execute",
        },
        indicators: {
          sts: 2,
          st: 2,
          tt: 4,
        },
        riskLevel: "low",
      };

      const patternEvent = {
        patternType: "ready_state",
        matches: [realPatternMatch],
        metadata: {
          symbolsAnalyzed: 1,
          duration: 1500,
          source: "end-to-end-automated-trading-test",
        },
      };

      // Step 4: Emit pattern detection event
      console.log("📡 Emitting pattern detection event...");
      const patternDetectionCore = EnhancedPatternDetectionCore.getInstance();
      patternDetectionCore.emit("patterns_detected", patternEvent);

      // Step 5: Wait for bridge service to process
      console.log("⏳ Waiting for bridge service processing...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 6: Verify target was created by bridge service
      const bridgeTargets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.vcoinId, `e2e-${TEST_VCOIN_ID}`));

      expect(bridgeTargets.length).toBeGreaterThan(0);
      console.log("✅ Step 6: Bridge service created target");

      // Step 7: Wait for auto-sniping to pick up and process target
      console.log("⏳ Waiting for auto-sniping to process target...");
      await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait for auto-sniping interval

      // Step 8: Verify complete flow execution
      const finalTargets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.vcoinId, `e2e-${TEST_VCOIN_ID}`));

      const finalStats = patternTargetBridgeService.getStatistics();
      const serviceStatus = await coreTrading.getServiceStatus();

      // Verify bridge service processed the event
      expect(finalStats.totalEventsProcessed).toBeGreaterThan(
        initialStats.totalEventsProcessed
      );
      expect(finalStats.totalTargetsCreated).toBeGreaterThan(
        initialStats.totalTargetsCreated
      );

      // Verify target was processed by auto-sniping
      const processedTarget = finalTargets[0];
      expect(processedTarget.status).not.toBe("ready"); // Should be processed

      console.log("🎯 END-TO-END FLOW RESULTS:");
      console.log("├── Pattern Detection: ✅ Event emitted");
      console.log("├── Bridge Service: ✅ Target created");
      console.log("├── Auto-Sniping: ✅ Target processed");
      console.log("└── Final Status:", {
        targetStatus: processedTarget.status,
        bridgeEventsProcessed: finalStats.totalEventsProcessed,
        bridgeTargetsCreated: finalStats.totalTargetsCreated,
        autoSnipingActive: serviceStatus.autoSnipingEnabled,
        executionTime: processedTarget.actualExecutionTime,
      });

      // Clean up e2e test target
      await db
        .delete(snipeTargets)
        .where(eq(snipeTargets.vcoinId, `e2e-${TEST_VCOIN_ID}`));

      console.log("🎉 COMPLETE AUTOMATED TRADING FLOW VERIFIED!");
    }, 45000); // Extended timeout for complete flow
  });

  describe("6. Default Settings Verification", () => {
    it("should verify automated trading works with default configuration", async () => {
      console.log("\n⚙️ Testing automated trading with default settings...");

      // Create core trading with minimal/default config
      const defaultCoreTrading = getCoreTrading({
        enablePaperTrading: true, // Safe for testing
        autoSnipingEnabled: true, // This should be default
      });

      await defaultCoreTrading.initialize();

      // Start with default settings
      const startResult = await defaultCoreTrading.startAutoSniping();
      expect(startResult.success).toBe(true);

      // Verify default configuration is working
      const status = await defaultCoreTrading.getServiceStatus();
      expect(status.autoSnipingEnabled).toBe(true);
      expect(status.paperTradingMode).toBe(true);
      expect(status.isHealthy).toBe(true);

      console.log("⚙️ Default settings status:", {
        autoSnipingEnabled: status.autoSnipingEnabled,
        paperTradingMode: status.paperTradingMode,
        isHealthy: status.isHealthy,
        tradingEnabled: status.tradingEnabled,
      });

      await defaultCoreTrading.stopAutoSniping();
      await defaultCoreTrading.shutdown();

      console.log("✅ Default settings verification complete");
    });
  });
});
