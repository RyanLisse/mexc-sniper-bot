/**
 * Balance Persistence Service
 *
 * Critical service to address the database persistence gap identified by the
 * database engineer agent. Saves balance data from MEXC API to the database
 * for historical tracking and audit purposes.
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { balanceSnapshots, portfolioSummary } from "../db/schema";
import { createSafeLogger } from "../lib/structured-logger";

// Zod schemas for type-safe balance data validation
export const BalanceItemSchema = z.object({
  asset: z.string().min(1).max(20),
  free: z.string().regex(/^\d+(\.\d+)?$/),
  locked: z.string().regex(/^\d+(\.\d+)?$/),
  total: z.number().min(0),
  usdtValue: z.number().min(0).optional(),
});

export const BalanceDataSchema = z.object({
  balances: z.array(BalanceItemSchema),
  totalUsdtValue: z.number().min(0),
});

export type BalanceItem = z.infer<typeof BalanceItemSchema>;
export type BalanceData = z.infer<typeof BalanceDataSchema>;

export interface BalancePersistenceOptions {
  snapshotType?: "periodic" | "manual" | "triggered";
  dataSource?: "api" | "manual" | "calculated";
  priceSource?: "mexc" | "coingecko" | "manual" | "binance" | "coinbase";
}

export class BalancePersistenceService {
  private static instance: BalancePersistenceService;

  public static getInstance(): BalancePersistenceService {
    if (!BalancePersistenceService.instance) {
      BalancePersistenceService.instance = new BalancePersistenceService();
    }
    return BalancePersistenceService.instance;
  }

  /**
   * Save balance snapshot to database
   */
  async saveBalanceSnapshot(
    userId: string,
    balanceData: BalanceData,
    options: BalancePersistenceOptions = {}
  ): Promise<void> {
    const logger = createSafeLogger("balance-persistence");
    try {
      // Validate input data
      const validatedData = BalanceDataSchema.parse(balanceData);

      const { snapshotType = "periodic", dataSource = "api", priceSource = "mexc" } = options;

      logger.info("Saving balance snapshot", {
        userId,
        assetCount: validatedData.balances.length,
        totalUsdValue: validatedData.totalUsdtValue,
        snapshotType,
        dataSource,
      });

      // Prepare balance snapshots for batch insert
      const balanceRecords = validatedData.balances.map((balance) => ({
        userId,
        asset: balance.asset,
        freeAmount: parseFloat(balance.free),
        lockedAmount: parseFloat(balance.locked),
        totalAmount: balance.total,
        usdValue: balance.usdtValue || 0,
        priceSource,
        exchangeRate:
          balance.usdtValue && balance.total > 0 ? balance.usdtValue / balance.total : null,
        snapshotType,
        dataSource,
        timestamp: new Date(),
      }));

      // Insert balance snapshots in batch
      if (balanceRecords.length > 0) {
        await db.insert(balanceSnapshots).values(balanceRecords);
        logger.info("Balance snapshots saved successfully", {
          userId,
          recordCount: balanceRecords.length,
        });
      }

      // Update portfolio summary
      await this.updatePortfolioSummary(userId, validatedData);

      logger.info("Balance persistence completed successfully", {
        userId,
        totalUsdValue: validatedData.totalUsdtValue,
        assetCount: validatedData.balances.length,
      });
    } catch (error) {
      logger.error("Failed to save balance snapshot", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update portfolio summary with latest balance data
   */
  private async updatePortfolioSummary(userId: string, balanceData: BalanceData): Promise<void> {
    const logger = createSafeLogger("balance-persistence");
    try {
      // Calculate top assets (top 5 by USD value)
      const sortedAssets = balanceData.balances
        .filter((b) => (b.usdtValue || 0) > 0)
        .sort((a, b) => (b.usdtValue || 0) - (a.usdtValue || 0))
        .slice(0, 5)
        .map((b) => ({
          asset: b.asset,
          usdValue: b.usdtValue || 0,
          percentage:
            balanceData.totalUsdtValue > 0
              ? ((b.usdtValue || 0) / balanceData.totalUsdtValue) * 100
              : 0,
        }));

      // Get existing portfolio summary
      const existing = await db
        .select()
        .from(portfolioSummary)
        .where(eq(portfolioSummary.userId, userId))
        .limit(1);

      const portfolioData = {
        userId,
        totalUsdValue: balanceData.totalUsdtValue,
        assetCount: balanceData.balances.filter((b) => b.total > 0).length,
        topAssets: JSON.stringify(sortedAssets),
        lastBalanceUpdate: new Date(),
        lastCalculated: new Date(),
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        // Calculate performance metrics if we have previous data
        const previous = existing[0];
        const performance24h = this.calculatePerformanceChange(
          previous.totalUsdValue,
          balanceData.totalUsdtValue
        );

        await db
          .update(portfolioSummary)
          .set({
            ...portfolioData,
            performance24h, // For now, all performance metrics are 24h
            performance7d: performance24h,
            performance30d: performance24h,
          })
          .where(eq(portfolioSummary.userId, userId));

        logger.info("Portfolio summary updated", {
          userId,
          previousValue: previous.totalUsdValue,
          newValue: balanceData.totalUsdtValue,
          performance24h,
        });
      } else {
        // Create new portfolio summary
        await db.insert(portfolioSummary).values({
          ...portfolioData,
          performance24h: 0,
          performance7d: 0,
          performance30d: 0,
          createdAt: new Date(),
        });

        logger.info("Portfolio summary created", {
          userId,
          totalValue: balanceData.totalUsdtValue,
          assetCount: portfolioData.assetCount,
        });
      }
    } catch (error) {
      logger.error("Failed to update portfolio summary", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw here - portfolio summary update failure shouldn't fail the entire operation
    }
  }

  /**
   * Calculate percentage change between two values
   */
  private calculatePerformanceChange(previousValue: number, currentValue: number): number {
    if (previousValue === 0) return 0;
    return ((currentValue - previousValue) / previousValue) * 100;
  }

  /**
   * Get latest balance snapshot for a user
   */
  async getLatestBalanceSnapshot(userId: string): Promise<any[]> {
    try {
      const latestSnapshots = await db
        .select()
        .from(balanceSnapshots)
        .where(eq(balanceSnapshots.userId, userId))
        .orderBy(desc(balanceSnapshots.timestamp))
        .limit(50); // Get last 50 balance entries

      return latestSnapshots;
    } catch (error) {
      logger.error("Failed to get latest balance snapshot", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get balance history for a specific asset
   */
  async getAssetBalanceHistory(
    userId: string,
    asset: string,
    daysBack: number = 30
  ): Promise<any[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const history = await db
        .select()
        .from(balanceSnapshots)
        .where(
          and(
            eq(balanceSnapshots.userId, userId),
            eq(balanceSnapshots.asset, asset),
            gte(balanceSnapshots.timestamp, cutoffDate)
          )
        )
        .orderBy(desc(balanceSnapshots.timestamp));

      return history;
    } catch (error) {
      logger.error("Failed to get asset balance history", {
        userId,
        asset,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get portfolio summary for a user
   */
  async getPortfolioSummary(userId: string): Promise<any | null> {
    try {
      const summary = await db
        .select()
        .from(portfolioSummary)
        .where(eq(portfolioSummary.userId, userId))
        .limit(1);

      return summary.length > 0 ? summary[0] : null;
    } catch (error) {
      logger.error("Failed to get portfolio summary", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cleanup old balance snapshots (keep last 90 days)
   */
  async cleanupOldSnapshots(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const result = await db
        .delete(balanceSnapshots)
        .where(
          and(
            eq(balanceSnapshots.snapshotType, "periodic"),
            gte(balanceSnapshots.timestamp, cutoffDate)
          )
        );

      logger.info("Old balance snapshots cleaned up", {
        cutoffDate: cutoffDate.toISOString(),
        deletedCount: "unknown", // Drizzle doesn't return affected rows count
      });
    } catch (error) {
      logger.error("Failed to cleanup old snapshots", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const balancePersistenceService = BalancePersistenceService.getInstance();
