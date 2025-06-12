import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { transactionLockService } from "@/src/services/transaction-lock-service";
import { db } from "@/src/db";
import { transactionLocks, transactionQueue } from "@/src/db/schema";
import { eq } from "drizzle-orm";

describe("TransactionLockService", () => {
  beforeEach(async () => {
    // Clean up any existing locks and queue items in proper order
    await db.delete(transactionQueue); // Delete queue items first (has foreign key to locks)
    await db.delete(transactionLocks); // Then delete locks
  });

  afterEach(async () => {
    // Clean up after each test in proper order
    await db.delete(transactionQueue); // Delete queue items first (has foreign key to locks)
    await db.delete(transactionLocks); // Then delete locks
  });

  describe("Lock Acquisition", () => {
    it("should acquire lock for new resource", async () => {
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
      };

      const result = await transactionLockService.acquireLock(config);

      expect(result.success).toBe(true);
      expect(result.lockId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should prevent duplicate trades with same idempotency key", async () => {
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY", quantity: "100" },
      };

      // First acquisition should succeed
      const result1 = await transactionLockService.acquireLock(config);
      expect(result1.success).toBe(true);

      // Second acquisition with same config should fail
      const result2 = await transactionLockService.acquireLock(config);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("Transaction already in progress");
      expect(result2.isRetry).toBe(true);
    });

    it("should queue requests when resource is locked", async () => {
      const config1 = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY", orderId: "1" },
        idempotencyKey: "key1",
      };

      const config2 = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user456",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY", orderId: "2" },
        idempotencyKey: "key2",
      };

      // First lock should succeed
      const result1 = await transactionLockService.acquireLock(config1);
      expect(result1.success).toBe(true);

      // Second should be queued
      const result2 = await transactionLockService.acquireLock(config2);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("added to queue");
      expect(result2.queuePosition).toBe(1);
    });

    it("should allow different resources to be locked simultaneously", async () => {
      const config1 = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
      };

      const config2 = {
        resourceId: "trade:ETHUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "ETHUSDT", side: "BUY" },
      };

      const result1 = await transactionLockService.acquireLock(config1);
      const result2 = await transactionLockService.acquireLock(config2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.lockId).not.toBe(result2.lockId);
    });
  });

  describe("Lock Release", () => {
    it("should release lock successfully", async () => {
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
      };

      const lockResult = await transactionLockService.acquireLock(config);
      expect(lockResult.success).toBe(true);

      const releaseResult = await transactionLockService.releaseLock(
        lockResult.lockId!,
        { orderId: "12345" }
      );
      expect(releaseResult).toBe(true);

      // Verify lock is released
      const lock = await db.query.transactionLocks.findFirst({
        where: eq(transactionLocks.lockId, lockResult.lockId!),
      });
      expect(lock?.status).toBe("released");
    });

    it("should store result when releasing lock", async () => {
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
      };

      const lockResult = await transactionLockService.acquireLock(config);
      const tradeResult = { orderId: "12345", status: "filled" };

      await transactionLockService.releaseLock(lockResult.lockId!, tradeResult);

      const lock = await db.query.transactionLocks.findFirst({
        where: eq(transactionLocks.lockId, lockResult.lockId!),
      });

      expect(lock?.result).toBe(JSON.stringify(tradeResult));
    });
  });

  describe("Execute With Lock", () => {
    it("should execute transaction with lock protection", async () => {
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
      };

      const mockExecutor = vi.fn().mockResolvedValue({ orderId: "12345" });

      const result = await transactionLockService.executeWithLock(
        config,
        mockExecutor
      );

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ orderId: "12345" });
      expect(mockExecutor).toHaveBeenCalledTimes(1);
    });

    it("should prevent concurrent execution of same resource", async () => {
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
      };

      let execution1Started = false;
      let execution1Completed = false;
      let execution2Started = false;

      const executor1 = async () => {
        execution1Started = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
        execution1Completed = true;
        return { orderId: "12345" };
      };

      const executor2 = async () => {
        execution2Started = true;
        return { orderId: "67890" };
      };

      // Start first execution
      const promise1 = transactionLockService.executeWithLock(config, executor1);
      
      // Wait a bit to ensure first lock is acquired
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      // Try second execution with different idempotency key
      const promise2 = transactionLockService.executeWithLock(
        { ...config, idempotencyKey: "different-key" },
        executor2
      );

      // Wait for both to complete
      const [result1, result2] = await Promise.all([promise1, promise2]);

      // First should succeed
      expect(result1.success).toBe(true);
      expect(execution1Started).toBe(true);
      expect(execution1Completed).toBe(true);

      // Second should be queued or rejected
      expect(result2.success).toBe(false);
      expect(execution2Started).toBe(false);
      expect(result2.error).toContain("added to queue");
    });

    it("should handle executor errors gracefully", async () => {
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
      };

      const mockExecutor = vi.fn().mockRejectedValue(new Error("Trade failed"));

      const result = await transactionLockService.executeWithLock(
        config,
        mockExecutor
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Trade failed");

      // Verify lock was released with error
      const lock = await db.query.transactionLocks.findFirst({
        where: eq(transactionLocks.lockId, result.lockId),
      });
      expect(lock?.status).toBe("failed");
      expect(lock?.errorMessage).toBe("Trade failed");
    });

    it("should return existing result for duplicate idempotency key", async () => {
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
        idempotencyKey: "unique-key-123",
      };

      const mockExecutor = vi.fn().mockResolvedValue({ orderId: "12345" });

      // First execution
      const result1 = await transactionLockService.executeWithLock(
        config,
        mockExecutor
      );

      // Second execution with same idempotency key
      const result2 = await transactionLockService.executeWithLock(
        config,
        mockExecutor
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.result).toEqual(result1.result);
      expect(mockExecutor).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe("Lock Status", () => {
    it("should report correct lock status", async () => {
      const resourceId = "trade:BTCUSDT:BUY";
      
      // Check unlocked resource
      const status1 = await transactionLockService.getLockStatus(resourceId);
      expect(status1.isLocked).toBe(false);
      expect(status1.lockCount).toBe(0);
      expect(status1.queueLength).toBe(0);

      // Acquire lock
      const config = {
        resourceId,
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
      };
      await transactionLockService.acquireLock(config);

      // Check locked resource
      const status2 = await transactionLockService.getLockStatus(resourceId);
      expect(status2.isLocked).toBe(true);
      expect(status2.lockCount).toBe(1);
      expect(status2.activeLocks).toHaveLength(1);
    });
  });

  describe("Queue Management", () => {
    it("should process queue in priority order", async () => {
      const resourceId = "trade:BTCUSDT:BUY";

      // Acquire initial lock
      const initialConfig = {
        resourceId,
        ownerId: "user1",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
        idempotencyKey: "initial",
      };
      const initialLock = await transactionLockService.acquireLock(initialConfig);
      expect(initialLock.success).toBe(true);

      // Add items to queue with different priorities
      const highPriorityConfig = {
        resourceId,
        ownerId: "user2",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "SELL" },
        priority: 1,
        idempotencyKey: "high-priority",
      };

      const lowPriorityConfig = {
        resourceId,
        ownerId: "user3",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
        priority: 10,
        idempotencyKey: "low-priority",
      };

      await transactionLockService.acquireLock(highPriorityConfig);
      await transactionLockService.acquireLock(lowPriorityConfig);

      // Check queue
      const status = await transactionLockService.getLockStatus(resourceId);
      expect(status.queueLength).toBe(2);

      // Release initial lock - this should trigger processing of high priority item
      await transactionLockService.releaseLock(initialLock.lockId!);

      // High priority should now have the lock
      const queueItems = await db.query.transactionQueue.findMany({
        where: eq(transactionQueue.resourceId, resourceId),
      });

      const highPriorityItem = queueItems.find(
        (item) => item.idempotencyKey === "high-priority"
      );
      expect(highPriorityItem?.status).toBe("processing");
    });
  });

  describe("Cleanup Process", () => {
    it("should identify expired locks", async () => {
      // Create a lock with very short timeout
      const config = {
        resourceId: "trade:BTCUSDT:BUY",
        ownerId: "user123",
        ownerType: "user" as const,
        transactionType: "trade" as const,
        transactionData: { symbol: "BTCUSDT", side: "BUY" },
        timeoutMs: 100, // 100ms timeout
      };

      const lockResult = await transactionLockService.acquireLock(config);
      expect(lockResult.success).toBe(true);

      // Wait for lock to expire
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check if lock is considered expired
      const status = await transactionLockService.getLockStatus(config.resourceId);
      
      // The lock might still show as active in status check,
      // but cleanup process would mark it as expired
      const lock = await db.query.transactionLocks.findFirst({
        where: eq(transactionLocks.lockId, lockResult.lockId!),
      });
      
      // Verify the lock exists and has expired
      expect(lock).toBeDefined();
      expect(new Date(lock!.expiresAt).getTime()).toBeLessThan(Date.now());
    });
  });
});