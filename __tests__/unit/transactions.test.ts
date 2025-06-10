import { describe, expect, it, beforeEach, afterEach, beforeAll } from 'vitest';
import { db } from '@/src/db';
import { transactions, type NewTransaction, type Transaction } from '@/src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

describe('Transactions Table', () => {
  const testUserId = 'test-user-transactions';
  let createdTransactionIds: number[] = [];

  beforeAll(async () => {
    // Ensure database is migrated
    try {
      await migrate(db, { migrationsFolder: './src/db/migrations' });
    } catch (error) {
      // Migration might already be applied
      console.log('Migration skipped or already applied');
    }
  });

  afterEach(async () => {
    // Clean up test data
    for (const id of createdTransactionIds) {
      await db.delete(transactions).where(eq(transactions.id, id));
    }
    createdTransactionIds = [];
  });

  describe('Transaction Creation', () => {
    it('should create a buy transaction', async () => {
      const buyTransaction: NewTransaction = {
        userId: testUserId,
        transactionType: 'buy',
        symbolName: 'BTCUSDT',
        buyPrice: 50000.0,
        buyQuantity: 0.001,
        buyTotalCost: 50.05, // Including fees
        buyTimestamp: Math.floor(Date.now() / 1000),
        buyOrderId: 'buy-order-123',
        fees: 0.05,
        status: 'completed',
      };

      const [created] = await db.insert(transactions).values(buyTransaction).returning();
      createdTransactionIds.push(created.id);

      expect(created).toBeDefined();
      expect(created.userId).toBe(testUserId);
      expect(created.transactionType).toBe('buy');
      expect(created.symbolName).toBe('BTCUSDT');
      expect(created.buyPrice).toBe(50000.0);
      expect(created.status).toBe('completed');
    });

    it('should create a sell transaction', async () => {
      const sellTransaction: NewTransaction = {
        userId: testUserId,
        transactionType: 'sell',
        symbolName: 'ETHUSDT',
        sellPrice: 3000.0,
        sellQuantity: 0.5,
        sellTotalRevenue: 1499.25, // After fees
        sellTimestamp: Math.floor(Date.now() / 1000),
        sellOrderId: 'sell-order-456',
        fees: 0.75,
        status: 'completed',
      };

      const [created] = await db.insert(transactions).values(sellTransaction).returning();
      createdTransactionIds.push(created.id);

      expect(created).toBeDefined();
      expect(created.transactionType).toBe('sell');
      expect(created.sellPrice).toBe(3000.0);
      expect(created.sellTotalRevenue).toBe(1499.25);
    });

    it('should create a complete trade with profit/loss calculation', async () => {
      const completeTradeTransaction: NewTransaction = {
        userId: testUserId,
        transactionType: 'complete_trade',
        symbolName: 'ADAUSDT',
        vcoinId: 'ada-cardano',
        buyPrice: 0.5,
        buyQuantity: 1000,
        buyTotalCost: 500.25, // Including fees
        buyTimestamp: Math.floor((Date.now() - 3600000) / 1000), // 1 hour ago
        buyOrderId: 'buy-ada-123',
        sellPrice: 0.55,
        sellQuantity: 1000,
        sellTotalRevenue: 549.45, // After fees
        sellTimestamp: Math.floor(Date.now() / 1000),
        sellOrderId: 'sell-ada-456',
        profitLoss: 49.20, // 549.45 - 500.25
        profitLossPercentage: 9.83, // (49.20 / 500.25) * 100
        fees: 1.05, // 0.25 + 0.80
        status: 'completed',
        notes: 'Successful scalp trade on ADA',
      };

      const [created] = await db.insert(transactions).values(completeTradeTransaction).returning();
      createdTransactionIds.push(created.id);

      expect(created).toBeDefined();
      expect(created.transactionType).toBe('complete_trade');
      expect(created.profitLoss).toBe(49.20);
      expect(created.profitLossPercentage).toBe(9.83);
      expect(created.notes).toBe('Successful scalp trade on ADA');
    });

    it('should create a loss transaction', async () => {
      const lossTransaction: NewTransaction = {
        userId: testUserId,
        transactionType: 'complete_trade',
        symbolName: 'DOGEUSDT',
        buyPrice: 0.08,
        buyQuantity: 10000,
        buyTotalCost: 800.80,
        buyTimestamp: Math.floor((Date.now() - 7200000) / 1000), // 2 hours ago
        sellPrice: 0.075,
        sellQuantity: 10000,
        sellTotalRevenue: 749.25,
        sellTimestamp: Math.floor(Date.now() / 1000),
        profitLoss: -51.55, // 749.25 - 800.80
        profitLossPercentage: -6.44, // (-51.55 / 800.80) * 100
        fees: 1.55,
        status: 'completed',
        notes: 'Stop loss triggered',
      };

      const [created] = await db.insert(transactions).values(lossTransaction).returning();
      createdTransactionIds.push(created.id);

      expect(created).toBeDefined();
      expect(created.profitLoss).toBe(-51.55);
      expect(created.profitLossPercentage).toBe(-6.44);
      expect(created.status).toBe('completed');
    });
  });

  describe('Transaction Queries', () => {
    beforeEach(async () => {
      // Insert test data
      const testTransactions: NewTransaction[] = [
        {
          userId: testUserId,
          transactionType: 'complete_trade',
          symbolName: 'BTCUSDT',
          profitLoss: 100.0,
          profitLossPercentage: 5.0,
          status: 'completed',
          transactionTime: Math.floor(new Date('2025-06-09T10:00:00Z').getTime() / 1000),
        },
        {
          userId: testUserId,
          transactionType: 'complete_trade',
          symbolName: 'ETHUSDT',
          profitLoss: -50.0,
          profitLossPercentage: -2.5,
          status: 'completed',
          transactionTime: Math.floor(new Date('2025-06-09T11:00:00Z').getTime() / 1000),
        },
        {
          userId: testUserId,
          transactionType: 'complete_trade',
          symbolName: 'ADAUSDT',
          profitLoss: 25.0,
          profitLossPercentage: 1.25,
          status: 'completed',
          transactionTime: Math.floor(new Date('2025-06-09T12:00:00Z').getTime() / 1000),
        },
      ];

      for (const transaction of testTransactions) {
        const [created] = await db.insert(transactions).values(transaction).returning();
        createdTransactionIds.push(created.id);
      }
    });

    it('should fetch user transactions ordered by time', async () => {
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, testUserId))
        .orderBy(desc(transactions.transactionTime));

      expect(userTransactions).toHaveLength(3);
      expect(userTransactions[0].symbolName).toBe('ADAUSDT'); // Most recent
      expect(userTransactions[1].symbolName).toBe('ETHUSDT');
      expect(userTransactions[2].symbolName).toBe('BTCUSDT'); // Oldest
    });

    it('should calculate total profit/loss for user', async () => {
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, testUserId));

      const totalProfitLoss = userTransactions.reduce(
        (sum, transaction) => sum + (transaction.profitLoss || 0),
        0
      );

      expect(totalProfitLoss).toBe(75.0); // 100 - 50 + 25
    });

    it('should filter profitable vs losing trades', async () => {
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, testUserId));

      const profitableTrades = userTransactions.filter(t => (t.profitLoss || 0) > 0);
      const losingTrades = userTransactions.filter(t => (t.profitLoss || 0) < 0);

      expect(profitableTrades).toHaveLength(2);
      expect(losingTrades).toHaveLength(1);
    });

    it('should get transactions by symbol', async () => {
      const btcTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.symbolName, 'BTCUSDT'));

      expect(btcTransactions).toHaveLength(1);
      expect(btcTransactions[0].symbolName).toBe('BTCUSDT');
    });
  });

  describe('Transaction Status Management', () => {
    it('should default to pending status', async () => {
      const pendingTransaction: NewTransaction = {
        userId: testUserId,
        transactionType: 'buy',
        symbolName: 'LINKUSDT',
        buyPrice: 15.0,
        buyQuantity: 10,
        buyTotalCost: 150.15,
      };

      const [created] = await db.insert(transactions).values(pendingTransaction).returning();
      createdTransactionIds.push(created.id);

      expect(created.status).toBe('pending');
    });

    it('should update transaction status', async () => {
      const [created] = await db.insert(transactions).values({
        userId: testUserId,
        transactionType: 'buy',
        symbolName: 'DOTUSDT',
        status: 'pending',
      }).returning();
      createdTransactionIds.push(created.id);

      // Update status to completed
      await db
        .update(transactions)
        .set({ status: 'completed', updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(transactions.id, created.id));

      const updated = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, created.id))
        .limit(1);

      expect(updated[0].status).toBe('completed');
    });
  });

  describe('Data Validation', () => {
    it('should require userId and transactionType', async () => {
      await expect(async () => {
        await db.insert(transactions).values({
          // Missing required fields
          symbolName: 'BTCUSDT',
        } as NewTransaction);
      }).rejects.toThrow();
    });

    it('should handle null values for optional fields', async () => {
      const minimalTransaction: NewTransaction = {
        userId: testUserId,
        transactionType: 'buy',
        symbolName: 'MINIMALUSDT',
      };

      const [created] = await db.insert(transactions).values(minimalTransaction).returning();
      createdTransactionIds.push(created.id);

      expect(created.buyPrice).toBeNull();
      expect(created.sellPrice).toBeNull();
      expect(created.profitLoss).toBeNull();
      expect(created.vcoinId).toBeNull();
    });
  });
});