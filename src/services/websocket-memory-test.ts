/**
 * WebSocket Memory Leak Test
 * Tests the WebSocket service for memory leaks by simulating heavy usage
 */

import { webSocketPriceService } from "./websocket-price-service";

interface TestMetrics {
  startTime: number;
  startMemory: number;
  currentMemory: number;
  peakMemory: number;
  subscriptionCount: number;
  connectionCount: number;
  errorCount: number;
}

class WebSocketMemoryTest {
  private metrics: TestMetrics = {
    startTime: Date.now(),
    startMemory: 0,
    currentMemory: 0,
    peakMemory: 0,
    subscriptionCount: 0,
    connectionCount: 0,
    errorCount: 0,
  };

  private testSymbols = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "ADAUSDT",
    "DOGEUSDT",
    "SOLUSDT",
    "DOTUSDT",
    "MATICUSDT",
    "AVAXUSDT",
    "LTCUSDT",
    "LINKUSDT",
    "UNIUSDT",
    "ATOMUSDT",
    "XLMUSDT",
    "VETUSDT",
    "ICPUSDT",
    "FILUSDT",
    "TRXUSDT",
    "ETCUSDT",
  ];

  private subscriptions: (() => void)[] = [];
  private testInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics.startMemory = this.getMemoryUsage();
  }

  private getMemoryUsage(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    if (typeof window !== "undefined" && "memory" in performance) {
      const memory = (
        performance as Performance & {
          memory?: {
            usedJSHeapSize?: number;
          };
        }
      ).memory;
      return memory?.usedJSHeapSize || 0;
    }
    return 0;
  }

  private formatBytes(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  private printMetrics(): void {
    const runtime = (Date.now() - this.metrics.startTime) / 1000 / 60; // minutes
    const memoryGrowth = this.metrics.currentMemory - this.metrics.startMemory;
    const growthRate = ((memoryGrowth / runtime) * 60) / 1024 / 1024; // MB/hour

    console.log("\n📊 Memory Test Metrics:");
    console.log(`Runtime: ${runtime.toFixed(2)} minutes`);
    console.log(`Start Memory: ${this.formatBytes(this.metrics.startMemory)}`);
    console.log(`Current Memory: ${this.formatBytes(this.metrics.currentMemory)}`);
    console.log(`Peak Memory: ${this.formatBytes(this.metrics.peakMemory)}`);
    console.log(`Memory Growth: ${this.formatBytes(memoryGrowth)}`);
    console.log(`Growth Rate: ${growthRate.toFixed(2)} MB/hour`);
    console.log(`Active Subscriptions: ${this.metrics.subscriptionCount}`);
    console.log(`Total Connections: ${this.metrics.connectionCount}`);
    console.log(`Errors: ${this.metrics.errorCount}`);

    // Get service status
    const status = webSocketPriceService.getStatus();
    console.log("\n🔌 Service Status:");
    console.log(`Connected: ${status.isConnected}`);
    console.log(`Subscribed Symbols: ${status.subscribedSymbols.length}`);
    console.log(`Cached Prices: ${status.cachedPrices}`);

    // Get memory stats from service
    const memStats = webSocketPriceService.getMemoryStats();
    if (memStats.growthRate !== null) {
      console.log(`\n📈 Service Memory Stats:`);
      console.log(`Service Growth Rate: ${(memStats.growthRate / 1024 / 1024).toFixed(2)} MB/hour`);
    }
  }

  /**
   * Test 1: Rapid subscribe/unsubscribe cycles
   */
  async testRapidSubscriptionCycles(): Promise<void> {
    console.log("\n🧪 Test 1: Rapid Subscribe/Unsubscribe Cycles");

    for (let cycle = 0; cycle < 100; cycle++) {
      // Subscribe to all symbols
      for (const symbol of this.testSymbols) {
        const unsubscribe = webSocketPriceService.subscribe(symbol, (_update) => {
          // Simulate processing
        });
        this.subscriptions.push(unsubscribe);
        this.metrics.subscriptionCount++;
      }

      // Brief delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Unsubscribe all
      this.subscriptions.forEach((unsub) => unsub());
      this.subscriptions = [];

      // Update metrics
      this.metrics.currentMemory = this.getMemoryUsage();
      this.metrics.peakMemory = Math.max(this.metrics.peakMemory, this.metrics.currentMemory);

      if (cycle % 10 === 0) {
        console.log(`Cycle ${cycle}/100 completed`);
      }
    }

    this.printMetrics();
  }

  /**
   * Test 2: Connection stability with reconnections
   */
  async testConnectionStability(): Promise<void> {
    console.log("\n🧪 Test 2: Connection Stability with Reconnections");

    for (let i = 0; i < 20; i++) {
      try {
        // Connect
        await webSocketPriceService.connect();
        this.metrics.connectionCount++;

        // Subscribe to some symbols
        for (let j = 0; j < 5; j++) {
          const symbol = this.testSymbols[j];
          const unsubscribe = webSocketPriceService.subscribe(symbol, () => {});
          this.subscriptions.push(unsubscribe);
        }

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Disconnect
        webSocketPriceService.disconnect();
        this.subscriptions = [];

        // Update metrics
        this.metrics.currentMemory = this.getMemoryUsage();
        this.metrics.peakMemory = Math.max(this.metrics.peakMemory, this.metrics.currentMemory);

        console.log(`Connection cycle ${i + 1}/20 completed`);
      } catch (error) {
        this.metrics.errorCount++;
        console.error("Connection error:", error);
      }
    }

    this.printMetrics();
  }

  /**
   * Test 3: Long-running subscription test
   */
  async testLongRunningSubscriptions(): Promise<void> {
    console.log("\n🧪 Test 3: Long-Running Subscriptions (5 minutes)");

    // Connect once
    await webSocketPriceService.connect();

    // Subscribe to all symbols
    for (const symbol of this.testSymbols) {
      const unsubscribe = webSocketPriceService.subscribe(symbol, (update) => {
        // Simulate data processing
        const data = JSON.stringify(update);
        const _parsed = JSON.parse(data);
        // This creates temporary objects to test garbage collection
      });
      this.subscriptions.push(unsubscribe);
    }

    // Monitor memory every 10 seconds for 5 minutes
    const startTime = Date.now();
    const duration = 5 * 60 * 1000; // 5 minutes

    this.testInterval = setInterval(() => {
      this.metrics.currentMemory = this.getMemoryUsage();
      this.metrics.peakMemory = Math.max(this.metrics.peakMemory, this.metrics.currentMemory);

      const elapsed = Date.now() - startTime;
      const progress = ((elapsed / duration) * 100).toFixed(1);
      console.log(
        `Progress: ${progress}% - Memory: ${this.formatBytes(this.metrics.currentMemory)}`
      );

      if (elapsed >= duration) {
        clearInterval(this.testInterval);
        this.cleanup();
        this.printMetrics();
      }
    }, 10000);
  }

  /**
   * Test 4: Memory cleanup verification
   */
  async testMemoryCleanup(): Promise<void> {
    console.log("\n🧪 Test 4: Memory Cleanup Verification");

    // Heavy usage phase
    console.log("Phase 1: Heavy usage...");
    await webSocketPriceService.connect();

    // Create many subscriptions
    for (let i = 0; i < 50; i++) {
      for (const symbol of this.testSymbols) {
        const unsubscribe = webSocketPriceService.subscribe(`${symbol}_${i}`, () => {});
        this.subscriptions.push(unsubscribe);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const memoryAfterHeavyUse = this.getMemoryUsage();
    console.log(`Memory after heavy use: ${this.formatBytes(memoryAfterHeavyUse)}`);

    // Cleanup phase
    console.log("Phase 2: Cleanup...");
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions = [];
    await webSocketPriceService.shutdown();

    // Force garbage collection if available
    if (typeof global !== "undefined" && global.gc) {
      global.gc();
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    const memoryAfterCleanup = this.getMemoryUsage();
    console.log(`Memory after cleanup: ${this.formatBytes(memoryAfterCleanup)}`);

    const memoryRecovered = memoryAfterHeavyUse - memoryAfterCleanup;
    const recoveryPercentage =
      (memoryRecovered / (memoryAfterHeavyUse - this.metrics.startMemory)) * 100;

    console.log(
      `\n✅ Memory recovered: ${this.formatBytes(memoryRecovered)} (${recoveryPercentage.toFixed(1)}%)`
    );

    if (recoveryPercentage < 80) {
      console.warn("⚠️ Warning: Less than 80% memory recovered. Possible memory leak!");
    } else {
      console.log("🎉 Excellent memory recovery!");
    }
  }

  private cleanup(): void {
    if (this.testInterval) {
      clearInterval(this.testInterval);
    }
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions = [];
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log("🚀 Starting WebSocket Memory Leak Tests");
    console.log("Initial memory:", this.formatBytes(this.metrics.startMemory));

    try {
      await this.testRapidSubscriptionCycles();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await this.testConnectionStability();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await this.testMemoryCleanup();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Uncomment for long-running test
      // await this.testLongRunningSubscriptions();

      console.log("\n✅ All tests completed!");
      await webSocketPriceService.shutdown();
    } catch (error) {
      console.error("❌ Test failed:", error);
      this.cleanup();
      await webSocketPriceService.shutdown();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new WebSocketMemoryTest();
  tester
    .runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test runner failed:", error);
      process.exit(1);
    });
}

export { WebSocketMemoryTest };
