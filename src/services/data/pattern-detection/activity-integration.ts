/**
 * Activity Data Integration Module
 *
 * Handles integration with coin activity data for enhanced pattern detection.
 * Provides activity-based confidence enhancements and correlation analysis.
 */

import { and, eq, or } from "drizzle-orm";
import { db } from "@/src/db";
import { coinActivities } from "@/src/db/schemas/patterns";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { ActivityData } from "@/src/schemas/unified/mexc-api-schemas";

/**
 * Activity Data Integration - Query activity data for confidence enhancement
 * Retrieves recent activity data for a given currency/symbol
 */
export async function getActivityDataForSymbol(
  symbol: string,
  vcoinId?: string
): Promise<ActivityData[]> {
  try {
    // Extract base currency from symbol (e.g., 'FCATUSDT' -> 'FCAT')
    const baseCurrency = symbol.replace(/USDT$|BTC$|ETH$|BNB$/, "");

    // Query recent activities for both full symbol and base currency in a single query
    const whereConditions = [eq(coinActivities.isActive, true)];

    // Add currency condition - search for both base currency and full symbol
    if (baseCurrency !== symbol) {
      whereConditions.push(
        or(eq(coinActivities.currency, baseCurrency), eq(coinActivities.currency, symbol))
      );
    } else {
      whereConditions.push(eq(coinActivities.currency, symbol));
    }

    // Add vcoinId filter if available for better accuracy
    if (vcoinId) {
      whereConditions.push(eq(coinActivities.vcoinId, vcoinId));
    }

    const activities = await db
      .select()
      .from(coinActivities)
      .where(and(...whereConditions))
      .limit(10); // Limit to recent activities

    // Transform to ActivityData format
    return activities.map((activity) => ({
      activityId: activity.activityId,
      currency: activity.currency,
      currencyId: activity.currencyId || "",
      activityType: activity.activityType,
    }));
  } catch (error) {
    const safeError = toSafeError(error);
    console.warn(
      "Failed to fetch activity data",
      {
        operation: "activity_data_fetch",
        symbol,
        vcoinId,
        baseCurrency: symbol.replace(/USDT$|BTC$|ETH$|BNB$/, ""),
        error: safeError.message,
      },
      safeError
    );
    return []; // Return empty array on error
  }
}

/**
 * Extract base currency from trading symbol
 * @param symbol - Trading symbol (e.g., 'FCATUSDT')
 * @returns Base currency (e.g., 'FCAT')
 */
export function extractBaseCurrency(symbol: string): string {
  return symbol.replace(/USDT$|BTC$|ETH$|BNB$/, "");
}

/**
 * Check if symbol has sufficient activity data for enhanced analysis
 * @param symbol - Trading symbol to check
 * @param vcoinId - Optional vcoin ID for more precise filtering
 * @returns Boolean indicating if sufficient activity data exists
 */
export async function hasActivityData(symbol: string, vcoinId?: string): Promise<boolean> {
  const activities = await getActivityDataForSymbol(symbol, vcoinId);
  return activities.length > 0;
}

/**
 * Get activity summary for symbol
 * @param symbol - Trading symbol
 * @param vcoinId - Optional vcoin ID
 * @returns Activity summary with metrics
 */
export async function getActivitySummary(
  symbol: string,
  vcoinId?: string
): Promise<{
  totalActivities: number;
  activityTypes: string[];
  hasRecentActivity: boolean;
  activities: ActivityData[];
}> {
  const activities = await getActivityDataForSymbol(symbol, vcoinId);

  return {
    totalActivities: activities.length,
    activityTypes: [...new Set(activities.map((a) => a.activityType))],
    hasRecentActivity: activities.length > 0,
    activities,
  };
}
