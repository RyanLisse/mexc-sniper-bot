import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Pattern to Database Bridge Service
 *
 * Automatically converts pattern detection events into snipe_targets database records.
 * This bridges the gap between pattern detection and auto-sniping execution.
 *
 * Data Flow: PatternDetectionCore → PatternToDatabaseBridge → Database snipe_targets → AutoSnipingOrchestrator
 */

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { PatternMatch } from "../../../core/pattern-detection/interfaces";
import {
  EnhancedPatternDetectionCore,
  type PatternDetectionEventData,
} from "../../../core/pattern-detection/pattern-detection-core-enhanced";
import { db } from "../../../db";
import { snipeTargets, userPreferences } from "../../../db/schema";
import { toSafeError } from "../../../lib/error-type-utils";

import { createLogger } from "../../../lib/unified-logger";

// ============================================================================
// Configuration Schema
// ============================================================================

const BridgeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minConfidenceThreshold: z.number().min(0).max(100).default(75),
  maxTargetsPerUser: z.number().min(1).max(100).default(10),
  defaultPositionSizeUsdt: z.number().min(10).max(10000).default(100),
  defaultStopLossPercent: z.number().min(1).max(50).default(15),
  defaultTakeProfitLevel: z.number().min(1).max(4).default(2),
  autoAssignPriority: z.boolean().default(true),
  enableRiskFiltering: z.boolean().default(true),
  supportedPatternTypes: z
    .array(z.string())
    .default(["ready_state", "pre_ready", "launch_sequence"]),
  userIdMapping: z.record(z.string()).default({}), // Maps pattern sources to user IDs
  batchProcessing: z.boolean().default(true),
  batchSize: z.number().min(1).max(100).default(25),
});

type BridgeConfig = z.infer<typeof BridgeConfigSchema>;

// ============================================================================
// Database Record Schema
// ============================================================================

const SnipeTargetRecordSchema = z.object({
  userId: z.string(),
  vcoinId: z.string(),
  symbolName: z.string(),
  entryStrategy: z.string().default("market"),
  positionSizeUsdt: z.number().positive(),
  takeProfitLevel: z.number().min(1).max(4),
  takeProfitCustom: z.number().optional(),
  stopLossPercent: z.number().positive(),
  status: z
    .enum(["pending", "ready", "executing", "completed", "failed", "cancelled"])
    .default("pending"),
  priority: z.number().min(1).max(10).default(5),
  targetExecutionTime: z.date().optional(),
  confidenceScore: z.number().min(0).max(100),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
});

type SnipeTargetRecord = z.infer<typeof SnipeTargetRecordSchema>;

// ============================================================================
// Pattern to Database Bridge Service
// ============================================================================

export class PatternToDatabaseBridge {
  private static instance: PatternToDatabaseBridge;
  private logger = createLogger("pattern-to-database-bridge", {
    enableStructuredLogging: process.env.NODE_ENV === "production",
    enablePerformanceLogging: true,
  });
  private isListening = false;
  private config: BridgeConfig;
  private patternDetectionCore: EnhancedPatternDetectionCore;
  private processedPatterns = new Set<string>(); // Deduplication cache

  private constructor(config?: Partial<BridgeConfig>) {
    this.config = BridgeConfigSchema.parse(config || {});
    this.patternDetectionCore = EnhancedPatternDetectionCore.getInstance();

    this.logger.info("PatternToDatabaseBridge initialized", {
      config: this.config,
      supportedPatterns: this.config.supportedPatternTypes.length,
    });
  }

  static getInstance(config?: Partial<BridgeConfig>): PatternToDatabaseBridge {
    if (!PatternToDatabaseBridge.instance) {
      PatternToDatabaseBridge.instance = new PatternToDatabaseBridge(config);
    } else if (config) {
      // Update configuration if provided (useful for testing)
      PatternToDatabaseBridge.instance.config =
        BridgeConfigSchema.parse(config);
      PatternToDatabaseBridge.instance.logger.info(
        "PatternToDatabaseBridge configuration updated",
        {
          config: PatternToDatabaseBridge.instance.config,
        }
      );
    }
    return PatternToDatabaseBridge.instance;
  }

