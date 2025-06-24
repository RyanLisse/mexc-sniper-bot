/**
 * Pattern-Target Bridge Service
 *
 * THE MISSING BRIDGE - Automatically connects pattern detection to target creation
 * This service listens for pattern detection events and automatically creates
 * snipe targets in the database for immediate execution by the auto-sniping system.
 */

import type { PatternMatch } from "../core/pattern-detection";
import { PatternDetectionCore } from "../core/pattern-detection";
import { createLogger } from "../lib/structured-logger";
import { patternTargetIntegrationService } from "./pattern-target-integration-service";

export interface PatternEventData {
  patternType: string;
  matches: PatternMatch[];
  metadata: {
    symbolsAnalyzed?: number;
    calendarEntriesAnalyzed?: number;
    duration: number;
    source: string;
    averageAdvanceHours?: number;
    averageEstimatedTimeToReady?: number;
  };
}

export interface BridgeStatistics {
  totalEventsProcessed: number;
  totalTargetsCreated: number;
  totalTargetsFailed: number;
  readyStateTargets: number;
  advanceOpportunityTargets: number;
  preReadyTargets: number;
  lastEventProcessed: Date | null;
  averageProcessingTime: number;
}

export class PatternTargetBridgeService {
  private static instance: PatternTargetBridgeService;
  private logger = createLogger("pattern-target-bridge");
  private isListening = false;

  // Statistics tracking
  private stats: BridgeStatistics = {
    totalEventsProcessed: 0,
    totalTargetsCreated: 0,
    totalTargetsFailed: 0,
    readyStateTargets: 0,
    advanceOpportunityTargets: 0,
    preReadyTargets: 0,
    lastEventProcessed: null,
    averageProcessingTime: 0,
  };

  private processingTimes: number[] = [];

  private constructor() {
    this.logger.info("Pattern-Target Bridge Service initialized");
  }

  static getInstance(): PatternTargetBridgeService {
    if (!PatternTargetBridgeService.instance) {
      PatternTargetBridgeService.instance = new PatternTargetBridgeService();
    }
    return PatternTargetBridgeService.instance;
  }

  /**
   * Start listening for pattern detection events and automatically create targets
   */
  startListening(defaultUserId = "system"): void {
    if (this.isListening) {
      this.logger.warn("Pattern-Target Bridge already listening");
      return;
    }

    // Listen for pattern detection events
    PatternDetectionCore.getInstance().on(
      "patterns_detected",
      async (eventData: PatternEventData) => {
        await this.handlePatternDetectedEvent(eventData, defaultUserId);
      }
    );

    this.isListening = true;
    this.logger.info("Pattern-Target Bridge started - listening for pattern detection events", {
      defaultUserId,
      listeningFor: ["ready_state", "advance_opportunities", "pre_ready"],
    });
  }

  /**
   * Stop listening for pattern detection events
   */
  stopListening(): void {
    if (!this.isListening) {
      this.logger.warn("Pattern-Target Bridge not currently listening");
      return;
    }

    PatternDetectionCore.getInstance().removeAllListeners("patterns_detected");
    this.isListening = false;
    this.logger.info("Pattern-Target Bridge stopped listening");
  }

