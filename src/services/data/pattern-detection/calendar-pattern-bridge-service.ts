/**
 * Calendar-Pattern Bridge Service
 *
 * AUTOMATED DISCOVERY BRIDGE - Automatically connects calendar monitoring to pattern detection
 * This service monitors calendar data for new listings and automatically triggers pattern
 * detection analysis to identify trading opportunities with our core sts:2, st:2, tt:4 patterns.
 *
 * Pipeline: Calendar Monitoring → Pattern Detection → Target Creation → Auto-Execution
 */

import type { PatternAnalysisRequest } from "@/src/core/pattern-detection";
import { EnhancedPatternDetectionCore } from "@/src/core/pattern-detection/pattern-detection-core-enhanced";
import type { AgentResponse } from "@/src/mexc-agents/base-agent";
import { CalendarAgent } from "@/src/mexc-agents/calendar-agent";
import { CalendarWorkflow } from "@/src/mexc-agents/calendar-workflow";
import type { CalendarEntry } from "@/src/services/api/mexc-unified-exports";

export interface CalendarEventData {
  eventType:
    | "new_listings"
    | "upcoming_launches"
    | "ready_candidates"
    | "schedule_changes";
  calendarEntries: CalendarEntry[];
  metadata: {
    entriesCount: number;
    source: string;
    duration: number;
    highPriorityCount: number;
    readyCandidateCount: number;
  };
}

export interface CalendarMonitoringStats {
  totalEventsProcessed: number;
  totalCalendarScans: number;
  totalNewListingsFound: number;
  totalPatternAnalysisTriggered: number;
  totalPatternAnalysisFailed: number;
  readyCandidatesDetected: number;
  lastCalendarScan: Date | null;
  lastPatternAnalysis: Date | null;
  averageProcessingTime: number;
}

