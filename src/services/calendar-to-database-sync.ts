/**
 * Calendar to Database Sync Service
 * 
 * Automatically syncs qualifying MEXC calendar launches to database as snipe targets.
 * This creates a single source of truth and solves rate limiting issues.
 */

import { db } from "@/src/db";
import { snipeTargets, user } from "@/src/db/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";

interface CalendarEntry {
  vcoinId: string;
  vcoinNameFull: string;
  firstOpenTime: number; // Timestamp number
  symbol?: string;
}

interface SyncResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export class CalendarToDatabaseSyncService {
  private static instance: CalendarToDatabaseSyncService | null = null;
  private isRunning = false;
  private lastSyncTime: Date | null = null;

  private constructor() {}

  static getInstance(): CalendarToDatabaseSyncService {
    if (!CalendarToDatabaseSyncService.instance) {
      CalendarToDatabaseSyncService.instance = new CalendarToDatabaseSyncService();
    }
    return CalendarToDatabaseSyncService.instance;
  }

  /**
   * Ensure system user exists for system-level targets
   */
  private async ensureSystemUser(): Promise<void> {
    try {
      const existingUser = await db
        .select()
        .from(user)
        .where(eq(user.id, "system"))
        .limit(1);

      if (existingUser.length === 0) {
        await db.insert(user).values({
          id: "system",
          email: "system@mexc-sniper-bot.local",
          name: "System User",
          emailVerified: true,
        });
        console.info("✅ Created system user for calendar sync");
      }
    } catch (error) {
      console.error("Failed to ensure system user exists:", error);
      throw new Error(`System user creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync qualifying calendar launches to database
   */
  async syncCalendarToDatabase(userId = "system", options: {
    timeWindowHours?: number;
    forceSync?: boolean;
    dryRun?: boolean;
  } = {}): Promise<SyncResult> {
    const { timeWindowHours = 24, forceSync = false, dryRun = false } = options;

    if (this.isRunning && !forceSync) {
      return {
        success: false,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: ["Sync already running"]
      };
    }

    this.isRunning = true;
    const result: SyncResult = {
      success: true,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    try {
      console.info(`🔄 Starting calendar-to-database sync (userId: ${userId}, window: ${timeWindowHours}h, dryRun: ${dryRun})`);

      // 0. Ensure system user exists (for system-level targets)
      if (userId === "system" && !dryRun) {
        await this.ensureSystemUser();
      }

      // 1. Fetch calendar data
      const calendarEntries = await this.fetchCalendarData();
      if (!calendarEntries || calendarEntries.length === 0) {
        throw new Error("No calendar data available");
      }

      // 2. Filter qualifying launches (within time window)
      const qualifyingLaunches = this.filterQualifyingLaunches(calendarEntries, timeWindowHours);
      result.processed = qualifyingLaunches.length;

      console.info(`📅 Found ${calendarEntries.length} total launches, ${qualifyingLaunches.length} qualifying`);

      // 3. Process each qualifying launch
      for (const launch of qualifyingLaunches) {
        try {
          await this.processLaunch(launch, userId, dryRun, result);
        } catch (error) {
          const errorMsg = `Failed to process launch ${launch.vcoinId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // 4. Cleanup old targets (older than time window)
      if (!dryRun) {
        await this.cleanupOldTargets(timeWindowHours, result);
      }

      this.lastSyncTime = new Date();
      
      console.info(`✅ Sync completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

    } catch (error) {
      result.success = false;
      const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
      result.errors.push(errorMsg);
      console.error("❌ Calendar sync failed:", errorMsg);
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Fetch calendar data from MEXC API
   */
  private async fetchCalendarData(): Promise<CalendarEntry[]> {
    try {
      const response = await fetch("http://localhost:3008/api/mexc/calendar");
      if (!response.ok) {
        throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(`Calendar API failed: ${result.error}`);
      }

      return result.data || [];
    } catch (error) {
      console.error("Failed to fetch calendar data:", error);
      throw error;
    }
  }

  /**
   * Filter calendar entries for qualifying launches
   */
  private filterQualifyingLaunches(entries: CalendarEntry[], timeWindowHours: number): CalendarEntry[] {
    const now = Date.now();
    const timeWindow = timeWindowHours * 60 * 60 * 1000; // Convert to milliseconds

    return entries.filter(entry => {
      try {
        // Parse launch time (firstOpenTime is already a timestamp in milliseconds)
        const launchTime = entry.firstOpenTime;

        // Include launches that are:
        // 1. In the future (not already launched)
        // 2. Within the specified time window
        const isUpcoming = launchTime > now;
        const isWithinWindow = launchTime < (now + timeWindow);
        
        return isUpcoming && isWithinWindow && entry.vcoinId && entry.vcoinNameFull;
      } catch (error) {
        console.warn(`Invalid launch time for ${entry.vcoinId}:`, entry.firstOpenTime);
        return false;
      }
    });
  }

  /**
   * Process individual launch entry
   */
  private async processLaunch(
    launch: CalendarEntry, 
    userId: string, 
    dryRun: boolean, 
    result: SyncResult
  ): Promise<void> {
    const symbolName = launch.symbol || `${launch.vcoinNameFull}USDT`;
    
    // Check if target already exists
    const existingTarget = await db
      .select()
      .from(snipeTargets)
      .where(and(
        eq(snipeTargets.vcoinId, launch.vcoinId),
        eq(snipeTargets.userId, userId)
      ))
      .limit(1);

    if (existingTarget.length > 0) {
      // Update existing target
      if (!dryRun) {
        await db
          .update(snipeTargets)
          .set({
            symbolName,
            targetExecutionTime: new Date(launch.firstOpenTime),
            status: "ready",
            confidenceScore: 85.0, // High confidence for calendar launches
            riskLevel: "medium",
            updatedAt: new Date(),
          })
          .where(eq(snipeTargets.id, existingTarget[0].id));
      }
      result.updated++;
      console.debug(`Updated target for ${launch.vcoinNameFull} (${launch.vcoinId})`);
    } else {
      // Create new target
      if (!dryRun) {
        console.debug(`🔧 Inserting target: vcoinId=${launch.vcoinId}, symbolName=${symbolName}, userId=${userId}`);
        try {
          const insertResult = await db.insert(snipeTargets).values({
            userId,
            vcoinId: launch.vcoinId,
            symbolName,
            positionSizeUsdt: 100, // Default position size
            stopLossPercent: 5.0, // Default 5% stop loss
            targetExecutionTime: new Date(launch.firstOpenTime),
          });
          console.debug(`✅ Target inserted successfully:`, insertResult);
        } catch (insertError) {
          console.error(`❌ Database insert failed for ${launch.vcoinId}:`, insertError);
          throw insertError;
        }
      }
      result.created++;
      console.debug(`Created target for ${launch.vcoinNameFull} (${launch.vcoinId})`);
    }
  }

  /**
   * Cleanup old targets that are past the time window
   */
  private async cleanupOldTargets(timeWindowHours: number, result: SyncResult): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - (timeWindowHours * 60 * 60 * 1000));
      
      const cleanupResult = await db
        .delete(snipeTargets)
        .where(and(
          lt(snipeTargets.targetExecutionTime, cutoffTime),
          inArray(snipeTargets.status, ["pending", "ready"])
        ));

      console.info(`🧹 Cleaned up old targets (cutoff: ${cutoffTime.toISOString()})`);
    } catch (error) {
      console.error("Failed to cleanup old targets:", error);
      result.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime?.toISOString() || null,
    };
  }

  /**
   * Manual trigger for sync
   */
  async triggerSync(userId = "system", options: {
    timeWindowHours?: number;
    forceSync?: boolean;
  } = {}): Promise<SyncResult> {
    console.info("🔄 Manual sync triggered");
    return this.syncCalendarToDatabase(userId, { ...options, forceSync: true });
  }
}

// Export singleton instance
export const calendarSyncService = CalendarToDatabaseSyncService.getInstance();