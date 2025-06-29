/**
 * Main Performance Collector
 * 
 * Orchestrates performance metrics collection across the system
 */

import { PERFORMANCE_CONSTANTS } from "@/src/lib/constants";
import type { AgentRegistry } from "../agent-registry";
import type { WorkflowExecutionResult } from "../workflow-engine";
import { AgentMetricsCollector } from "./collectors/agent-metrics-collector";
import { SystemMetricsCollector } from "./collectors/system-metrics-collector";
import { WorkflowMetricsCollector } from "./collectors/workflow-metrics-collector";
import { PerformanceReportGenerator } from "./reporters/performance-report-generator";
import type { 
  AgentPerformanceMetrics,
  MetricsStorage,
  PerformanceCollectorOptions, 
  PerformanceReport, 
  SystemPerformanceSnapshot, 
  WorkflowPerformanceMetrics
} from "./types";

export class PerformanceCollector {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[performance-collector]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[performance-collector]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[performance-collector]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[performance-collector]", message, context || ""),
  };

  private agentRegistry: AgentRegistry;
  private collectionInterval: NodeJS.Timeout | null = null;
  private isCollecting = false;
  private collectionIntervalMs = PERFORMANCE_CONSTANTS.COLLECTION_INTERVAL_MS;
  private maxHistorySize: number = PERFORMANCE_CONSTANTS.MAX_HISTORY_SIZE;

  // Storage
  private storage: MetricsStorage = {
    agentMetricsHistory: new Map(),
    workflowMetricsHistory: [],
    systemSnapshotHistory: [],
  };

  // Collectors
  private agentMetricsCollector: AgentMetricsCollector;
  private systemMetricsCollector: SystemMetricsCollector;
  private workflowMetricsCollector: WorkflowMetricsCollector;
  private reportGenerator: PerformanceReportGenerator;

  constructor(
    agentRegistry: AgentRegistry,
    options?: PerformanceCollectorOptions
  ) {
    this.agentRegistry = agentRegistry;

    if (options?.collectionInterval) {
      this.collectionIntervalMs = options.collectionInterval;
    }
    if (options?.maxHistorySize) {
      this.maxHistorySize = options.maxHistorySize;
    }

    // Initialize collectors
    this.agentMetricsCollector = new AgentMetricsCollector(agentRegistry);
    this.systemMetricsCollector = new SystemMetricsCollector(agentRegistry);
    this.workflowMetricsCollector = new WorkflowMetricsCollector();
    this.reportGenerator = new PerformanceReportGenerator();
  }

  /**
   * Start performance metrics collection
   */
  startCollection(): void {
    if (this.isCollecting) {
      this.logger.warn("Collection is already running");
      return;
    }

    this.isCollecting = true;

    // Initial collection
    this.collectAllMetrics().catch((error) => {
      this.logger.error("Initial metrics collection failed:", error);
    });

    // Set up periodic collection
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectAllMetrics();
      } catch (error) {
        this.logger.error(
          "Periodic metrics collection failed:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }, this.collectionIntervalMs);

    this.logger.info(
      `Started metrics collection (interval: ${this.collectionIntervalMs}ms)`
    );
  }

  /**
   * Stop performance metrics collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      this.isCollecting = false;
      this.logger.info("Stopped metrics collection");
    }
  }

  /**
   * Record workflow execution metrics
   */
  recordWorkflowExecution(result: WorkflowExecutionResult): void {
    this.workflowMetricsCollector.recordWorkflowExecution(
      result,
      this.storage.workflowMetricsHistory,
      this.maxHistorySize
    );
  }

  /**
   * Generate performance report for a given period
   */
  generateReport(startDate: Date, endDate: Date): PerformanceReport {
    return this.reportGenerator.generateReport(
      startDate,
      endDate,
      this.storage.agentMetricsHistory,
      this.storage.workflowMetricsHistory,
      this.storage.systemSnapshotHistory
    );
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): {
    agents: AgentPerformanceMetrics[];
    workflows: WorkflowPerformanceMetrics[];
    system: SystemPerformanceSnapshot | null;
  } {
    const agentMetrics = Array.from(this.storage.agentMetricsHistory.values())
      .map(history => history[history.length - 1])
      .filter(Boolean);

    const recentWorkflows = this.storage.workflowMetricsHistory
      .slice(-10); // Last 10 workflows

    const latestSystemSnapshot = this.storage.systemSnapshotHistory.length > 0
      ? this.storage.systemSnapshotHistory[this.storage.systemSnapshotHistory.length - 1]
      : null;

    return {
      agents: agentMetrics,
      workflows: recentWorkflows,
      system: latestSystemSnapshot,
    };
  }

  /**
   * Clear all metrics history
   */
  clearHistory(): void {
    this.storage.agentMetricsHistory.clear();
    this.storage.workflowMetricsHistory.length = 0;
    this.storage.systemSnapshotHistory.length = 0;
    this.logger.info("Cleared all metrics history");
  }

  /**
   * Get collection status
   */
  getStatus(): {
    isCollecting: boolean;
    collectionIntervalMs: number;
    agentCount: number;
    workflowCount: number;
    systemSnapshotCount: number;
  } {
    return {
      isCollecting: this.isCollecting,
      collectionIntervalMs: this.collectionIntervalMs,
      agentCount: this.storage.agentMetricsHistory.size,
      workflowCount: this.storage.workflowMetricsHistory.length,
      systemSnapshotCount: this.storage.systemSnapshotHistory.length,
    };
  }

  /**
   * Collect all performance metrics
   */
  private async collectAllMetrics(): Promise<void> {
    const timestamp = new Date();

    try {
      // Collect agent metrics
      await this.agentMetricsCollector.collectAgentMetrics(
        timestamp,
        this.storage.agentMetricsHistory,
        this.maxHistorySize
      );

      // Collect system snapshot
      await this.systemMetricsCollector.collectSystemSnapshot(
        timestamp,
        this.storage.agentMetricsHistory,
        this.storage.workflowMetricsHistory,
        this.storage.systemSnapshotHistory,
        this.maxHistorySize
      );

      // Persist to database (future enhancement)
      await this.persistMetrics();
    } catch (error) {
      this.logger.error(
        "Failed to collect metrics:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Persist metrics to database (placeholder for future implementation)
   */
  private async persistMetrics(): Promise<void> {
    // This would implement database persistence
    // For now, metrics are kept in memory
  }

  /**
   * Get current performance summary
   */
  getCurrentSummary(): any {
    return {
      agentCount: this.storage.agentMetricsHistory.size,
      workflowCount: this.storage.workflowMetricsHistory.length,
      systemSnapshots: this.storage.systemSnapshotHistory.length,
      isCollecting: this.isCollecting,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Destroy the performance collector and clean up resources
   */
  destroy(): void {
    this.logger.info("[PerformanceCollector] Performance collector destroyed");
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    
    this.isCollecting = false;
    
    // Clear storage
    this.storage.agentMetricsHistory.clear();
    this.storage.workflowMetricsHistory = [];
    this.storage.systemSnapshotHistory = [];
  }
}

// Re-export types for convenience
export type {
  AgentPerformanceMetrics,
  PerformanceCollectorOptions,
  PerformanceReport,
  SystemPerformanceSnapshot,
  WorkflowPerformanceMetrics,
} from "./types";