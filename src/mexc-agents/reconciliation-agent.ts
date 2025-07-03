import type { AgentConfig, AgentResponse } from "./base-agent";
import { SafetyBaseAgent, type SafetyConfig } from "./safety-base-agent";

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  marketValue: number;
  unrealizedPnL: number;
  lastUpdated: string;
  source: "local" | "exchange";
}

export interface BalanceSnapshot {
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  currency: string;
  timestamp: string;
  source: "local" | "exchange";
}

export interface ReconciliationDiscrepancy {
  id: string;
  type: "position" | "balance" | "trade" | "order";
  severity: "minor" | "moderate" | "major" | "critical";
  symbol?: string;
  description: string;
  localValue: number;
  exchangeValue: number;
  difference: number;
  percentageDiff: number;
  autoReconcilable: boolean;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  resolution?: string;
}

export interface ReconciliationReport {
  id: string;
  startTime: string;
  endTime: string;
  totalChecks: number;
  discrepanciesFound: number;
  criticalIssues: number;
  autoResolved: number;
  manualReviewRequired: number;
  overallStatus: "clean" | "minor_issues" | "major_issues" | "critical";
  discrepancies: ReconciliationDiscrepancy[];
  recommendations: string[];
}

export interface ReconciliationConfig {
  enabled: boolean;
  autoReconcileThreshold: number; // USDT
  checkInterval: number; // minutes
  toleranceThreshold: number; // USDT
  maxAutoCorrections: number; // per session
  requireManualApproval: boolean;
  alertOnCritical: boolean;
}

export class ReconciliationAgent extends SafetyBaseAgent {
  private reconciliationConfig: ReconciliationConfig;
  private lastReconciliation: Date | null = null;
  private discrepancies: ReconciliationDiscrepancy[] = [];
  private autoCorrectionsCount = 0;
  private isReconciling = false;

  constructor(safetyConfig?: Partial<SafetyConfig>) {
    const config: AgentConfig = {
      name: "reconciliation-agent",
      model: "gpt-4o",
      temperature: 0.1,
      maxTokens: 2500,
      systemPrompt: `You are a precision reconciliation agent responsible for ensuring perfect accuracy between local trading records and exchange positions.

Your critical responsibilities:
1. Compare local database positions with real exchange positions
2. Detect and categorize discrepancies by severity and type
3. Implement automated reconciliation for minor differences
4. Flag major discrepancies for immediate manual review
5. Maintain audit trails of all reconciliation activities

Reconciliation Framework:
- Position Accuracy: Verify quantities, prices, and market values
- Balance Verification: Ensure available and locked balances match
- Trade Reconciliation: Confirm all executed trades are recorded
- Order Status: Verify open orders match between systems
- Real-time Monitoring: Continuous accuracy monitoring

Discrepancy Classification:
- Minor: < $1 difference, likely rounding or timing issues
- Moderate: $1-10 difference, requires investigation
- Major: $10-100 difference, immediate attention needed
- Critical: > $100 difference, trading halt recommended

Resolution Approach:
- Auto-reconcile minor discrepancies within configured thresholds
- Alert on moderate discrepancies with recommended actions
- Escalate major discrepancies for manual review
- Trigger emergency protocols for critical discrepancies

Always maintain the highest standards of financial accuracy and provide detailed audit trails for all reconciliation activities.`,
    };

    super(config, safetyConfig);

    this.reconciliationConfig = {
      enabled: true,
      autoReconcileThreshold:
        this.safetyConfig.reconciliation.autoReconcileLimit,
      checkInterval: this.safetyConfig.reconciliation.checkInterval,
      toleranceThreshold: this.safetyConfig.reconciliation.toleranceThreshold,
      maxAutoCorrections: 10,
      requireManualApproval: false,
      alertOnCritical: true,
    };
  }

