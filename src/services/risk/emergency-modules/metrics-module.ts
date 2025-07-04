/**
 * Metrics Module
 *
 * Handles performance tracking, analytics, and monitoring for emergency operations.
 * Extracted from advanced-emergency-coordinator.ts for better modularity.
 */

export interface CoordinatorMetrics {
  totalEmergencies: number;
  successfulResolutions: number;
  averageResolutionTime: number;
  autoRecoveries: number;
  manualInterventions: number;
  protocolsExecuted: Record<string, number>;
  levelEscalations: Record<string, number>;
  averageEscalationTime: number;
  testingMetrics: {
    totalTests: number;
    lastTestDate: number;
    successfulTests: number;
    failedTests: number;
  };
}

export interface TestResult {
  success: boolean;
  duration: number;
  results: Record<string, any>;
  issues: string[];
  timestamp: string;
}

export class MetricsModule {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[metrics-module]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[metrics-module]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[metrics-module]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[metrics-module]", message, context || ""),
  };

  private coordinatorMetrics: CoordinatorMetrics = {
    totalEmergencies: 0,
    successfulResolutions: 0,
    averageResolutionTime: 0,
    autoRecoveries: 0,
    manualInterventions: 0,
    protocolsExecuted: {},
    levelEscalations: {},
    averageEscalationTime: 0,
    testingMetrics: {
      totalTests: 0,
      lastTestDate: 0,
      successfulTests: 0,
      failedTests: 0,
    },
  };

  private performanceHistory: Array<{
    timestamp: string;
    metric: string;
    value: number;
    context?: Record<string, any>;
  }> = [];

  private testHistory: TestResult[] = [];

  /**
   * Record emergency start
   */
  recordEmergencyStart(protocolId: string): void {
    this.coordinatorMetrics.totalEmergencies++;
    this.coordinatorMetrics.protocolsExecuted[protocolId] =
      (this.coordinatorMetrics.protocolsExecuted[protocolId] || 0) + 1;

    this.recordPerformanceMetric("emergency_started", 1, { protocolId });

    this.logger.debug("Emergency start recorded", {
      protocolId,
      totalEmergencies: this.coordinatorMetrics.totalEmergencies,
    });
  }

  /**
   * Record emergency resolution
   */
  recordEmergencyResolution(
    protocolId: string,
    resolutionTime: number,
    method: "automatic" | "manual"
  ): void {
    this.coordinatorMetrics.successfulResolutions++;

    if (method === "automatic") {
      this.coordinatorMetrics.autoRecoveries++;
    } else {
      this.coordinatorMetrics.manualInterventions++;
    }

    // Update average resolution time
    this.updateAverageResolutionTime(resolutionTime);

    this.recordPerformanceMetric("emergency_resolved", resolutionTime, {
      protocolId,
      method,
    });

    this.logger.info("Emergency resolution recorded", {
      protocolId,
      resolutionTime,
      method,
      successfulResolutions: this.coordinatorMetrics.successfulResolutions,
    });
  }

  /**
   * Record emergency escalation
   */
  recordEmergencyEscalation(
    protocolId: string,
    fromLevel: string,
    toLevel: string,
    escalationTime: number
  ): void {
    const escalationKey = `${fromLevel}_to_${toLevel}`;
    this.coordinatorMetrics.levelEscalations[escalationKey] =
      (this.coordinatorMetrics.levelEscalations[escalationKey] || 0) + 1;

    // Update average escalation time
    this.updateAverageEscalationTime(escalationTime);

    this.recordPerformanceMetric("emergency_escalated", escalationTime, {
      protocolId,
      fromLevel,
      toLevel,
    });

    this.logger.debug("Emergency escalation recorded", {
      protocolId,
      fromLevel,
      toLevel,
      escalationTime,
    });
  }

  /**
   * Record test execution
   */
  recordTestExecution(testResult: TestResult): void {
    this.coordinatorMetrics.testingMetrics.totalTests++;
    this.coordinatorMetrics.testingMetrics.lastTestDate = Date.now();

    if (testResult.success) {
      this.coordinatorMetrics.testingMetrics.successfulTests++;
    } else {
      this.coordinatorMetrics.testingMetrics.failedTests++;
    }

    this.testHistory.push(testResult);

    this.recordPerformanceMetric("test_executed", testResult.duration, {
      success: testResult.success,
      issuesFound: testResult.issues.length,
    });

    this.logger.info("Test execution recorded", {
      success: testResult.success,
      duration: testResult.duration,
      issuesFound: testResult.issues.length,
      totalTests: this.coordinatorMetrics.testingMetrics.totalTests,
    });
  }

  /**
   * Record custom performance metric
   */
  recordPerformanceMetric(
    metric: string,
    value: number,
    context?: Record<string, any>
  ): void {
    this.performanceHistory.push({
      timestamp: new Date().toISOString(),
      metric,
      value,
      context,
    });

    this.logger.debug("Performance metric recorded", {
      metric,
      value,
      context,
    });
  }

  /**
   * Get current coordinator metrics
   */
  getCoordinatorMetrics(): CoordinatorMetrics {
    return { ...this.coordinatorMetrics };
  }

  /**
   * Get success rate metrics
   */
  getSuccessRateMetrics(): {
    emergencySuccessRate: number;
    autoRecoveryRate: number;
    testSuccessRate: number;
    averageResolutionTime: number;
    averageEscalationTime: number;
  } {
    const emergencySuccessRate =
      this.coordinatorMetrics.totalEmergencies > 0
        ? this.coordinatorMetrics.successfulResolutions /
          this.coordinatorMetrics.totalEmergencies
        : 0;

    const autoRecoveryRate =
      this.coordinatorMetrics.successfulResolutions > 0
        ? this.coordinatorMetrics.autoRecoveries /
          this.coordinatorMetrics.successfulResolutions
        : 0;

    const testSuccessRate =
      this.coordinatorMetrics.testingMetrics.totalTests > 0
        ? this.coordinatorMetrics.testingMetrics.successfulTests /
          this.coordinatorMetrics.testingMetrics.totalTests
        : 0;

    return {
      emergencySuccessRate,
      autoRecoveryRate,
      testSuccessRate,
      averageResolutionTime: this.coordinatorMetrics.averageResolutionTime,
      averageEscalationTime: this.coordinatorMetrics.averageEscalationTime,
    };
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(
    metric: string,
    timeRange: number = 24 * 60 * 60 * 1000
  ): Array<{
    timestamp: string;
    value: number;
    context?: Record<string, any>;
  }> {
    const cutoffTime = Date.now() - timeRange;

    return this.performanceHistory
      .filter(
        (record) =>
          record.metric === metric &&
          new Date(record.timestamp).getTime() > cutoffTime
      )
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }

  /**
   * Get protocol performance breakdown
   */
  getProtocolPerformanceBreakdown(): Array<{
    protocolId: string;
    executions: number;
    percentage: number;
  }> {
    const total = this.coordinatorMetrics.totalEmergencies;

    return Object.entries(this.coordinatorMetrics.protocolsExecuted)
      .map(([protocolId, executions]) => ({
        protocolId,
        executions,
        percentage: total > 0 ? (executions / total) * 100 : 0,
      }))
      .sort((a, b) => b.executions - a.executions);
  }

  /**
   * Get escalation patterns
   */
  getEscalationPatterns(): Array<{
    escalationPath: string;
    count: number;
    percentage: number;
  }> {
    const totalEscalations = Object.values(
      this.coordinatorMetrics.levelEscalations
    ).reduce((sum, count) => sum + count, 0);

    return Object.entries(this.coordinatorMetrics.levelEscalations)
      .map(([escalationPath, count]) => ({
        escalationPath,
        count,
        percentage: totalEscalations > 0 ? (count / totalEscalations) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get recent test results
   */
  getRecentTestResults(limit: number = 10): TestResult[] {
    return this.testHistory
      .slice(-limit)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.coordinatorMetrics = {
      totalEmergencies: 0,
      successfulResolutions: 0,
      averageResolutionTime: 0,
      autoRecoveries: 0,
      manualInterventions: 0,
      protocolsExecuted: {},
      levelEscalations: {},
      averageEscalationTime: 0,
      testingMetrics: {
        totalTests: 0,
        lastTestDate: 0,
        successfulTests: 0,
        failedTests: 0,
      },
    };

    this.performanceHistory = [];
    this.testHistory = [];

    this.logger.info("Metrics reset completed");
  }

  /**
   * Clean old performance history
   */
  cleanOldPerformanceHistory(maxAge: number): number {
    const cutoffTime = Date.now() - maxAge;
    const initialCount = this.performanceHistory.length;

    this.performanceHistory = this.performanceHistory.filter((record) => {
      const recordTime = new Date(record.timestamp).getTime();
      return recordTime > cutoffTime;
    });

    const removedCount = initialCount - this.performanceHistory.length;

    if (removedCount > 0) {
      this.logger.info("Old performance history cleaned", {
        removedCount,
        remainingCount: this.performanceHistory.length,
      });
    }

    return removedCount;
  }

  /**
   * Clean old test history
   */
  cleanOldTestHistory(maxAge: number): number {
    const cutoffTime = Date.now() - maxAge;
    const initialCount = this.testHistory.length;

    this.testHistory = this.testHistory.filter((test) => {
      const testTime = new Date(test.timestamp).getTime();
      return testTime > cutoffTime;
    });

    const removedCount = initialCount - this.testHistory.length;

    if (removedCount > 0) {
      this.logger.info("Old test history cleaned", {
        removedCount,
        remainingCount: this.testHistory.length,
      });
    }

    return removedCount;
  }

  /**
   * Generate metrics summary report
   */
  generateMetricsSummary(): {
    overview: {
      totalEmergencies: number;
      successRate: number;
      averageResolutionTime: number;
      autoRecoveryRate: number;
    };
    protocols: Array<{
      protocolId: string;
      executions: number;
      percentage: number;
    }>;
    escalations: Array<{
      escalationPath: string;
      count: number;
      percentage: number;
    }>;
    testing: {
      totalTests: number;
      successRate: number;
      lastTestDate: string;
    };
    performance: {
      recentTrends: Record<string, number>;
      averageResponseTime: number;
    };
  } {
    const successRates = this.getSuccessRateMetrics();
    const protocolBreakdown = this.getProtocolPerformanceBreakdown();
    const escalationPatterns = this.getEscalationPatterns();

    // Calculate recent performance trends
    const recentTrends: Record<string, number> = {};
    const trendsTimeRange = 24 * 60 * 60 * 1000; // 24 hours

    ["emergency_started", "emergency_resolved", "emergency_escalated"].forEach(
      (metric) => {
        const trends = this.getPerformanceTrends(metric, trendsTimeRange);
        recentTrends[metric] = trends.reduce(
          (sum, record) => sum + record.value,
          0
        );
      }
    );

    const averageResponseTime = this.performanceHistory
      .filter((record) => record.metric === "emergency_resolved")
      .reduce((sum, record, _, array) => sum + record.value / array.length, 0);

    return {
      overview: {
        totalEmergencies: this.coordinatorMetrics.totalEmergencies,
        successRate: successRates.emergencySuccessRate,
        averageResolutionTime: this.coordinatorMetrics.averageResolutionTime,
        autoRecoveryRate: successRates.autoRecoveryRate,
      },
      protocols: protocolBreakdown.slice(0, 5), // Top 5 protocols
      escalations: escalationPatterns.slice(0, 5), // Top 5 escalation patterns
      testing: {
        totalTests: this.coordinatorMetrics.testingMetrics.totalTests,
        successRate: successRates.testSuccessRate,
        lastTestDate: new Date(
          this.coordinatorMetrics.testingMetrics.lastTestDate
        ).toISOString(),
      },
      performance: {
        recentTrends,
        averageResponseTime,
      },
    };
  }

  // Private helper methods

  private updateAverageResolutionTime(newResolutionTime: number): void {
    const currentAverage = this.coordinatorMetrics.averageResolutionTime;
    const count = this.coordinatorMetrics.successfulResolutions;

    if (count === 1) {
      this.coordinatorMetrics.averageResolutionTime = newResolutionTime;
    } else {
      this.coordinatorMetrics.averageResolutionTime =
        (currentAverage * (count - 1) + newResolutionTime) / count;
    }
  }

  private updateAverageEscalationTime(newEscalationTime: number): void {
    const totalEscalations = Object.values(
      this.coordinatorMetrics.levelEscalations
    ).reduce((sum, count) => sum + count, 0);

    const currentAverage = this.coordinatorMetrics.averageEscalationTime;

    if (totalEscalations === 1) {
      this.coordinatorMetrics.averageEscalationTime = newEscalationTime;
    } else {
      this.coordinatorMetrics.averageEscalationTime =
        (currentAverage * (totalEscalations - 1) + newEscalationTime) /
        totalEscalations;
    }
  }
}
