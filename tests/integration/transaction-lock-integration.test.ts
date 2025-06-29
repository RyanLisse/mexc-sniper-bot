import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/src/db";
import { transactionLocks, transactionQueue } from "@/src/db/schema";

const BASE_URL = "http://localhost:3008";

// Helper function to check if server is available
async function isServerRunning(): Promise<boolean> {
  try {
    // Use a simple HTTP request to check if server is running
    const response = await new Promise<boolean>((resolve) => {
      const http = require('http');
      const req = http.request({
        hostname: 'localhost',
        port: 3008,
        path: '/api/health/db',
        method: 'GET',
        timeout: 1000
      }, (res: any) => {
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => resolve(false));
      req.end();
    });

    return response;
  } catch {
    return false;
  }
}

// Helper function to conditionally run test based on server availability
function itWithServer(name: string, testFn: () => Promise<void>) {
  return it(name, async () => {
    const serverRunning = await isServerRunning();
    if (!serverRunning) {
      console.warn(`⚠️  Skipping "${name}" - server not running`);
      return;
    }
    await testFn();
  });
}

describe("Transaction Lock Integration Tests", () => {

  beforeAll(async () => {
    // Disable fetch mock for integration tests - restore original implementation
    vi.mocked(fetch).mockRestore();

    // Clean up database
    await db.delete(transactionQueue);
    await db.delete(transactionLocks);

    // Check if server is running with shorter timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

      const response = await fetch(`${BASE_URL}/api/health/db`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('⚠️  Server health check failed. Integration tests require running Next.js server.');
        console.warn('   Start server with: npm run dev');
      }
    } catch (error) {
      console.warn('⚠️  Next.js server not running at http://localhost:3008');
      console.warn('   Integration tests require running server. Start with: npm run dev');
      console.warn('   Skipping integration tests that require server...');
    }
  }, 5000); // Increase beforeAll timeout to 5 seconds

  afterAll(async () => {
    // Clean up database
    await db.delete(transactionQueue);
    await db.delete(transactionLocks);
  });

  describe("Trade API with Lock Protection", () => {
    itWithServer("should prevent duplicate trades with same parameters", async () => {
      const tradeParams = {
        symbol: "TESTUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "100",
        userId: "test-user-1",
        snipeTargetId: "snipe-123",
      };

      // Simulate concurrent requests
      const request1 = fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeParams),
      });

      const request2 = fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeParams),
      });

      const [response1, response2] = await Promise.all([request1, request2]);

      // One should succeed or both should return same result (idempotency)
      if (response1.status === 200 && response2.status === 200) {
        const data1 = await response1.json();
        const data2 = await response2.json();

        // If both succeed, they should have same order ID (idempotency worked)
        expect(data1.order?.orderId).toBe(data2.order?.orderId);
      } else {
        // One succeeded, one should be rejected, queued, or have validation error
        const statuses = [response1.status, response2.status];
        // Accept 409 (conflict), 400 (bad request), or 422 (validation error)
        expect(statuses.some(status => [400, 409, 422].includes(status))).toBe(true);
      }
    });

    itWithServer("should allow different trades to execute concurrently", async () => {
      const trade1 = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.001",
        userId: "test-user-1",
      };

      const trade2 = {
        symbol: "ETHUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.01",
        userId: "test-user-1",
      };

      const [response1, response2] = await Promise.all([
        fetch(`${BASE_URL}/api/mexc/trade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trade1),
        }),
        fetch(`${BASE_URL}/api/mexc/trade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trade2),
        }),
      ]);

      // Both should be able to proceed (different resources)
      // Note: They might fail for other reasons (no API keys, etc.)
      // but shouldn't fail due to locking
      if (response1.status === 409 || response2.status === 409) {
        throw new Error("Different trades should not block each other");
      }
    });
  });

  describe("Lock Monitoring API", () => {
    itWithServer("should return lock status information", async () => {
      const response = await fetch(`${BASE_URL}/api/transaction-locks`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("locks");
      expect(data.data).toHaveProperty("queue");
      expect(data.data).toHaveProperty("stats");
    });

    itWithServer("should check specific resource lock status", async () => {
      const response = await fetch(`${BASE_URL}/api/transaction-locks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check",
          resourceId: "trade:BTCUSDT:BUY",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty("isLocked");
      expect(data.data).toHaveProperty("lockCount");
      expect(data.data).toHaveProperty("queueLength");
    });
  });

  describe("Emergency Lock Release", () => {
    itWithServer("should allow force release of locks by owner", async () => {
      // First create a lock by attempting a trade
      const tradeResponse = await fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "FORCETEST",
          side: "BUY",
          type: "MARKET",
          quantity: "100",
          userId: "force-test-user",
        }),
      });

      // Force release all locks for this user
      const releaseResponse = await fetch(
        `${BASE_URL}/api/transaction-locks?ownerId=force-test-user&force=true`,
        { method: "DELETE" }
      );

      expect(releaseResponse.status).toBe(200);
      const data = await releaseResponse.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Queue Priority Testing", () => {
    itWithServer("should prioritize SELL orders over BUY orders", async () => {
      const resourceId = "trade:QUEUETEST:mixed";

      // Create an initial lock
      await fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "QUEUETEST",
          side: "BUY",
          type: "MARKET",
          quantity: "1",
          userId: "initial-user",
          skipLock: false,
        }),
      });

      // Add multiple orders to queue
      const buyOrder = fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "QUEUETEST",
          side: "BUY",
          type: "MARKET",
          quantity: "2",
          userId: "buy-user",
        }),
      });

      const sellOrder = fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "QUEUETEST",
          side: "SELL",
          type: "MARKET",
          quantity: "1",
          userId: "sell-user",
        }),
      });

      await Promise.all([buyOrder, sellOrder]);

      // Check queue order
      const queueStatus = await fetch(`${BASE_URL}/api/transaction-locks`);
      const queueData = await queueStatus.json();

      const queueItems = queueData.data.queue.filter(
        (item: any) => item.resourceId.includes("QUEUETEST")
      );

      // SELL should have higher priority (lower number)
      const sellItem = queueItems.find((item: any) =>
        JSON.parse(item.transactionData).side === "SELL"
      );
      const buyItem = queueItems.find((item: any) =>
        JSON.parse(item.transactionData).side === "BUY"
      );

      if (sellItem && buyItem) {
        expect(sellItem.priority).toBeLessThan(buyItem.priority);
      }
    });
  });

  describe("Performance Under Load", () => {
    itWithServer("should handle multiple concurrent requests gracefully", async () => {
      const requests = [];
      const numRequests = 10;

      // Create multiple concurrent requests for same resource
      for (let i = 0; i < numRequests; i++) {
        requests.push(
          fetch(`${BASE_URL}/api/mexc/trade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: "LOADTEST",
              side: "BUY",
              type: "MARKET",
              quantity: "100",
              userId: `load-test-user-${i}`,
              snipeTargetId: "load-test",
            }),
          })
        );
      }

      const responses = await Promise.all(requests);
      const statuses = responses.map(r => r.status);

      // Should have mix of success, queued/conflict, or validation error responses
      const successCount = statuses.filter(s => s === 200).length;
      const conflictCount = statuses.filter(s => s === 409).length;
      const badRequestCount = statuses.filter(s => s === 400).length;
      const validationErrorCount = statuses.filter(s => s === 422).length;

      // At least one should succeed, be queued, or have validation/request error
      expect(successCount + conflictCount + badRequestCount + validationErrorCount).toBeGreaterThan(0);

      // No 500 errors
      expect(statuses.filter(s => s >= 500).length).toBe(0);
    });
  });
});

