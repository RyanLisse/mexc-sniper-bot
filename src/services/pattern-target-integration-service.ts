/**
 * Pattern-Target Integration Service
 *
 * Bridges the gap between pattern detection and snipe target creation.
 * This service listens for pattern detection results and automatically creates
 * snipe targets in the database for auto-sniping execution.
 */

import { and, eq } from "drizzle-orm";
import type { PatternMatch } from "../core/pattern-detection/interfaces";
import { db } from "../db";
import { snipeTargets } from "../db/schemas/trading";
import { createLogger } from "../lib/structured-logger";

export interface PatternTargetConfig {
  // User configuration
  defaultUserId: string;

  // Entry strategy
  preferredEntryStrategy: "market" | "limit";
  defaultPositionSizeUsdt: number;

  // Risk management
  defaultStopLossPercent: number;
  takeProfitLevel: number; // Which level from user preferences

  // Execution settings
  defaultPriority: number;
  maxRetries: number;

  // Pattern filtering
  minConfidenceForTarget: number;
  enabledPatternTypes: string[];
  maxConcurrentTargets: number;
}

export interface TargetCreationResult {
  success: boolean;
  targetId?: number;
  target?: any;
  error?: string;
  reason?: string;
}

export class PatternTargetIntegrationService {
  private static instance: PatternTargetIntegrationService;
  private logger = createLogger("pattern-target-integration");

  // Default configuration
  private config: PatternTargetConfig = {
    defaultUserId: "system", // Will be overridden
    preferredEntryStrategy: "market",
    defaultPositionSizeUsdt: 100, // $100 default position
    defaultStopLossPercent: 5.0, // 5% stop loss
    takeProfitLevel: 2, // Level 2 from user preferences
    defaultPriority: 1, // High priority
    maxRetries: 3,
    minConfidenceForTarget: 75, // Only create targets for 75%+ confidence
    enabledPatternTypes: ["ready_state", "pre_ready"], // Only actionable patterns
    maxConcurrentTargets: 5, // Safety limit
  };

  private constructor(config?: Partial<PatternTargetConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.logger.info("Pattern-Target Integration Service initialized", {
      config: this.config,
    });
  }

  static getInstance(config?: Partial<PatternTargetConfig>): PatternTargetIntegrationService {
    if (!PatternTargetIntegrationService.instance) {
      PatternTargetIntegrationService.instance = new PatternTargetIntegrationService(config);
    }
    return PatternTargetIntegrationService.instance;
  }