  /**
   * Start listening to pattern detection events
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      this.logger.warn("Bridge is already listening to pattern events");
      return;
    }

    if (!this.config.enabled) {
      this.logger.info("Bridge is disabled - not starting event listener");
      return;
    }

    try {
      // Subscribe to pattern detection events
      this.patternDetectionCore.on(
        "patterns_detected",
        this.handlePatternEvent.bind(this)
      );

      // Subscribe to specific pattern type events
      this.patternDetectionCore.on(
        "ready_state",
        this.handlePatternEvent.bind(this)
      );
      this.patternDetectionCore.on(
        "pre_ready",
        this.handlePatternEvent.bind(this)
      );
      this.patternDetectionCore.on(
        "advance_opportunities",
        this.handlePatternEvent.bind(this)
      );

      this.isListening = true;

      this.logger.info(
        "✅ PatternToDatabaseBridge started listening for pattern events",
        {
          supportedTypes: this.config.supportedPatternTypes,
          minConfidence: this.config.minConfidenceThreshold,
        }
      );
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Failed to start pattern event listener",
        {
          error: safeError.message,
        },
        safeError
      );
      throw error;
    }
  }

  /**
   * Stop listening to pattern detection events
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    try {
      this.patternDetectionCore.removeAllListeners("patterns_detected");
      this.patternDetectionCore.removeAllListeners("ready_state");
      this.patternDetectionCore.removeAllListeners("pre_ready");
      this.patternDetectionCore.removeAllListeners("advance_opportunities");

      this.isListening = false;
      this.processedPatterns.clear();

      this.logger.info(
        "🔻 PatternToDatabaseBridge stopped listening for events"
      );
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Error stopping pattern event listener",
        {
          error: safeError.message,
        },
        safeError
      );
    }
  }

  /**
   * Handle incoming pattern detection events
   */
  private async handlePatternEvent(
    eventData: PatternDetectionEventData
  ): Promise<void> {
    try {
      // Extra logging for debugging
      console.log("🔍 PatternToDatabaseBridge: handlePatternEvent called", {
        patternType: eventData.patternType,
        matchesCount: eventData.matches.length,
        isListening: this.isListening,
        enabled: this.config.enabled,
      });

      this.logger.info("📥 Received pattern detection event", {
        patternType: eventData.patternType,
        matchesCount: eventData.matches.length,
        averageConfidence: eventData.metadata.averageConfidence,
        source: eventData.metadata.source,
      });

      // Filter matches by supported pattern types and confidence
      const filteredMatches = this.filterPatternMatches(eventData.matches);

      console.log("🔍 PatternToDatabaseBridge: After filtering", {
        originalCount: eventData.matches.length,
        filteredCount: filteredMatches.length,
        minConfidence: this.config.minConfidenceThreshold,
        supportedTypes: this.config.supportedPatternTypes,
        firstMatch: eventData.matches[0]
          ? {
              confidence: eventData.matches[0].confidence,
              patternType: eventData.matches[0].patternType,
            }
          : null,
      });

      if (filteredMatches.length === 0) {
        this.logger.info("No matches passed filtering criteria", {
          originalCount: eventData.matches.length,
          filteredCount: 0,
          minConfidence: this.config.minConfidenceThreshold,
        });
        return;
      }

      // Convert pattern matches to database records
      const snipeTargetRecords =
        await this.convertPatternsToRecords(filteredMatches);

      console.log("🔍 PatternToDatabaseBridge: After conversion", {
        filteredMatchesCount: filteredMatches.length,
        snipeTargetRecordsCount: snipeTargetRecords.length,
        firstRecord: snipeTargetRecords[0]
          ? {
              userId: snipeTargetRecords[0].userId,
              symbolName: snipeTargetRecords[0].symbolName,
              vcoinId: snipeTargetRecords[0].vcoinId,
            }
          : null,
      });

      // Batch insert into database
      let insertedCount = 0;
      if (snipeTargetRecords.length > 0) {
        try {
          insertedCount = await this.insertSnipeTargets(snipeTargetRecords);

          console.log("🔍 PatternToDatabaseBridge: After insertion", {
            insertedCount,
            recordsToInsert: snipeTargetRecords.length,
          });
        } catch (insertError) {
          console.error("🔍 PatternToDatabaseBridge: Insertion failed", {
            error: insertError,
            recordsToInsert: snipeTargetRecords.length,
            firstRecord: snipeTargetRecords[0],
          });
          throw insertError;
        }

        this.logger.info("✅ Successfully processed pattern event", {
          patternType: eventData.patternType,
          originalMatches: eventData.matches.length,
          filteredMatches: filteredMatches.length,
          insertedTargets: insertedCount,
          source: eventData.metadata.source,
        });
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "❌ Failed to process pattern event",
        {
          patternType: eventData.patternType,
          matchesCount: eventData.matches.length,
          error: safeError.message,
        },
        safeError
      );
    }
  }