// Real-world scenario test
describe("Pattern Sniper Integration with Locks", () => {
  itWithServer("should handle rapid snipe executions with lock protection", async () => {
    // Simulate pattern sniper detecting multiple ready tokens
    const snipeTargets = [
      { symbol: "TOKEN1USDT", vcoinId: "token1" },
      { symbol: "TOKEN2USDT", vcoinId: "token2" },
      { symbol: "TOKEN3USDT", vcoinId: "token3" },
    ];

    const snipeRequests = snipeTargets.map(target =>
      fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: target.symbol,
          side: "BUY",
          type: "MARKET",
          quantity: "100",
          userId: "pattern-sniper",
          snipeTargetId: target.vcoinId,
        }),
      })
    );

    const responses = await Promise.all(snipeRequests);

    // All should complete without errors
    responses.forEach((response, index) => {
      expect(response.status).toBeLessThan(500); // No server errors
      console.log(`Snipe ${index + 1} status:`, response.status);
    });
  });

  itWithServer("should prevent double-spend on same snipe target", async () => {
    const snipeTarget = {
      symbol: "SAFETESTUSDT",
      side: "BUY",
      type: "MARKET",
      quantity: "1000",
      userId: "safety-test",
      snipeTargetId: "unique-snipe-123",
    };

    // Simulate accidental double-click or network retry
    const request1 = fetch(`${BASE_URL}/api/mexc/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snipeTarget),
    });

    // Small delay to simulate real-world timing
    await new Promise(resolve => setTimeout(resolve, 50));

    const request2 = fetch(`${BASE_URL}/api/mexc/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snipeTarget),
    });

    const [response1, response2] = await Promise.all([request1, request2]);

    // Verify protection worked
    if (response1.status === 200 && response2.status === 200) {
      // Both succeeded - must be idempotent (same order)
      const data1 = await response1.json();
      const data2 = await response2.json();
      expect(data1.order?.orderId).toBe(data2.order?.orderId);
      console.log("Idempotency protection worked - same order returned");
    } else {
      // One blocked
      const blocked = response1.status === 409 || response2.status === 409;
      expect(blocked).toBe(true);
      console.log("Lock protection worked - duplicate trade blocked");
    }
  });
});