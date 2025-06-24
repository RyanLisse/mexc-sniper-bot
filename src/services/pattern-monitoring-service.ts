/**
 * Pattern Monitoring Service
 *
 * Real-time monitoring system for pattern detection events and statistics.
 * Provides comprehensive tracking of pattern matches, confidence trends, and system performance.
 */

import { PatternDetectionCore, type PatternMatch } from "../core/pattern-detection";
import type { CalendarEntry, SymbolEntry } from "./mexc-unified-exports";
import { UnifiedMexcServiceV2 } from "./unified-mexc-service-v2";

export interface PatternMonitoringStats {
  // Overall monitoring metrics
  totalPatternsDetected: number;
  readyStatePatterns: number;
  preReadyPatterns: number;
  advanceOpportunities: number;
  averageConfidence: number;

  // Time-based metrics
  patternsLast24h: number;
  patternsLastHour: number;
  lastPatternTime?: string;

  // Performance metrics
  detectionRate: number; // patterns per hour
  falsePositiveRate: number;
  avgProcessingTime: number;

  // System health
  engineStatus: "active" | "idle" | "error" | "disabled";
  lastHealthCheck: string;
  consecutiveErrors: number;
}

export interface RecentPatternActivity {
  timestamp: string;
  patterns: PatternMatch[];
  processingTime: number;
  symbolsAnalyzed: number;
  calendarEntriesAnalyzed: number;
}

export interface PatternAlert {
  id: string;
  type: "high_confidence_ready" | "advance_opportunity" | "pattern_correlation" | "system_issue";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  patterns: PatternMatch[];
  timestamp: string;
  acknowledged: boolean;
}

export interface PatternMonitoringReport {
  status: "healthy" | "degraded" | "error";
  stats: PatternMonitoringStats;
  recentActivity: RecentPatternActivity[];
  activeAlerts: PatternAlert[];
  recommendations: string[];
  lastUpdated: string;
}