  /**
   * Filter pattern matches based on configuration criteria
   */
  private filterPatternMatches(matches: PatternMatch[]): PatternMatch[] {
    return matches.filter((match) => {
      // Check pattern type support
      if (!this.config.supportedPatternTypes.includes(match.patternType)) {
        return false;
      }

      // Check confidence threshold
      if (match.confidence < this.config.minConfidenceThreshold) {
        return false;
      }

      // Check for duplicates (deduplication)
      const timestamp =
        typeof match.detectedAt === "number"
          ? match.detectedAt
          : match.detectedAt.getTime();
      const patternKey = `${match.symbol}_${match.patternType}_${timestamp}`;
      if (this.processedPatterns.has(patternKey)) {
        return false;
      }
      this.processedPatterns.add(patternKey);

      // Risk filtering
      if (this.config.enableRiskFiltering && match.riskLevel === "high") {
        return false;
      }

      // Basic data validation
      if (!match.symbol || !match.vcoinId) {
        return false;
      }

      return true;
    });
  }

  /**
   * Convert PatternMatch objects to database records
   */
  private async convertPatternsToRecords(
    matches: PatternMatch[]
  ): Promise<SnipeTargetRecord[]> {
    const records: SnipeTargetRecord[] = [];

    for (const match of matches) {
      try {
        console.log(
          `🔍 PatternToDatabaseBridge: Converting pattern to record`,
          {
            symbol: match.symbol,
            patternType: match.patternType,
            confidence: match.confidence,
          }
        );

        // Determine user ID (could be from config mapping or default)
        const userId = this.getUserIdForPattern(match);
        console.log(`🔍 PatternToDatabaseBridge: Got userId: ${userId}`);

        // Get user preferences for position sizing and risk management
        const userPrefs = await this.getUserPreferences(userId);
        console.log(
          `🔍 PatternToDatabaseBridge: Got user preferences:`,
          userPrefs
        );

        // Calculate priority based on confidence and pattern type
        const priority = this.calculatePriority(match);
        console.log(
          `🔍 PatternToDatabaseBridge: Calculated priority: ${priority}`
        );

        // Determine execution time based on pattern type
        const targetExecutionTime = this.calculateExecutionTime(match);
        console.log(
          `🔍 PatternToDatabaseBridge: Target execution time:`,
          targetExecutionTime
        );

        const record: SnipeTargetRecord = {
          userId,
          vcoinId: match.vcoinId ?? match.symbol, // Proper fallback with nullish coalescing
          symbolName: match.symbol,
          entryStrategy: "market", // Default to market orders for auto-detected patterns
          positionSizeUsdt:
            userPrefs?.defaultBuyAmountUsdt ||
            this.config.defaultPositionSizeUsdt,
          takeProfitLevel:
            userPrefs?.defaultTakeProfitLevel ||
            this.config.defaultTakeProfitLevel,
          takeProfitCustom: userPrefs?.takeProfitCustom ?? undefined, // Convert null to undefined
          stopLossPercent:
            userPrefs?.stopLossPercent || this.config.defaultStopLossPercent,
          status: match.patternType === "ready_state" ? "ready" : "pending",
          priority,
          targetExecutionTime,
          confidenceScore: Math.round(match.confidence),
          riskLevel: match.riskLevel,
        };

        console.log(
          `🔍 PatternToDatabaseBridge: Created record before validation:`,
          record
        );

        // Validate the record
        const validatedRecord = SnipeTargetRecordSchema.parse(record);
        console.log(
          `🔍 PatternToDatabaseBridge: Record validation successful:`,
          validatedRecord
        );

        records.push(validatedRecord);
        console.log(
          `✅ PatternToDatabaseBridge: Successfully converted pattern to record for ${match.symbol}`
        );
      } catch (error) {
        const safeError = toSafeError(error);
        console.error(
          `❌ PatternToDatabaseBridge: Failed to convert pattern match to record`,
          {
            symbol: match.symbol,
            patternType: match.patternType,
            error: safeError.message,
            fullError: safeError,
          }
        );
        this.logger.warn("Failed to convert pattern match to record", {
          symbol: match.symbol,
          patternType: match.patternType,
          error: safeError.message,
        });
      }
    }

    console.log(
      `🔍 PatternToDatabaseBridge: Final conversion result: ${records.length} records from ${matches.length} matches`
    );
    return records;
  }