  /**
   * Handle pattern detection events and create targets automatically
   */
  private async handlePatternDetectedEvent(
    eventData: PatternEventData,
    userId: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info("Processing pattern detection event", {
        patternType: eventData.patternType,
        matchesCount: eventData.matches.length,
        source: eventData.metadata.source,
        userId,
      });

      // Filter matches by confidence and pattern type for target creation
      const eligibleMatches = this.filterEligibleMatches(eventData.matches, eventData.patternType);

      if (eligibleMatches.length === 0) {
        this.logger.info("No eligible matches for target creation", {
          patternType: eventData.patternType,
          totalMatches: eventData.matches.length,
          filteredMatches: eligibleMatches.length,
        });
        this.updateStatistics(eventData, 0, 0, Date.now() - startTime);
        return;
      }

      // Create snipe targets for eligible matches
      const targetResults = await patternTargetIntegrationService.createTargetsFromPatterns(
        eligibleMatches,
        userId,
        this.getConfigForPatternType(eventData.patternType)
      );

      // Count successful and failed target creations
      const successfulTargets = targetResults.filter((r) => r.success).length;
      const failedTargets = targetResults.filter((r) => !r.success).length;

      this.logger.info("Pattern-to-target integration completed", {
        patternType: eventData.patternType,
        eligibleMatches: eligibleMatches.length,
        successfulTargets,
        failedTargets,
        processingTime: Date.now() - startTime,
        userId,
      });

      // Update statistics
      this.updateStatistics(eventData, successfulTargets, failedTargets, Date.now() - startTime);

      // Log target details for monitoring
      if (successfulTargets > 0) {
        const targetIds = targetResults
          .filter((r) => r.success && r.targetId)
          .map((r) => r.targetId);

        this.logger.info("Snipe targets created and ready for auto-execution", {
          patternType: eventData.patternType,
          targetIds,
          count: successfulTargets,
          nextStep: "Auto-sniping orchestrator will pick up these targets automatically",
        });
      }

      // Log any failures for debugging
      if (failedTargets > 0) {
        const failures = targetResults
          .filter((r) => !r.success)
          .map((r) => ({ error: r.error, reason: r.reason }));

        this.logger.warn("Some target creations failed", {
          patternType: eventData.patternType,
          failedCount: failedTargets,
          failures,
        });
      }
    } catch (error) {
      this.logger.error(
        "Failed to process pattern detection event",
        {
          patternType: eventData.patternType,
          matchesCount: eventData.matches.length,
          userId,
          processingTime: Date.now() - startTime,
        },
        error
      );

      // Update failure statistics
      this.updateStatistics(eventData, 0, eventData.matches.length, Date.now() - startTime);
    }
  }

  /**
   * Filter matches that are eligible for automatic target creation
   */
  private filterEligibleMatches(matches: PatternMatch[], patternType: string): PatternMatch[] {
    return matches.filter((match) => {
      // Pattern-specific confidence thresholds
      const minConfidence = this.getMinConfidenceForPatternType(patternType);

      // Basic eligibility criteria
      if (match.confidence < minConfidence) return false;
      if (!match.symbol || !match.vcoinId) return false;

      // Pattern-specific filters
      switch (patternType) {
        case "ready_state":
          // Ready state patterns should be immediately actionable
          return match.recommendation === "immediate_action";

        case "advance_opportunities":
          // Advance opportunities should have sufficient advance notice
          return match.advanceNoticeHours >= 1 && match.advanceNoticeHours <= 72;

        case "pre_ready":
          // Pre-ready patterns should be worth monitoring
          return match.recommendation === "monitor_closely" && match.advanceNoticeHours <= 12;

        default:
          return true;
      }
    });
  }

  /**
   * Get minimum confidence threshold for pattern type
   */
  private getMinConfidenceForPatternType(patternType: string): number {
    switch (patternType) {
      case "ready_state":
        return 85; // High confidence for immediate action
      case "advance_opportunities":
        return 70; // Medium confidence for advance planning
      case "pre_ready":
        return 60; // Lower confidence for monitoring
      default:
        return 75;
    }
  }

  /**
   * Get configuration overrides for specific pattern types
   */
  private getConfigForPatternType(patternType: string) {
    switch (patternType) {
      case "ready_state":
        return {
          preferredEntryStrategy: "market" as const,
          defaultPriority: 1,
          minConfidenceForTarget: 85,
          enabledPatternTypes: ["ready_state"],
        };

      case "advance_opportunities":
        return {
          preferredEntryStrategy: "limit" as const,
          defaultPriority: 2,
          minConfidenceForTarget: 70,
          enabledPatternTypes: ["launch_sequence"],
        };

      case "pre_ready":
        return {
          preferredEntryStrategy: "limit" as const,
          defaultPriority: 3,
          minConfidenceForTarget: 60,
          enabledPatternTypes: ["pre_ready"],
          defaultPositionSizeUsdt: 50, // Smaller position for pre-ready
        };

      default:
        return {};
    }
  }

  /**
   * Update service statistics
   */
  private updateStatistics(
    eventData: PatternEventData,
    successfulTargets: number,
    failedTargets: number,
    processingTime: number
  ): void {
    this.stats.totalEventsProcessed++;
    this.stats.totalTargetsCreated += successfulTargets;
    this.stats.totalTargetsFailed += failedTargets;
    this.stats.lastEventProcessed = new Date();

    // Update pattern-specific counters
    switch (eventData.patternType) {
      case "ready_state":
        this.stats.readyStateTargets += successfulTargets;
        break;
      case "advance_opportunities":
        this.stats.advanceOpportunityTargets += successfulTargets;
        break;
      case "pre_ready":
        this.stats.preReadyTargets += successfulTargets;
        break;
    }

    // Update average processing time
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-50); // Keep last 50 measurements
    }
    this.stats.averageProcessingTime =
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  /**
   * Get service statistics
   */
  getStatistics(): BridgeStatistics {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      totalEventsProcessed: 0,
      totalTargetsCreated: 0,
      totalTargetsFailed: 0,
      readyStateTargets: 0,
      advanceOpportunityTargets: 0,
      preReadyTargets: 0,
      lastEventProcessed: null,
      averageProcessingTime: 0,
    };
    this.processingTimes = [];
    this.logger.info("Pattern-Target Bridge statistics reset");
  }

  /**
   * Check if the bridge is currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Get bridge status
   */
  getStatus(): {
    isActive: boolean;
    statistics: BridgeStatistics;
    uptime: number;
  } {
    return {
      isActive: this.isListening,
      statistics: this.getStatistics(),
      uptime: this.stats.lastEventProcessed
        ? Date.now() - this.stats.lastEventProcessed.getTime()
        : 0,
    };
  }
}

// Export singleton instance
export const patternTargetBridgeService = PatternTargetBridgeService.getInstance();