export class PatternMonitoringService {
  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[pattern-monitoring-service]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[pattern-monitoring-service]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[pattern-monitoring-service]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[pattern-monitoring-service]", message, context || ""),
      };
    }
    return this._logger;
  }

  private static instance: PatternMonitoringService;
  private patternEngine: PatternDetectionCore;
  private mexcService: UnifiedMexcServiceV2;

  // Monitoring state
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private stats: PatternMonitoringStats;
  private recentActivity: RecentPatternActivity[] = [];
  private activeAlerts: PatternAlert[] = [];
  private patternHistory: PatternMatch[] = [];

  // Configuration
  private readonly maxRecentActivity = 50;
  private readonly maxPatternHistory = 1000;
  private readonly monitoringIntervalMs = 30000; // 30 seconds
  private readonly confidenceThreshold = 80; // Alert on patterns above 80% confidence

  private constructor() {
    this.patternEngine = PatternDetectionCore.getInstance();
    this.mexcService = new UnifiedMexcServiceV2();

    this.stats = {
      totalPatternsDetected: 0,
      readyStatePatterns: 0,
      preReadyPatterns: 0,
      advanceOpportunities: 0,
      averageConfidence: 0,
      patternsLast24h: 0,
      patternsLastHour: 0,
      detectionRate: 0,
      falsePositiveRate: 0,
      avgProcessingTime: 0,
      engineStatus: "idle",
      lastHealthCheck: new Date().toISOString(),
      consecutiveErrors: 0,
    };
  }

  public static getInstance(): PatternMonitoringService {
    if (!PatternMonitoringService.instance) {
      PatternMonitoringService.instance = new PatternMonitoringService();
    }
    return PatternMonitoringService.instance;
  }

  /**
   * Start real-time pattern monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.info("[PatternMonitoring] Already monitoring");
      return;
    }

    console.info("[PatternMonitoring] Starting real-time pattern monitoring...");
    this.isMonitoring = true;
    this.stats.engineStatus = "active";

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCycle();
    }, this.monitoringIntervalMs);

    // Perform initial monitoring cycle
    await this.performMonitoringCycle();
  }

  /**
   * Stop pattern monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.info("[PatternMonitoring] Stopping pattern monitoring...");
    this.isMonitoring = false;
    this.stats.engineStatus = "idle";

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current monitoring status and statistics
   */
  async getMonitoringReport(): Promise<PatternMonitoringReport> {
    // Update time-based metrics
    this.updateTimeBasedMetrics();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    // Determine overall status
    const status = this.determineOverallStatus();

    return {
      status,
      stats: { ...this.stats },
      recentActivity: [...this.recentActivity].slice(-10), // Last 10 activities
      activeAlerts: [...this.activeAlerts],
      recommendations,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get recent pattern matches
   */
  getRecentPatterns(limit = 20): PatternMatch[] {
    return [...this.patternHistory].slice(-limit);
  }

  /**
   * Get current monitoring status
   */
  get isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Manually trigger pattern detection on specific symbols
   */
  async detectPatternsManually(
    symbols: SymbolEntry[],
    calendarEntries?: CalendarEntry[]
  ): Promise<PatternMatch[]> {
    const startTime = Date.now();
    const allPatterns: PatternMatch[] = [];

    try {
      console.info(`[PatternMonitoring] Manual pattern detection on ${symbols.length} symbols`);

      // Detect ready state patterns
      const readyPatterns = await this.patternEngine.detectReadyStatePattern(symbols);
      allPatterns.push(...readyPatterns);

      // Detect pre-ready patterns
      const preReadyPatterns = await this.patternEngine.detectPreReadyPatterns(symbols);
      allPatterns.push(...preReadyPatterns);

      // Detect advance opportunities if calendar entries provided
      if (calendarEntries && calendarEntries.length > 0) {
        const advancePatterns =
          await this.patternEngine.detectAdvanceOpportunities(calendarEntries);
        allPatterns.push(...advancePatterns);
      }

      const processingTime = Date.now() - startTime;

      // Record activity
      this.recordActivity({
        timestamp: new Date().toISOString(),
        patterns: allPatterns,
        processingTime,
        symbolsAnalyzed: symbols.length,
        calendarEntriesAnalyzed: calendarEntries?.length || 0,
      });

      // Update statistics
      this.updateStats(allPatterns, processingTime);

      // Check for alerts
      this.checkForAlerts(allPatterns);

      return allPatterns;
    } catch (error) {
      console.error("[PatternMonitoring] Manual detection failed:", error);
      this.stats.consecutiveErrors++;
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): number {
    const initialCount = this.activeAlerts.length;
    this.activeAlerts = this.activeAlerts.filter((alert) => !alert.acknowledged);
    return initialCount - this.activeAlerts.length;
  }

  /**
   * Perform a single monitoring cycle
   */
  private async performMonitoringCycle(): Promise<void> {
    const _startTime = Date.now();

    try {
      console.info("[PatternMonitoring] Performing monitoring cycle...");

      // Get latest symbol data from MEXC
      const symbolsResponse = await this.mexcService.getAllSymbols();
      if (!symbolsResponse.success || !symbolsResponse.data) {
        throw new Error("Failed to fetch symbol data");
      }

      // Filter to symbols that might have patterns (optimize for performance)
      const candidateSymbols = this.filterCandidateSymbols(symbolsResponse.data);

      if (candidateSymbols.length === 0) {
        console.info("[PatternMonitoring] No candidate symbols found");
        return;
      }

      // Detect patterns
      const allPatterns = await this.detectPatternsManually(candidateSymbols);

      this.stats.consecutiveErrors = 0; // Reset error count on success
      console.info(`[PatternMonitoring] Cycle completed: ${allPatterns.length} patterns detected`);
    } catch (error) {
      console.error("[PatternMonitoring] Monitoring cycle failed:", error);
      this.stats.consecutiveErrors++;
      this.stats.engineStatus = this.stats.consecutiveErrors > 3 ? "error" : "active";
    } finally {
      this.stats.lastHealthCheck = new Date().toISOString();
    }
  }

  /**
   * Filter symbols to likely pattern candidates for performance
   */
  private filterCandidateSymbols(symbols: SymbolEntry[]): SymbolEntry[] {
    return symbols
      .filter((symbol) => {
        // Look for symbols with ready state indicators or approaching ready state
        const isNearReady = symbol.sts === 1 || symbol.sts === 2;
        const isActive = symbol.st === 1 || symbol.st === 2;
        const hasValidTradingTime = symbol.tt >= 3;

        return isNearReady && isActive && hasValidTradingTime;
      })
      .slice(0, 100); // Limit to 100 symbols for performance
  }

  /**
   * Record monitoring activity
   */
  private recordActivity(activity: RecentPatternActivity): void {
    this.recentActivity.push(activity);

    // Keep only recent activities
    if (this.recentActivity.length > this.maxRecentActivity) {
      this.recentActivity = this.recentActivity.slice(-this.maxRecentActivity);
    }
  }

  /**
   * Update monitoring statistics
   */
  private updateStats(patterns: PatternMatch[], processingTime: number): void {
    // Update pattern counts
    this.stats.totalPatternsDetected += patterns.length;

    patterns.forEach((pattern) => {
      switch (pattern.patternType) {
        case "ready_state":
          this.stats.readyStatePatterns++;
          break;
        case "pre_ready":
          this.stats.preReadyPatterns++;
          break;
        case "launch_sequence":
          this.stats.advanceOpportunities++;
          break;
      }
    });

    // Update confidence average
    if (patterns.length > 0) {
      const totalConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0);
      const newAverage = totalConfidence / patterns.length;
      this.stats.averageConfidence =
        this.stats.averageConfidence === 0
          ? newAverage
          : (this.stats.averageConfidence + newAverage) / 2;
    }

    // Update processing time
    this.stats.avgProcessingTime =
      this.stats.avgProcessingTime === 0
        ? processingTime
        : (this.stats.avgProcessingTime + processingTime) / 2;

    // Store patterns in history
    this.patternHistory.push(...patterns);
    if (this.patternHistory.length > this.maxPatternHistory) {
      this.patternHistory = this.patternHistory.slice(-this.maxPatternHistory);
    }

    // Update last pattern time
    if (patterns.length > 0) {
      this.stats.lastPatternTime = new Date().toISOString();
    }
  }

  /**
   * Update time-based metrics
   */
  private updateTimeBasedMetrics(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Count patterns in time windows
    const recentPatterns = this.recentActivity.filter((activity) => {
      const activityTime = new Date(activity.timestamp).getTime();
      return activityTime > oneDayAgo;
    });

    this.stats.patternsLast24h = recentPatterns.reduce(
      (sum, activity) => sum + activity.patterns.length,
      0
    );

    this.stats.patternsLastHour = recentPatterns
      .filter((activity) => new Date(activity.timestamp).getTime() > oneHourAgo)
      .reduce((sum, activity) => sum + activity.patterns.length, 0);

    // Calculate detection rate (patterns per hour)
    const hoursOfData = Math.min(
      recentPatterns.length * (this.monitoringIntervalMs / (60 * 60 * 1000)),
      24
    );
    this.stats.detectionRate = hoursOfData > 0 ? this.stats.patternsLast24h / hoursOfData : 0;
  }

  /**
   * Check for alert conditions
   */
  private checkForAlerts(patterns: PatternMatch[]): void {
    // High confidence ready state alerts
    const highConfidenceReady = patterns.filter(
      (p) => p.patternType === "ready_state" && p.confidence >= this.confidenceThreshold
    );

    if (highConfidenceReady.length > 0) {
      this.createAlert({
        type: "high_confidence_ready",
        severity: "high",
        message: `${highConfidenceReady.length} high-confidence ready state pattern(s) detected`,
        patterns: highConfidenceReady,
      });
    }

    // Advance opportunity alerts
    const advanceOpportunities = patterns.filter((p) => p.patternType === "launch_sequence");
    if (advanceOpportunities.length > 0) {
      this.createAlert({
        type: "advance_opportunity",
        severity: "medium",
        message: `${advanceOpportunities.length} advance opportunity pattern(s) detected`,
        patterns: advanceOpportunities,
      });
    }

    // System health alerts
    if (this.stats.consecutiveErrors >= 3) {
      this.createAlert({
        type: "system_issue",
        severity: "critical",
        message: `Pattern detection system experiencing errors (${this.stats.consecutiveErrors} consecutive failures)`,
        patterns: [],
      });
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(alertData: Omit<PatternAlert, "id" | "timestamp" | "acknowledged">): void {
    const alert: PatternAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alertData,
    };

    this.activeAlerts.push(alert);

    // Keep only recent alerts (last 50)
    if (this.activeAlerts.length > 50) {
      this.activeAlerts = this.activeAlerts.slice(-50);
    }
  }

  /**
   * Generate monitoring recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.stats.averageConfidence < 60) {
      recommendations.push(
        "Average pattern confidence is low - consider adjusting detection parameters"
      );
    }

    if (this.stats.consecutiveErrors > 0) {
      recommendations.push(
        "Recent detection errors detected - check system connectivity and data sources"
      );
    }

    if (this.stats.detectionRate < 1) {
      recommendations.push(
        "Low pattern detection rate - consider expanding symbol monitoring or adjusting filters"
      );
    }

    if (this.activeAlerts.length > 10) {
      recommendations.push("High number of active alerts - consider acknowledging resolved alerts");
    }

    if (this.stats.avgProcessingTime > 5000) {
      recommendations.push(
        "Pattern detection processing time is high - consider optimizing detection algorithms"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Pattern monitoring system is operating optimally");
    }

    return recommendations;
  }

  /**
   * Determine overall monitoring status
   */
  private determineOverallStatus(): "healthy" | "degraded" | "error" {
    if (this.stats.consecutiveErrors >= 5) {
      return "error";
    }

    if (this.stats.consecutiveErrors > 0 || this.stats.avgProcessingTime > 10000) {
      return "degraded";
    }

    return "healthy";
  }
}

export default PatternMonitoringService;