  /**
   * Get user ID for a pattern (configurable mapping)
   */
  private getUserIdForPattern(match: PatternMatch): string {
    // Check if there's a specific user mapping for this pattern source
    const sourceKey = match.activityInfo?.activityTypes?.[0] || "default";
    const mappedUserId = this.config.userIdMapping[sourceKey];

    console.log("🔍 PatternToDatabaseBridge: getUserIdForPattern", {
      sourceKey,
      mappedUserId,
      userIdMapping: this.config.userIdMapping,
      activityTypes: match.activityInfo?.activityTypes,
      symbol: match.symbol,
    });

    if (mappedUserId) {
      return mappedUserId;
    }

    // Default fallback - could be configured per environment
    return process.env.DEFAULT_USER_ID || "system";
  }

  /**
   * Get user preferences for position sizing and risk management
   */
  private async getUserPreferences(userId: string) {
    try {
      const [userPref] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      return userPref;
    } catch (error) {
      this.logger.warn("Failed to fetch user preferences, using defaults", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Calculate priority based on pattern characteristics
   */
  private calculatePriority(match: PatternMatch): number {
    if (!this.config.autoAssignPriority) {
      return 5; // Default priority
    }

    let priority = 5; // Base priority

    // Confidence-based adjustment
    if (match.confidence >= 90)
      priority = 1; // Highest priority
    else if (match.confidence >= 80) priority = 2;
    else if (match.confidence >= 75) priority = 3;
    else if (match.confidence >= 70) priority = 4;

    // Pattern type adjustment
    if (match.patternType === "ready_state")
      priority = Math.max(1, priority - 1);
    if (match.patternType === "launch_sequence")
      priority = Math.max(1, priority - 1);

    // Risk level adjustment
    if (match.riskLevel === "low") priority = Math.max(1, priority - 1);
    if (match.riskLevel === "high") priority = Math.min(10, priority + 1);

    return Math.max(1, Math.min(10, priority));
  }

  /**
   * Calculate target execution time based on pattern data
   */
  private calculateExecutionTime(match: PatternMatch): Date | undefined {
    // For ready state patterns, execute immediately
    if (match.patternType === "ready_state") {
      return new Date();
    }

    // For advance opportunities, use the advance notice
    if (match.patternType === "launch_sequence" && match.advanceNoticeHours) {
      const executionTime = new Date();
      executionTime.setHours(
        executionTime.getHours() + match.advanceNoticeHours
      );
      return executionTime;
    }

    // For pre-ready patterns, estimate based on typical progression
    if (match.patternType === "pre_ready") {
      const executionTime = new Date();
      executionTime.setMinutes(executionTime.getMinutes() + 30); // 30 minutes default
      return executionTime;
    }

    return undefined; // No specific execution time
  }

  /**
   * Insert snipe target records into database with deduplication (OPTIMIZED - Fixed N+1 Query)
   */
  private async insertSnipeTargets(
    records: SnipeTargetRecord[]
  ): Promise<number> {
    if (records.length === 0) return 0;

    try {
      // PERFORMANCE FIX: Batch check for existing targets to avoid N+1 queries
      const deduplicatedRecords: SnipeTargetRecord[] = [];

      if (records.length === 1) {
        // Single record - use simple query
        const record = records[0];
        const existing = await db
          .select()
          .from(snipeTargets)
          .where(
            and(
              eq(snipeTargets.userId, record.userId),
              eq(snipeTargets.symbolName, record.symbolName),
              eq(snipeTargets.status, "pending")
            )
          )
          .limit(1);

        if (existing.length === 0) {
          deduplicatedRecords.push(record);
        }
      } else {
        // Multiple records - use batch query with IN clauses
        const userIds = [...new Set(records.map((r) => r.userId))];
        const symbols = [...new Set(records.map((r) => r.symbolName))];

        // Single query to get all existing targets for all users and symbols
        const existingTargets = await db
          .select()
          .from(snipeTargets)
          .where(
            and(
              inArray(snipeTargets.userId, userIds),
              inArray(snipeTargets.symbolName, symbols),
              eq(snipeTargets.status, "pending")
            )
          );

        // Create lookup set for O(1) duplicate checking
        const existingCombinations = new Set(
          existingTargets.map(
            (target: any) => `${target.userId}:${target.symbolName}`
          )
        );

        // Filter out duplicates in O(n) time
        for (const record of records) {
          const combination = `${record.userId}:${record.symbolName}`;
          if (!existingCombinations.has(combination)) {
            deduplicatedRecords.push(record);
          }
        }
      }

      if (deduplicatedRecords.length === 0) {
        this.logger.info("All records were duplicates, skipping insert", {
          operation: "batch_deduplication",
          originalCount: records.length,
          deduplicatedCount: 0,
          performance: "optimized_batch_query",
        });
        return 0;
      }

      // Check user target limits
      const limitedRecords = await this.enforceUserLimits(deduplicatedRecords);

      // Batch insert
      if (
        this.config.batchProcessing &&
        limitedRecords.length > this.config.batchSize
      ) {
        let insertedCount = 0;
        for (let i = 0; i < limitedRecords.length; i += this.config.batchSize) {
          const batch = limitedRecords.slice(i, i + this.config.batchSize);
          await db.insert(snipeTargets).values(batch);
          insertedCount += batch.length;
        }
        return insertedCount;
      } else {
        await db.insert(snipeTargets).values(limitedRecords);
        return limitedRecords.length;
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Failed to insert snipe targets",
        {
          recordCount: records.length,
          error: safeError.message,
        },
        safeError
      );
      throw error;
    }
  }

  /**
   * Enforce per-user target limits (OPTIMIZED - Fixed N+1 Query)
   */
  private async enforceUserLimits(
    records: SnipeTargetRecord[]
  ): Promise<SnipeTargetRecord[]> {
    const userCounts = new Map<string, number>();
    const uniqueUserIds = [...new Set(records.map((r) => r.userId))];

    // PERFORMANCE FIX: Batch count existing targets per user to avoid N+1 queries
    if (uniqueUserIds.length === 1) {
      // Single user - use simple query
      const userId = uniqueUserIds[0];
      const existingTargets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.userId, userId),
            eq(snipeTargets.status, "pending")
          )
        );

      userCounts.set(userId, existingTargets.length);
    } else {
      // Multiple users - use batch query with IN clause
      const existingTargets = await db
        .select({
          userId: snipeTargets.userId,
          id: snipeTargets.id, // We'll count these in memory
        })
        .from(snipeTargets)
        .where(
          and(
            inArray(snipeTargets.userId, uniqueUserIds),
            eq(snipeTargets.status, "pending")
          )
        );

      // Count targets per user in memory (O(n) complexity)
      for (const userId of uniqueUserIds) {
        const userTargetCount = existingTargets.filter(
          (target: any) => target.userId === userId
        ).length;
        userCounts.set(userId, userTargetCount);
      }
    }

    // Filter records that would exceed limits
    return records.filter((record) => {
      const currentCount = userCounts.get(record.userId) || 0;
      const willExceedLimit = currentCount >= this.config.maxTargetsPerUser;

      if (willExceedLimit) {
        this.logger.warn("User target limit exceeded, skipping record", {
          userId: record.userId,
          currentCount,
          maxTargets: this.config.maxTargetsPerUser,
          symbol: record.symbolName,
        });
        return false;
      }

      // Update count for subsequent records
      userCounts.set(record.userId, currentCount + 1);
      return true;
    });
  }

  /**
   * Update bridge configuration
   */
  updateConfig(newConfig: Partial<BridgeConfig>): void {
    try {
      this.config = BridgeConfigSchema.parse({ ...this.config, ...newConfig });
      this.logger.info("Bridge configuration updated", { newConfig });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Invalid bridge configuration",
        {
          error: safeError.message,
          config: newConfig,
        },
        safeError
      );
      throw error;
    }
  }

  /**
   * Get current bridge status and statistics
   */
  getStatus() {
    return {
      isListening: this.isListening,
      config: this.config,
      processedPatternsCount: this.processedPatterns.size,
      cacheSize: this.processedPatterns.size,
    };
  }

  /**
   * Clear processed patterns cache
   */
  clearCache(): void {
    this.processedPatterns.clear();
    this.logger.info("Processed patterns cache cleared");
  }
}

// Export singleton instance
export const patternToDatabaseBridge = PatternToDatabaseBridge.getInstance();
