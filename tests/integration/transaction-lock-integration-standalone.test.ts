import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { db } from "@/src/db";
import { transactionLocks, transactionQueue } from "@/src/db/schema";
import { TransactionLockService } from "@/src/services/transaction-lock-service";

// Mock fetch for API testing without server
const mockFetch = vi.fn();

describe("Transaction Lock Integration Tests (Standalone)", () => {
  let lockService: TransactionLockService;
  
  beforeAll(async () => {
    // Clean up database
    await db.delete(transactionQueue);
    await db.delete(transactionLocks);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Override global fetch mock with our test mock
    global.fetch = mockFetch;
    
    // Force SQLite for tests
    process.env.DATABASE_URL = "sqlite:///./test-mexc.db";
    process.env.FORCE_SQLITE = "true";
    
    // Clean up database before each test
    await db.delete(transactionQueue);
    await db.delete(transactionLocks);
    
    // Wait a bit for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Create fresh instance for each test
    lockService = new TransactionLockService();
  });

  afterAll(async () => {
    if (lockService) {
      lockService.stopCleanupProcess();
    }
    await db.delete(transactionQueue);
    await db.delete(transactionLocks);
  });

  describe("Trade API with Lock Protection", () => {
    it.skip("should prevent duplicate trades with same parameters", async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, orderId: "12345" }),
      });

      const tradeParams = {
        symbol: "BTCUSDT",
        side: "BUY" as const,
        amount: 100,
      };

      // First trade should succeed
      const result1 = await lockService.executeWithLock({
        resourceId: `trade:${tradeParams.symbol}:${tradeParams.side}`,
        ownerId: "user123",
        ownerType: "user",
        transactionType: "trade",
        transactionData: tradeParams,
      }, async () => {
        // Simulate API call
        const response = await fetch('/api/mexc/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tradeParams),
        });
        return response.json();
      });

      expect(result1.success).toBe(true);
      expect(result1.result?.orderId).toBe("12345");

      // Second identical trade with SAME idempotency key should return existing result
      const result2 = await lockService.executeWithLock({
        resourceId: `trade:${tradeParams.symbol}:${tradeParams.side}`,
        ownerId: "user123",
        ownerType: "user",
        transactionType: "trade",
        transactionData: tradeParams, // Same data = same idempotency key
      }, async () => {
        throw new Error("This should not execute due to idempotency");
      });

      // Should return existing result, not error
      expect(result2.success).toBe(true);
      expect(result2.result?.orderId).toBe("12345");
    });

    it.skip("should allow different trades to execute concurrently", async () => {
      // Mock API responses for different symbols
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, orderId: "11111" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, orderId: "22222" }),
        });

      const trade1Params = {
        symbol: "BTCUSDT",
        side: "BUY" as const,
        amount: 100,
      };

      const trade2Params = {
        symbol: "ETHUSDT", // Different symbol = different resource
        side: "BUY" as const,
        amount: 50,
      };

      // Execute both trades concurrently - they should both succeed since different resources
      const [result1, result2] = await Promise.all([
        lockService.executeWithLock({
          resourceId: `trade:${trade1Params.symbol}:${trade1Params.side}`,
          ownerId: "user123",
          ownerType: "user",
          transactionType: "trade",
          transactionData: trade1Params,
          idempotencyKey: "trade1-key", // Explicit keys to avoid collision
        }, async () => {
          const response = await fetch('/api/mexc/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trade1Params),
          });
          return response.json();
        }),
        
        lockService.executeWithLock({
          resourceId: `trade:${trade2Params.symbol}:${trade2Params.side}`,
          ownerId: "user123",
          ownerType: "user",
          transactionType: "trade",
          transactionData: trade2Params,
          idempotencyKey: "trade2-key", // Explicit keys to avoid collision
        }, async () => {
          const response = await fetch('/api/mexc/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trade2Params),
          });
          return response.json();
        })
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Note: Due to Promise.all, the order might not be guaranteed with mocks
      const orderIds = [result1.result?.orderId, result2.result?.orderId].sort();
      expect(orderIds).toEqual(["11111", "22222"]);
    });
  });

  describe("Lock Monitoring", () => {
    it("should return lock status information", async () => {
      // Create a test lock
      await lockService.acquireLock({
        resourceId: "test:resource:status",
        ownerId: "user123",
        ownerType: "user",
        transactionType: "trade",
        transactionData: { test: true },
      });

      // Check lock status
      const activeLocks = await lockService.getActiveLocks();
      expect(activeLocks.length).toBeGreaterThan(0);

      const testLock = activeLocks.find(lock => lock.resourceId === "test:resource:status");
      expect(testLock).toBeDefined();
      expect(testLock?.ownerId).toBe("user123");
    });

    it("should check specific resource lock status", async () => {
      const resourceId = "test:specific:resource";
      
      // Initially no lock
      const isLocked1 = await lockService.isResourceLocked(resourceId);
      expect(isLocked1).toBe(false);

      // Create lock
      await lockService.acquireLock({
        resourceId,
        ownerId: "user456",
        ownerType: "user",
        transactionType: "trade",
        transactionData: { specific: true },
      });

      // Now should be locked
      const isLocked2 = await lockService.isResourceLocked(resourceId);
      expect(isLocked2).toBe(true);

      // Release lock
      await lockService.releaseLockByResource(resourceId, "user456");

      // Should be unlocked again
      const isLocked3 = await lockService.isResourceLocked(resourceId);
      expect(isLocked3).toBe(false);
    });
  });

  describe("Emergency Lock Release", () => {
    it("should allow force release of locks by owner", async () => {
      const resourceId = "test:emergency:release";
      
      // Create lock
      const lockResult = await lockService.acquireLock({
        resourceId,
        ownerId: "user789",
        ownerType: "user",
        transactionType: "trade",
        transactionData: { emergency: true },
      });

      expect(lockResult.success).toBe(true);

      // Verify lock exists
      const isLocked = await lockService.isResourceLocked(resourceId);
      expect(isLocked).toBe(true);

      // Force release by owner
      const releaseResult = await lockService.releaseLockByResource(resourceId, "user789");
      expect(releaseResult).toBe(true);

      // Verify lock is released
      const isStillLocked = await lockService.isResourceLocked(resourceId);
      expect(isStillLocked).toBe(false);
    });
  });

  describe("Queue Priority Testing", () => {
    it("should add items to queue when resource is locked", async () => {
      // First acquire a lock to force subsequent requests into queue
      const initialLock = await lockService.acquireLock({
        resourceId: "trade:BTCUSDT:priority",
        ownerId: "initial-user",
        ownerType: "user",
        transactionType: "trade",
        transactionData: { symbol: "BTCUSDT", side: "INIT" },
        idempotencyKey: "initial-lock",
      });
      expect(initialLock.success).toBe(true);

      // Now create queued transactions - lower priority number = higher priority
      const buyResult = await lockService.executeWithLock({
        resourceId: "trade:BTCUSDT:priority",
        ownerId: "user1",
        ownerType: "user",
        transactionType: "trade",
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
        priority: 5, // Lower priority (higher number)
        idempotencyKey: "buy-key",
      }, async () => {
        return { orderId: "buy-123" };
      });

      const sellResult = await lockService.executeWithLock({
        resourceId: "trade:BTCUSDT:priority",
        ownerId: "user2",
        ownerType: "user",
        transactionType: "trade",
        transactionData: { symbol: "BTCUSDT", side: "SELL" },
        priority: 1, // Higher priority (lower number)
        idempotencyKey: "sell-key",
      }, async () => {
        return { orderId: "sell-456" };
      });

      // Both should be queued due to existing lock
      expect(buyResult.success).toBe(false);
      expect(sellResult.success).toBe(false);
      expect(buyResult.error).toContain("added to queue");
      expect(sellResult.error).toContain("added to queue");

      // Verify queue status
      const queueStatus = await lockService.getLockStatus("trade:BTCUSDT:priority");
      expect(queueStatus.queueLength).toBe(2);
      
      // Release the initial lock
      await lockService.releaseLock(initialLock.lockId!);
    });
  });

  describe("Performance Under Load", () => {
    it("should handle multiple concurrent requests gracefully", async () => {
      const concurrentRequests = 20;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = lockService.executeWithLock({
          resourceId: `trade:LOAD:${i}`,
          ownerId: `user${i}`,
          ownerType: "user",
          transactionType: "trade",
          transactionData: { index: i },
        }, async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return { processed: i };
        });
        
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      
      // All requests should succeed since they have different resource IDs
      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(concurrentRequests);
    });
  });
});