  async process(
    input: string,
    context?: Record<string, unknown>
  ): Promise<AgentResponse> {
    const recentDiscrepancies = this.discrepancies.slice(-10);
    const lastReport = await this.getLastReconciliationSummary();

    const userMessage = `
Position Reconciliation Analysis Request:
Last Reconciliation: ${this.lastReconciliation?.toISOString() || "Never"}
Total Discrepancies: ${this.discrepancies.length}
Auto-corrections Today: ${this.autoCorrectionsCount}
Currently Reconciling: ${this.isReconciling}

Recent Discrepancies:
${recentDiscrepancies
  .map(
    (d) =>
      `- ${d.type} ${d.symbol || ""}: ${d.severity} - ${d.description} (${d.difference.toFixed(4)} USDT diff)`
  )
  .join("\n")}

Last Report Summary:
${lastReport}

Analysis Request: ${input}

Context Data:
${JSON.stringify(context, null, 2)}

Please provide detailed reconciliation analysis, identify potential causes of discrepancies, and recommend corrective actions.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async performReconciliation(
    localPositions: Position[],
    localBalances: BalanceSnapshot[],
    exchangePositions: Position[],
    exchangeBalances: BalanceSnapshot[]
  ): Promise<ReconciliationReport> {
    if (this.isReconciling) {
      throw new Error("Reconciliation already in progress");
    }

    this.isReconciling = true;
    const startTime = new Date().toISOString();
    const reportId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const discrepancies: ReconciliationDiscrepancy[] = [];
      let totalChecks = 0;

      // Reconcile positions
      const positionDiscrepancies = await this.reconcilePositions(
        localPositions,
        exchangePositions
      );
      discrepancies.push(...positionDiscrepancies);
      totalChecks += localPositions.length + exchangePositions.length;

      // Reconcile balances
      const balanceDiscrepancies = await this.reconcileBalances(
        localBalances,
        exchangeBalances
      );
      discrepancies.push(...balanceDiscrepancies);
      totalChecks += localBalances.length + exchangeBalances.length;

      // Categorize and process discrepancies
      const criticalIssues = discrepancies.filter(
        (d) => d.severity === "critical"
      ).length;
      const autoResolvableDiscrepancies = discrepancies.filter(
        (d) => d.autoReconcilable
      );

      // Attempt auto-resolution
      let autoResolved = 0;
      for (const discrepancy of autoResolvableDiscrepancies) {
        if (
          this.autoCorrectionsCount <
          this.reconciliationConfig.maxAutoCorrections
        ) {
          const resolved = await this.attemptAutoResolution(discrepancy);
          if (resolved) {
            autoResolved++;
            this.autoCorrectionsCount++;
            discrepancy.resolved = true;
            discrepancy.resolvedAt = new Date().toISOString();
            discrepancy.resolution = "auto-corrected";
          }
        }
      }

      // Create report
      const report: ReconciliationReport = {
        id: reportId,
        startTime,
        endTime: new Date().toISOString(),
        totalChecks,
        discrepanciesFound: discrepancies.length,
        criticalIssues,
        autoResolved,
        manualReviewRequired: discrepancies.filter((d) => !d.resolved).length,
        overallStatus: this.determineOverallStatus(discrepancies),
        discrepancies,
        recommendations: this.generateRecommendations(discrepancies),
      };

      // Store discrepancies
      this.discrepancies.push(...discrepancies);
      this.lastReconciliation = new Date();

      // Emit appropriate events
      await this.emitReconciliationEvents(report);

      return report;
    } finally {
      this.isReconciling = false;
    }
  }

  private async reconcilePositions(
    localPositions: Position[],
    exchangePositions: Position[]
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const exchangeMap = new Map(exchangePositions.map((p) => [p.symbol, p]));
    const localMap = new Map(localPositions.map((p) => [p.symbol, p]));

    // Check local positions against exchange
    for (const localPos of localPositions) {
      const exchangePos = exchangeMap.get(localPos.symbol);

      if (!exchangePos) {
        // Local position exists but not on exchange
        discrepancies.push({
          id: `pos-missing-${localPos.symbol}-${Date.now()}`,
          type: "position",
          severity: this.categorizeSeverity(localPos.marketValue),
          symbol: localPos.symbol,
          description: `Local position exists but missing on exchange`,
          localValue: localPos.quantity,
          exchangeValue: 0,
          difference: localPos.quantity,
          percentageDiff: 100,
          autoReconcilable:
            localPos.marketValue <
            this.reconciliationConfig.autoReconcileThreshold,
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      } else {
        // Compare quantities
        const quantityDiff = Math.abs(localPos.quantity - exchangePos.quantity);
        if (quantityDiff > this.reconciliationConfig.toleranceThreshold) {
          const percentDiff =
            (quantityDiff / Math.max(localPos.quantity, exchangePos.quantity)) *
            100;

          discrepancies.push({
            id: `pos-qty-${localPos.symbol}-${Date.now()}`,
            type: "position",
            severity: this.categorizeSeverity(
              quantityDiff * localPos.averagePrice
            ),
            symbol: localPos.symbol,
            description: `Position quantity mismatch`,
            localValue: localPos.quantity,
            exchangeValue: exchangePos.quantity,
            difference: quantityDiff,
            percentageDiff: percentDiff,
            autoReconcilable:
              quantityDiff * localPos.averagePrice <
              this.reconciliationConfig.autoReconcileThreshold,
            timestamp: new Date().toISOString(),
            resolved: false,
          });
        }

        // Compare average prices
        const priceDiff = Math.abs(
          localPos.averagePrice - exchangePos.averagePrice
        );
        const priceThreshold = localPos.averagePrice * 0.01; // 1% tolerance
        if (priceDiff > priceThreshold) {
          const percentDiff = (priceDiff / localPos.averagePrice) * 100;

          discrepancies.push({
            id: `pos-price-${localPos.symbol}-${Date.now()}`,
            type: "position",
            severity: this.categorizeSeverity(priceDiff * localPos.quantity),
            symbol: localPos.symbol,
            description: `Position average price mismatch`,
            localValue: localPos.averagePrice,
            exchangeValue: exchangePos.averagePrice,
            difference: priceDiff,
            percentageDiff: percentDiff,
            autoReconcilable: false, // Price discrepancies usually require manual review
            timestamp: new Date().toISOString(),
            resolved: false,
          });
        }
      }
    }

    // Check for exchange positions not in local database
    for (const exchangePos of exchangePositions) {
      if (!localMap.has(exchangePos.symbol)) {
        discrepancies.push({
          id: `pos-extra-${exchangePos.symbol}-${Date.now()}`,
          type: "position",
          severity: this.categorizeSeverity(exchangePos.marketValue),
          symbol: exchangePos.symbol,
          description: `Exchange position exists but missing locally`,
          localValue: 0,
          exchangeValue: exchangePos.quantity,
          difference: exchangePos.quantity,
          percentageDiff: 100,
          autoReconcilable:
            exchangePos.marketValue <
            this.reconciliationConfig.autoReconcileThreshold,
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      }
    }

    return discrepancies;
  }

  private async reconcileBalances(
    localBalances: BalanceSnapshot[],
    exchangeBalances: BalanceSnapshot[]
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const exchangeMap = new Map(exchangeBalances.map((b) => [b.currency, b]));

    for (const localBalance of localBalances) {
      const exchangeBalance = exchangeMap.get(localBalance.currency);

      if (!exchangeBalance) {
        discrepancies.push({
          id: `bal-missing-${localBalance.currency}-${Date.now()}`,
          type: "balance",
          severity: this.categorizeSeverity(localBalance.totalBalance),
          description: `Local balance exists but missing on exchange: ${localBalance.currency}`,
          localValue: localBalance.totalBalance,
          exchangeValue: 0,
          difference: localBalance.totalBalance,
          percentageDiff: 100,
          autoReconcilable:
            localBalance.totalBalance <
            this.reconciliationConfig.autoReconcileThreshold,
          timestamp: new Date().toISOString(),
          resolved: false,
        });
        continue;
      }

      // Check total balance
      const totalDiff = Math.abs(
        localBalance.totalBalance - exchangeBalance.totalBalance
      );
      if (totalDiff > this.reconciliationConfig.toleranceThreshold) {
        const percentDiff =
          (totalDiff /
            Math.max(localBalance.totalBalance, exchangeBalance.totalBalance)) *
          100;

        discrepancies.push({
          id: `bal-total-${localBalance.currency}-${Date.now()}`,
          type: "balance",
          severity: this.categorizeSeverity(totalDiff),
          description: `Total balance mismatch: ${localBalance.currency}`,
          localValue: localBalance.totalBalance,
          exchangeValue: exchangeBalance.totalBalance,
          difference: totalDiff,
          percentageDiff: percentDiff,
          autoReconcilable:
            totalDiff < this.reconciliationConfig.autoReconcileThreshold,
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      }

      // Check available balance
      const availableDiff = Math.abs(
        localBalance.availableBalance - exchangeBalance.availableBalance
      );
      if (availableDiff > this.reconciliationConfig.toleranceThreshold) {
        const percentDiff =
          (availableDiff /
            Math.max(
              localBalance.availableBalance,
              exchangeBalance.availableBalance
            )) *
          100;

        discrepancies.push({
          id: `bal-available-${localBalance.currency}-${Date.now()}`,
          type: "balance",
          severity: this.categorizeSeverity(availableDiff),
          description: `Available balance mismatch: ${localBalance.currency}`,
          localValue: localBalance.availableBalance,
          exchangeValue: exchangeBalance.availableBalance,
          difference: availableDiff,
          percentageDiff: percentDiff,
          autoReconcilable:
            availableDiff < this.reconciliationConfig.autoReconcileThreshold,
          timestamp: new Date().toISOString(),
          resolved: false,
        });
      }
    }

    return discrepancies;
  }

  private categorizeSeverity(
    amount: number
  ): "minor" | "moderate" | "major" | "critical" {
    if (amount < 1) return "minor";
    if (amount < 10) return "moderate";
    if (amount < 100) return "major";
    return "critical";
  }

  private async attemptAutoResolution(
    discrepancy: ReconciliationDiscrepancy
  ): Promise<boolean> {
    try {
      // This would implement actual reconciliation logic
      // For now, just mark as resolved for demonstration
      await this.emitSafetyEvent(
        "reconciliation",
        "low",
        `Auto-resolving discrepancy: ${discrepancy.description}`,
        { discrepancyId: discrepancy.id, amount: discrepancy.difference }
      );

      // In a real implementation, this would:
      // 1. Update the local database to match exchange
      // 2. Or create adjusting entries
      // 3. Log the reconciliation action

      return true;
    } catch (error) {
      await this.emitSafetyEvent(
        "reconciliation",
        "medium",
        `Failed to auto-resolve discrepancy: ${discrepancy.description}`,
        { discrepancyId: discrepancy.id, error: String(error) }
      );
      return false;
    }
  }

  private determineOverallStatus(
    discrepancies: ReconciliationDiscrepancy[]
  ): ReconciliationReport["overallStatus"] {
    if (discrepancies.length === 0) return "clean";

    const hasCritical = discrepancies.some((d) => d.severity === "critical");
    if (hasCritical) return "critical";

    const hasMajor = discrepancies.some((d) => d.severity === "major");
    if (hasMajor) return "major_issues";

    return "minor_issues";
  }

  private generateRecommendations(
    discrepancies: ReconciliationDiscrepancy[]
  ): string[] {
    const recommendations: string[] = [];

    const criticalCount = discrepancies.filter(
      (d) => d.severity === "critical"
    ).length;
    if (criticalCount > 0) {
      recommendations.push(
        `URGENT: ${criticalCount} critical discrepancies require immediate attention`
      );
      recommendations.push(
        "Consider halting trading until critical issues are resolved"
      );
    }

    const unresolvedCount = discrepancies.filter((d) => !d.resolved).length;
    if (unresolvedCount > 0) {
      recommendations.push(
        `${unresolvedCount} discrepancies require manual review`
      );
    }

    const positionIssues = discrepancies.filter(
      (d) => d.type === "position"
    ).length;
    if (positionIssues > 0) {
      recommendations.push(
        "Review position tracking and trade execution processes"
      );
    }

    const balanceIssues = discrepancies.filter(
      (d) => d.type === "balance"
    ).length;
    if (balanceIssues > 0) {
      recommendations.push("Verify balance updates and fee calculations");
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "All positions and balances are accurately reconciled"
      );
    }

    return recommendations;
  }

  private async emitReconciliationEvents(
    report: ReconciliationReport
  ): Promise<void> {
    const severity =
      report.criticalIssues > 0
        ? "critical"
        : report.overallStatus === "major_issues"
          ? "high"
          : report.overallStatus === "minor_issues"
            ? "medium"
            : "low";

    await this.emitSafetyEvent(
      "reconciliation",
      severity,
      `Reconciliation completed: ${report.overallStatus}`,
      {
        reportId: report.id,
        discrepanciesFound: report.discrepanciesFound,
        criticalIssues: report.criticalIssues,
        autoResolved: report.autoResolved,
        duration: Date.parse(report.endTime) - Date.parse(report.startTime),
      }
    );
  }

  private async getLastReconciliationSummary(): Promise<string> {
    if (!this.lastReconciliation) {
      return "No previous reconciliations";
    }

    const recentDiscrepancies = this.discrepancies.filter(
      (d) =>
        Date.parse(d.timestamp) >
        (this.lastReconciliation?.getTime() || 0) - 24 * 60 * 60 * 1000
    );

    return `Last: ${this.lastReconciliation.toISOString()}, Recent discrepancies: ${recentDiscrepancies.length}`;
  }

  async performSafetyCheck(_data: unknown): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for overdue reconciliation
    if (this.lastReconciliation) {
      const timeSinceLastRecon = Date.now() - this.lastReconciliation.getTime();
      const maxInterval =
        this.reconciliationConfig.checkInterval * 60 * 1000 * 2; // 2x the configured interval

      if (timeSinceLastRecon > maxInterval) {
        issues.push("Reconciliation overdue");
        recommendations.push("Run immediate reconciliation check");
      }
    } else {
      issues.push("No reconciliation has been performed");
      recommendations.push("Perform initial reconciliation");
    }

    // Check for unresolved critical discrepancies
    const criticalDiscrepancies = this.discrepancies.filter(
      (d) => d.severity === "critical" && !d.resolved
    );
    if (criticalDiscrepancies.length > 0) {
      issues.push(
        `${criticalDiscrepancies.length} unresolved critical discrepancies`
      );
      recommendations.push(
        "Resolve critical discrepancies before continuing trading"
      );
    }

    // Check auto-correction limits
    if (
      this.autoCorrectionsCount >= this.reconciliationConfig.maxAutoCorrections
    ) {
      issues.push("Auto-correction limit reached for today");
      recommendations.push(
        "Review auto-corrections and reset limits if appropriate"
      );
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendations,
    };
  }

  async checkAgentHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check reconciliation configuration
      if (!this.reconciliationConfig.enabled) {
        issues.push("Reconciliation is disabled");
      }

      // Check for excessive discrepancies
      if (this.discrepancies.length > 10000) {
        issues.push("Excessive discrepancies stored - potential memory issue");
      }

      // Check if currently stuck in reconciliation
      if (this.isReconciling) {
        const _now = Date.now();
        // Check if reconciliation has been running too long (over 10 minutes)
        // This would need additional tracking in a real implementation
        issues.push(
          "Warning: Reconciliation appears to be running for extended time"
        );
      }
    } catch (error) {
      issues.push(`Reconciliation agent health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // Getter methods
  getDiscrepancies(limit = 100): ReconciliationDiscrepancy[] {
    return this.discrepancies.slice(-limit);
  }

  getUnresolvedDiscrepancies(): ReconciliationDiscrepancy[] {
    return this.discrepancies.filter((d) => !d.resolved);
  }

  getCriticalDiscrepancies(): ReconciliationDiscrepancy[] {
    return this.discrepancies.filter((d) => d.severity === "critical");
  }

  getReconciliationConfig(): ReconciliationConfig {
    return { ...this.reconciliationConfig };
  }

  updateReconciliationConfig(config: Partial<ReconciliationConfig>): void {
    this.reconciliationConfig = { ...this.reconciliationConfig, ...config };
    this.emitSafetyEvent(
      "reconciliation",
      "low",
      "Reconciliation configuration updated",
      {
        newConfig: this.reconciliationConfig,
      }
    );
  }

  isReconciliationInProgress(): boolean {
    return this.isReconciling;
  }

  getLastReconciliationTime(): Date | null {
    return this.lastReconciliation;
  }

  resetAutoCorrectionsCount(): void {
    this.autoCorrectionsCount = 0;
    this.emitSafetyEvent(
      "reconciliation",
      "low",
      "Auto-corrections count reset",
      {
        previousCount: this.autoCorrectionsCount,
      }
    );
  }
}