  /**
   * Main Integration Method: Convert Pattern Matches to Snipe Targets
   */
  async createTargetsFromPatterns(
    patterns: PatternMatch[],
    userId: string,
    overrideConfig?: Partial<PatternTargetConfig>
  ): Promise<TargetCreationResult[]> {
    const config = overrideConfig ? { ...this.config, ...overrideConfig } : this.config;
    const results: TargetCreationResult[] = [];

    // Check current concurrent targets
    const currentTargets = await this.getCurrentActiveTargets(userId);
    if (currentTargets.length >= config.maxConcurrentTargets) {
      this.logger.warn("Max concurrent targets reached", {
        userId,
        currentTargets: currentTargets.length,
        maxAllowed: config.maxConcurrentTargets,
      });

      return patterns.map(() => ({
        success: false,
        reason: "Max concurrent targets reached",
      }));
    }

    // Process each pattern
    for (const pattern of patterns) {
      try {
        const result = await this.createTargetFromPattern(pattern, userId, config);
        results.push(result);

        if (result.success) {
          this.logger.info("Snipe target created from pattern", {
            targetId: result.targetId,
            symbol: pattern.symbol,
            vcoinId: pattern.vcoinId,
            patternType: pattern.patternType,
            confidence: pattern.confidence,
          });
        }
      } catch (error) {
        this.logger.error(
          "Failed to create target from pattern",
          {
            symbol: pattern.symbol,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          error
        );

        results.push({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Create a single snipe target from a pattern match
   */
  private async createTargetFromPattern(
    pattern: PatternMatch,
    userId: string,
    config: PatternTargetConfig
  ): Promise<TargetCreationResult> {
    // Filter patterns based on configuration
    if (!this.shouldCreateTarget(pattern, config)) {
      return {
        success: false,
        reason: `Pattern filtered out: ${pattern.patternType} with ${pattern.confidence}% confidence`,
      };
    }

    // Check if target already exists
    const existingTarget = await this.checkExistingTarget(
      pattern.vcoinId || pattern.symbol,
      userId
    );
    if (existingTarget) {
      return {
        success: false,
        reason: "Target already exists for this symbol",
      };
    }

    // Calculate target execution time
    const targetExecutionTime = this.calculateExecutionTime(pattern);

    // Determine position size based on confidence
    const positionSize = this.calculatePositionSize(pattern, config);

    // Create the snipe target
    const targetData = {
      userId,
      vcoinId: pattern.vcoinId || pattern.symbol,
      symbolName: pattern.symbol,
      entryStrategy: config.preferredEntryStrategy,
      entryPrice: null, // Market order for now
      positionSizeUsdt: positionSize,
      takeProfitLevel: config.takeProfitLevel,
      takeProfitCustom: this.calculateTakeProfit(pattern),
      stopLossPercent: config.defaultStopLossPercent,
      status: this.determineInitialStatus(pattern),
      priority: this.calculatePriority(pattern),
      maxRetries: config.maxRetries,
      currentRetries: 0,
      targetExecutionTime,
      confidenceScore: pattern.confidence,
      riskLevel: pattern.riskLevel || "medium",
    };

    // Insert into database
    const result = await db.insert(snipeTargets).values(targetData).returning();

    return {
      success: true,
      targetId: result[0].id,
      target: result[0],
    };
  }

  /**
   * Filter logic: Should we create a target for this pattern?
   */
  private shouldCreateTarget(pattern: PatternMatch, config: PatternTargetConfig): boolean {
    // Check pattern type
    if (!config.enabledPatternTypes.includes(pattern.patternType)) {
      return false;
    }

    // Check confidence threshold
    if (pattern.confidence < config.minConfidenceForTarget) {
      return false;
    }

    // Check if symbol has minimum required data
    if (!pattern.symbol || !pattern.vcoinId) {
      return false;
    }

    // Check risk level (optional filter)
    if (pattern.riskLevel === "high" && pattern.confidence < 85) {
      return false; // High risk patterns need higher confidence
    }

    return true;
  }

  /**
   * Check if a target already exists for this symbol/user
   */
  private async checkExistingTarget(symbolOrVcoin: string, userId: string) {
    const existing = await db
      .select()
      .from(snipeTargets)
      .where(
        and(
          eq(snipeTargets.userId, userId),
          eq(snipeTargets.vcoinId, symbolOrVcoin),
          eq(snipeTargets.status, "pending") // Only check pending targets
        )
      )
      .limit(1);

    return existing.length > 0 ? existing[0] : null;
  }

  /**
   * Get current active targets for concurrency control
   */
  private async getCurrentActiveTargets(userId: string) {
    return await db
      .select()
      .from(snipeTargets)
      .where(
        and(
          eq(snipeTargets.userId, userId),
          // Active statuses
          snipeTargets.status.in(["pending", "ready", "executing"])
        )
      );
  }

  /**
   * Calculate execution time based on pattern type
   */
  private calculateExecutionTime(pattern: PatternMatch): Date | null {
    const now = new Date();

    switch (pattern.patternType) {
      case "ready_state":
        // Execute immediately for ready state
        return new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes buffer

      case "pre_ready": {
        // Execute when pattern is expected to be ready
        const estimatedMinutes = pattern.advanceNoticeHours ? pattern.advanceNoticeHours * 60 : 120;
        return new Date(now.getTime() + estimatedMinutes * 60 * 1000);
      }

      case "launch_sequence":
        // Execute at launch time
        if (pattern.advanceNoticeHours) {
          return new Date(now.getTime() + pattern.advanceNoticeHours * 60 * 60 * 1000);
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Calculate position size based on confidence and risk
   */
  private calculatePositionSize(pattern: PatternMatch, config: PatternTargetConfig): number {
    const baseSize = config.defaultPositionSizeUsdt;
    const confidenceMultiplier = pattern.confidence / 100;

    // Adjust size based on confidence
    let adjustedSize = baseSize * confidenceMultiplier;

    // Risk level adjustments
    if (pattern.riskLevel === "low") {
      adjustedSize *= 1.2; // 20% increase for low risk
    } else if (pattern.riskLevel === "high") {
      adjustedSize *= 0.7; // 30% decrease for high risk
    }

    // Ensure minimum and maximum bounds
    return Math.max(Math.min(adjustedSize, baseSize * 1.5), baseSize * 0.5);
  }

  /**
   * Calculate take profit percentage based on pattern
   */
  private calculateTakeProfit(pattern: PatternMatch): number {
    // Base take profit percentages
    const baseTakeProfit = pattern.patternType === "ready_state" ? 15 : 10;

    // Adjust based on confidence
    const confidenceBonus = ((pattern.confidence - 50) / 50) * 5; // 0-5% bonus

    return Math.min(baseTakeProfit + confidenceBonus, 25); // Max 25%
  }

  /**
   * Determine initial status based on pattern type
   */
  private determineInitialStatus(pattern: PatternMatch): string {
    switch (pattern.patternType) {
      case "ready_state":
        return "ready"; // Immediately ready for execution
      case "pre_ready":
        return "pending"; // Wait for ready state
      case "launch_sequence":
        return "pending"; // Wait for launch
      default:
        return "pending";
    }
  }

  /**
   * Calculate priority based on pattern characteristics
   */
  private calculatePriority(pattern: PatternMatch): number {
    // Priority 1 (highest) to 5 (lowest)

    if (pattern.patternType === "ready_state" && pattern.confidence >= 85) {
      return 1; // Highest priority
    }

    if (pattern.confidence >= 80) {
      return 2; // High priority
    }

    if (pattern.confidence >= 70) {
      return 3; // Medium priority
    }

    return 4; // Lower priority
  }

  /**
   * Update configuration at runtime
   */
  updateConfiguration(newConfig: Partial<PatternTargetConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info("Configuration updated", { newConfig });
  }

  /**
   * Get current configuration
   */
  getConfiguration(): PatternTargetConfig {
    return { ...this.config };
  }

  /**
   * Get service statistics
   */
  async getStatistics(userId?: string): Promise<{
    totalTargetsCreated: number;
    activeTargets: number;
    readyTargets: number;
    pendingTargets: number;
    executingTargets: number;
  }> {
    let baseQuery = db.select().from(snipeTargets);

    if (userId) {
      baseQuery = baseQuery.where(eq(snipeTargets.userId, userId));
    }

    const allTargets = await baseQuery;

    return {
      totalTargetsCreated: allTargets.length,
      activeTargets: allTargets.filter((t) => ["pending", "ready", "executing"].includes(t.status))
        .length,
      readyTargets: allTargets.filter((t) => t.status === "ready").length,
      pendingTargets: allTargets.filter((t) => t.status === "pending").length,
      executingTargets: allTargets.filter((t) => t.status === "executing").length,
    };
  }
}

// Export singleton instance
export const patternTargetIntegrationService = PatternTargetIntegrationService.getInstance();