export class CalendarPatternBridgeService {
  private static instance: CalendarPatternBridgeService;
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[calendar-pattern-bridge]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[calendar-pattern-bridge]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[calendar-pattern-bridge]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[calendar-pattern-bridge]", message, context || ""),
  };
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private calendarAgent: CalendarAgent;
  private calendarWorkflow: CalendarWorkflow;

  // Statistics tracking
  private stats: CalendarMonitoringStats = {
    totalEventsProcessed: 0,
    totalCalendarScans: 0,
    totalNewListingsFound: 0,
    totalPatternAnalysisTriggered: 0,
    totalPatternAnalysisFailed: 0,
    readyCandidatesDetected: 0,
    lastCalendarScan: null,
    lastPatternAnalysis: null,
    averageProcessingTime: 0,
  };

  private processingTimes: number[] = [];
  private lastKnownCalendarState: CalendarEntry[] = [];

  private constructor() {
    this.calendarAgent = new CalendarAgent();
    this.calendarWorkflow = new CalendarWorkflow();
    console.info("Calendar-Pattern Bridge Service initialized");
  }

  static getInstance(): CalendarPatternBridgeService {
    if (!CalendarPatternBridgeService.instance) {
      CalendarPatternBridgeService.instance =
        new CalendarPatternBridgeService();
    }
    return CalendarPatternBridgeService.instance;
  }

  /**
   * Start automated calendar monitoring and pattern detection triggering
   */
  startMonitoring(intervalMinutes = 15): void {
    if (this.isMonitoring) {
      console.warn("Calendar-Pattern Bridge already monitoring");
      return;
    }

    // Immediate scan on startup
    this.performCalendarScan().catch((error) => {
      console.error("Initial calendar scan failed", {}, error);
    });

    // Set up periodic monitoring
    const intervalMs = intervalMinutes * 60 * 1000;
    this.monitoringInterval = setInterval(() => {
      this.performCalendarScan().catch((error) => {
        console.error("Scheduled calendar scan failed", {}, error);
      });
    }, intervalMs);

    this.isMonitoring = true;
    console.info("Calendar-Pattern Bridge monitoring started", {
      intervalMinutes,
      nextScan: new Date(Date.now() + intervalMs).toISOString(),
    });
  }

  /**
   * Stop calendar monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.warn("Calendar-Pattern Bridge not currently monitoring");
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    console.info("Calendar-Pattern Bridge monitoring stopped");
  }

  /**
   * Perform calendar scan and trigger pattern detection for new opportunities
   */
  private async performCalendarScan(): Promise<void> {
    const startTime = Date.now();

    try {
      console.info("Starting calendar monitoring scan");

      // Fetch latest calendar data using CalendarAgent
      const calendarData = await this.calendarAgent.fetchLatestCalendarData();
      this.stats.totalCalendarScans++;
      this.stats.lastCalendarScan = new Date();

      if (calendarData.length === 0) {
        console.warn("No calendar data available for monitoring");
        return;
      }

      // Detect changes and new listings
      const changedEntries = this.detectCalendarChanges(calendarData);

      if (changedEntries.length === 0) {
        console.info("No calendar changes detected", {
          totalEntries: calendarData.length,
          duration: Date.now() - startTime,
        });
        return;
      }

      // Process new listings with AI analysis
      const analysisResponse =
        await this.calendarAgent.scanForNewListings(changedEntries);

      // Analyze opportunities using CalendarWorkflow
      const patternAnalysisResponse: AgentResponse = {
        content: "Pattern analysis request",
        metadata: {
          agent: "calendar-pattern-bridge",
          timestamp: new Date().toISOString(),
        },
      };

      const workflowResult =
        await this.calendarWorkflow.analyzeDiscoveryResults(
          analysisResponse,
          patternAnalysisResponse,
          { success: true, data: changedEntries }
        );

      // Filter for high-priority candidates that need pattern analysis
      const patternCandidates = this.filterPatternCandidates(
        (workflowResult.readyTargets || []) as CalendarEntry[],
        changedEntries || []
      );

      if (patternCandidates.length > 0) {
        // Trigger pattern detection for promising candidates
        await this.triggerPatternDetection(patternCandidates);

        console.info("Calendar-Pattern bridge processing completed", {
          newListings: changedEntries.length,
          readyTargets: workflowResult.readyTargets.length,
          patternCandidates: patternCandidates.length,
          confidence: workflowResult.confidence,
          processingTime: Date.now() - startTime,
        });
      }

      // Update statistics
      this.updateStatistics(
        changedEntries,
        patternCandidates,
        Date.now() - startTime
      );

      // Update known state for future change detection
      this.lastKnownCalendarState = calendarData;
    } catch (error) {
      console.error(
        "Calendar monitoring scan failed",
        {
          duration: Date.now() - startTime,
          lastKnownEntries: this.lastKnownCalendarState.length,
        },
        error
      );
    }
  }

  /**
   * Detect changes in calendar data compared to last known state
   */
  private detectCalendarChanges(currentData: CalendarEntry[]): CalendarEntry[] {
    if (this.lastKnownCalendarState.length === 0) {
      // First run - consider all as new
      return currentData.slice(0, 10); // Limit initial processing
    }

    const lastKnownIds = new Set(
      this.lastKnownCalendarState.map((entry) => entry.vcoinId)
    );
    const newEntries = currentData.filter(
      (entry) => !lastKnownIds.has(entry.vcoinId)
    );

    // Also detect timing changes for existing entries
    const timingChanges = currentData.filter((entry) => {
      const lastKnown = this.lastKnownCalendarState.find(
        (e) => e.vcoinId === entry.vcoinId
      );
      if (!lastKnown) return false;

      // Check if launch time changed significantly (more than 30 minutes)
      const currentTime = new Date(entry.firstOpenTime).getTime();
      const lastTime = new Date(lastKnown.firstOpenTime).getTime();
      const timeDiff = Math.abs(currentTime - lastTime);

      return timeDiff > 30 * 60 * 1000; // 30 minutes in milliseconds
    });

    return [...newEntries, ...timingChanges];
  }

  /**
   * Filter calendar entries that are good candidates for pattern detection
   */
  private filterPatternCandidates(
    readyTargets: CalendarEntry[],
    allChanges: CalendarEntry[]
  ): CalendarEntry[] {
    const candidates = [...readyTargets];

    // Add high-potential entries from all changes
    const highPotentialEntries = allChanges.filter((entry) => {
      // Calculate advance notice
      const launchTime = new Date(entry.firstOpenTime).getTime();
      const advanceHours = (launchTime - Date.now()) / (1000 * 60 * 60);

      // Include entries with optimal advance notice (2-48 hours)
      return advanceHours >= 2 && advanceHours <= 48;
    });

    // Combine and deduplicate
    const candidateMap = new Map<string, CalendarEntry>();

    [...candidates, ...highPotentialEntries].forEach((entry) => {
      candidateMap.set(entry.vcoinId, entry);
    });

    return Array.from(candidateMap.values());
  }

  /**
   * Trigger pattern detection for calendar candidates
   */
  private async triggerPatternDetection(
    candidates: CalendarEntry[]
  ): Promise<void> {
    try {
      console.info("Triggering pattern detection for calendar candidates", {
        candidatesCount: candidates.length,
        symbols: candidates.map((c) => c.symbol),
      });

      const analysisRequest: PatternAnalysisRequest = {
        calendarEntries: candidates,
        analysisType: "discovery",
        timeframe: "24h",
        confidenceThreshold: 70,
        includeHistorical: true,
      };

      // Trigger pattern detection using calendar data
      const patternResults =
        await EnhancedPatternDetectionCore.getInstance().analyzePatterns(
          analysisRequest
        );

      this.stats.totalPatternAnalysisTriggered++;
      this.stats.lastPatternAnalysis = new Date();

      if (
        patternResults.summary.readyStateFound > 0 ||
        patternResults.summary.highConfidenceMatches > 0
      ) {
        console.info(
          "Pattern detection found opportunities from calendar data",
          {
            readyStateFound: patternResults.summary.readyStateFound,
            highConfidenceMatches: patternResults.summary.highConfidenceMatches,
            totalAnalyzed: patternResults.summary.totalAnalyzed,
            averageConfidence: patternResults.summary.averageConfidence,
            nextStep:
              "Pattern-Target Bridge will automatically create snipe targets",
          }
        );

        this.stats.readyCandidatesDetected +=
          patternResults.summary.readyStateFound;
      }
    } catch (error) {
      this.stats.totalPatternAnalysisFailed++;
      console.error(
        "Pattern detection trigger failed",
        {
          candidatesCount: candidates.length,
          candidateSymbols: candidates.map((c) => c.symbol),
        },
        error
      );
    }
  }

  /**
   * Update service statistics
   */
  private updateStatistics(
    changedEntries: CalendarEntry[],
    _patternCandidates: CalendarEntry[],
    processingTime: number
  ): void {
    this.stats.totalEventsProcessed++;
    this.stats.totalNewListingsFound += changedEntries.length;

    // Update processing time average
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-50);
    }
    this.stats.averageProcessingTime =
      this.processingTimes.reduce((sum, time) => sum + time, 0) /
      this.processingTimes.length;
  }

  /**
   * Manual trigger for calendar-pattern analysis (for testing/admin)
   */
  async triggerManualScan(): Promise<{
    success: boolean;
    newListings: number;
    patternCandidates: number;
    processingTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.performCalendarScan();

      return {
        success: true,
        newListings: 0, // Would need to track this in performCalendarScan
        patternCandidates: 0, // Would need to track this in performCalendarScan
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        newListings: 0,
        patternCandidates: 0,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get service statistics
   */
  getStatistics(): CalendarMonitoringStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      totalEventsProcessed: 0,
      totalCalendarScans: 0,
      totalNewListingsFound: 0,
      totalPatternAnalysisTriggered: 0,
      totalPatternAnalysisFailed: 0,
      readyCandidatesDetected: 0,
      lastCalendarScan: null,
      lastPatternAnalysis: null,
      averageProcessingTime: 0,
    };
    this.processingTimes = [];
    console.info("Calendar-Pattern Bridge statistics reset");
  }

  /**
   * Check if the bridge is currently monitoring
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get comprehensive bridge status
   */
  getStatus(): {
    isActive: boolean;
    statistics: CalendarMonitoringStats;
    uptime: number;
    nextScanIn?: number;
  } {
    let nextScanIn: number | undefined;

    if (this.isMonitoring && this.stats.lastCalendarScan) {
      const timeSinceLastScan =
        Date.now() - this.stats.lastCalendarScan.getTime();
      const scanInterval = 15 * 60 * 1000; // 15 minutes
      nextScanIn = Math.max(0, scanInterval - timeSinceLastScan);
    }

    return {
      isActive: this.isMonitoring,
      statistics: this.getStatistics(),
      uptime: this.stats.lastCalendarScan
        ? Date.now() - this.stats.lastCalendarScan.getTime()
        : 0,
      nextScanIn,
    };
  }
}

// Export singleton instance
export const calendarPatternBridgeService =
  CalendarPatternBridgeService.getInstance();
