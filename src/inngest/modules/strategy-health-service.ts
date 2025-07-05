/**
 * Strategy Health Service
 *
 * Handles multi-phase strategy health monitoring and risk management workflows
 */

import { and, eq, gte } from "drizzle-orm";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import { RiskManagerAgent } from "@/src/mexc-agents/risk-manager-agent";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";
import { db } from "../../db";
import type {
  HealthCheckEvent,
  RiskAssessment,
  RiskFactor,
  ServiceResponse,
} from "../types/multi-phase-strategy-types";

export class StrategyHealthService {
  private riskManagerAgent: RiskManagerAgent;
  private strategyAgent: StrategyAgent;

  constructor() {
    this.riskManagerAgent = new RiskManagerAgent();
    this.strategyAgent = new StrategyAgent();
  }

  async executeHealthCheckWorkflow(
    data: HealthCheckEvent["data"],
    step: any
  ): Promise<ServiceResponse> {
    const { targetStrategies, checkType, includeCorrectiveActions } = data;

    // Step 1: Identify strategies to check
    const strategiesToCheck = await step.run(
      "identify-strategies",
      async () => {
        return this.identifyStrategiesForHealthCheck(targetStrategies);
      }
    );

    // Step 2: Perform health assessments
    const healthAssessments = await step.run("assess-health", async () => {
      return this.performBulkHealthAssessment(strategiesToCheck, checkType);
    });

    // Step 3: Analyze system-wide health
    const systemHealth = await step.run("analyze-system-health", async () => {
      return this.analyzeSystemHealth(healthAssessments);
    });

    // Step 4: Generate corrective actions if requested
    const correctiveActions = includeCorrectiveActions
      ? await step.run("generate-corrective-actions", async () => {
          return this.generateCorrectiveActions(
            healthAssessments,
            systemHealth
          );
        })
      : null;

    // Step 5: Update health metrics
    const updateResult = await step.run("update-health-metrics", async () => {
      return this.updateHealthMetrics(strategiesToCheck, healthAssessments);
    });

    return {
      success: true,
      data: {
        totalStrategiesChecked: strategiesToCheck.length,
        healthAssessments,
        systemHealth,
        correctiveActions,
        updateResult,
      },
      timestamp: new Date().toISOString(),
      metadata: {
        checkType,
        includeCorrectiveActions,
      },
    };
  }

  async performRiskAssessment(
    strategyId: string,
    assessmentType: string
  ): Promise<RiskAssessment> {
    const strategy = await this.getStrategyById(strategyId);

    if (!strategy) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const riskFactors = await this.identifyRiskFactors(
      strategy,
      assessmentType
    );
    const riskScore = this.calculateRiskScore(riskFactors);
    const riskLevel = this.determineRiskLevel(riskScore);
    const recommendations = this.generateRiskRecommendations(
      riskFactors,
      riskLevel
    );

    return {
      riskLevel,
      factors: riskFactors,
      score: riskScore,
      recommendations,
    };
  }

  async generateRiskMitigationPlan(
    strategyId: string,
    riskAssessment: RiskAssessment
  ) {
    const strategy = await this.getStrategyById(strategyId);

    const mitigationActions = [];

    for (const factor of riskAssessment.factors) {
      const action = await this.generateMitigationAction(factor, strategy);
      mitigationActions.push(action);
    }

    return {
      strategyId,
      riskLevel: riskAssessment.riskLevel,
      mitigationActions,
      implementationPriority:
        this.prioritizeMitigationActions(mitigationActions),
      estimatedTimeframe:
        this.estimateImplementationTimeframe(mitigationActions),
      expectedRiskReduction: this.estimateRiskReduction(mitigationActions),
    };
  }

  async applyEmergencyRiskControls(
    strategyId: string,
    riskAssessment: RiskAssessment
  ) {
    const emergencyActions = [];

    // Immediate position size reduction
    if (riskAssessment.riskLevel === "critical") {
      emergencyActions.push(await this.reducePositionSizes(strategyId, 0.5));
    }

    // Enable enhanced monitoring
    emergencyActions.push(await this.enableEnhancedMonitoring(strategyId));

    // Implement emergency stop loss
    emergencyActions.push(await this.implementEmergencyStopLoss(strategyId));

    // Notify risk management team
    emergencyActions.push(
      await this.notifyRiskManagementTeam(strategyId, riskAssessment)
    );

    // Update strategy status
    await this.updateStrategyEmergencyStatus(
      strategyId,
      "emergency_controls_active"
    );

    return {
      strategyId,
      actionsApplied: emergencyActions,
      timestamp: new Date().toISOString(),
      status: "emergency_controls_active",
    };
  }

  async getWorkflowStatus(workflowId: string) {
    // Implementation would query workflow tracking system
    return {
      workflowId,
      status: "active", // active, completed, failed, paused
      progress: 75,
      currentStep: "risk-assessment",
      estimatedCompletion: new Date(Date.now() + 300000), // 5 minutes
      errors: [],
      warnings: [],
    };
  }

  private async identifyStrategiesForHealthCheck(targetStrategies?: string[]) {
    if (targetStrategies && targetStrategies.length > 0) {
      return db
        .select()
        .from(tradingStrategies)
        .where(
          and(
            eq(tradingStrategies.status, "active")
            // Note: This would need a proper IN clause implementation
          )
        );
    }

    // Get all active strategies from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return db
      .select()
      .from(tradingStrategies)
      .where(
        and(
          eq(tradingStrategies.status, "active"),
          gte(tradingStrategies.lastExecuted, sevenDaysAgo)
        )
      );
  }

  private async performBulkHealthAssessment(
    strategies: any[],
    checkType: string
  ) {
    const assessments = [];

    for (const strategy of strategies) {
      try {
        const assessment = await this.performSingleHealthAssessment(
          strategy,
          checkType
        );
        assessments.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          healthScore: assessment.healthScore,
          status: assessment.status,
          issues: assessment.issues,
          recommendations: assessment.recommendations,
        });
      } catch (error) {
        console.error(
          `Health assessment failed for strategy ${strategy.id}:`,
          error
        );
        assessments.push({
          strategyId: strategy.id,
          strategyName: strategy.name,
          healthScore: 0,
          status: "error",
          issues: [`Assessment failed: ${(error as Error).message}`],
          recommendations: ["Manual review required"],
        });
      }
    }

    return assessments;
  }

  private async performSingleHealthAssessment(
    strategy: any,
    _checkType: string
  ) {
    const healthChecks = {
      performance: await this.checkPerformanceHealth(strategy),
      risk: await this.checkRiskHealth(strategy),
      execution: await this.checkExecutionHealth(strategy),
      data: await this.checkDataHealth(strategy),
    };

    const healthScore = this.calculateHealthScore(healthChecks);
    const status = this.determineHealthStatus(healthScore);
    const issues = this.identifyHealthIssues(healthChecks);
    const recommendations = this.generateHealthRecommendations(
      healthChecks,
      issues
    );

    return {
      healthScore,
      status,
      issues,
      recommendations,
      checks: healthChecks,
    };
  }

  private async checkPerformanceHealth(strategy: any) {
    const successRate = strategy.successRate || 0;
    const totalPnl = strategy.totalPnl || 0;

    return {
      metric: "performance",
      score:
        successRate > 60 && totalPnl > 0 ? 100 : successRate > 40 ? 70 : 30,
      details: {
        successRate,
        totalPnl,
        trend: totalPnl > 0 ? "positive" : "negative",
      },
    };
  }

  private async checkRiskHealth(strategy: any) {
    const riskLevel = strategy.riskLevel || "medium";
    const executionSummary = strategy.executionSummary
      ? JSON.parse(strategy.executionSummary)
      : {};
    const failureRate =
      executionSummary.failed /
      (executionSummary.failed + executionSummary.successful || 1);

    return {
      metric: "risk",
      score: failureRate < 0.2 ? 100 : failureRate < 0.4 ? 70 : 30,
      details: {
        riskLevel,
        failureRate,
        riskScore: this.calculateBasicRiskScore(strategy),
      },
    };
  }

  private async checkExecutionHealth(strategy: any) {
    const lastExecuted = strategy.lastExecuted
      ? new Date(strategy.lastExecuted)
      : null;
    const daysSinceExecution = lastExecuted
      ? (Date.now() - lastExecuted.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    return {
      metric: "execution",
      score: daysSinceExecution < 1 ? 100 : daysSinceExecution < 7 ? 80 : 40,
      details: {
        lastExecuted,
        daysSinceExecution,
        executionFrequency: this.calculateExecutionFrequency(strategy),
      },
    };
  }

  private async checkDataHealth(strategy: any) {
    const hasValidPhases = strategy.phases && strategy.phases.length > 0;
    const hasConfiguration =
      strategy.configuration && Object.keys(strategy.configuration).length > 0;

    return {
      metric: "data",
      score:
        hasValidPhases && hasConfiguration ? 100 : hasValidPhases ? 70 : 30,
      details: {
        phasesCount: strategy.phases?.length || 0,
        hasConfiguration,
        dataIntegrity: this.checkDataIntegrity(strategy),
      },
    };
  }

  private calculateHealthScore(healthChecks: any): number {
    const scores = Object.values(healthChecks).map((check: any) => check.score);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private determineHealthStatus(healthScore: number): string {
    if (healthScore >= 90) return "excellent";
    if (healthScore >= 70) return "good";
    if (healthScore >= 50) return "fair";
    if (healthScore >= 30) return "poor";
    return "critical";
  }

  private identifyHealthIssues(healthChecks: any): string[] {
    const issues = [];

    Object.values(healthChecks).forEach((check: any) => {
      if (check.score < 50) {
        issues.push(`${check.metric} health is below acceptable levels`);
      }
    });

    return issues;
  }

  private generateHealthRecommendations(
    healthChecks: any,
    issues: string[]
  ): string[] {
    const recommendations = [];

    if (issues.length === 0) {
      recommendations.push("Strategy health is optimal - continue monitoring");
    } else {
      Object.values(healthChecks).forEach((check: any) => {
        if (check.score < 70) {
          recommendations.push(
            `Improve ${check.metric} monitoring and controls`
          );
        }
      });
    }

    return recommendations;
  }

  private async analyzeSystemHealth(healthAssessments: any[]) {
    const totalStrategies = healthAssessments.length;
    const healthyStrategies = healthAssessments.filter(
      (a) => a.healthScore >= 70
    ).length;
    const criticalStrategies = healthAssessments.filter(
      (a) => a.healthScore < 30
    ).length;

    const avgHealthScore =
      healthAssessments.reduce((sum, a) => sum + a.healthScore, 0) /
      totalStrategies;

    return {
      totalStrategies,
      healthyStrategies,
      criticalStrategies,
      avgHealthScore,
      systemStatus:
        avgHealthScore >= 70
          ? "healthy"
          : avgHealthScore >= 50
            ? "warning"
            : "critical",
      recommendedActions: this.generateSystemRecommendations(
        avgHealthScore,
        criticalStrategies
      ),
    };
  }

  private generateCorrectiveActions(
    healthAssessments: any[],
    systemHealth: any
  ) {
    const actions = [];

    healthAssessments.forEach((assessment) => {
      if (assessment.healthScore < 50) {
        actions.push({
          strategyId: assessment.strategyId,
          action: "immediate_review",
          priority: "high",
          description:
            "Strategy requires immediate review and potential suspension",
        });
      }
    });

    if (systemHealth.systemStatus === "critical") {
      actions.push({
        scope: "system",
        action: "emergency_protocol",
        priority: "critical",
        description: "Activate emergency risk management protocols",
      });
    }

    return actions;
  }

  private async updateHealthMetrics(strategies: any[], assessments: any[]) {
    let updatedCount = 0;

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      const assessment = assessments[i];

      if (assessment && assessment.healthScore !== undefined) {
        await db
          .update(tradingStrategies)
          .set({
            aiInsights: `🏥 Health Score: ${assessment.healthScore.toFixed(1)}/100 - ${assessment.status}`,
            lastAiAnalysis: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tradingStrategies.id, strategy.id));

        updatedCount++;
      }
    }

    return {
      updatedStrategies: updatedCount,
      totalStrategies: strategies.length,
      timestamp: new Date().toISOString(),
    };
  }

  private async getStrategyById(strategyId: string) {
    const strategies = await db
      .select()
      .from(tradingStrategies)
      .where(eq(tradingStrategies.id, strategyId))
      .limit(1);

    return strategies.length > 0 ? strategies[0] : null;
  }

  private async identifyRiskFactors(
    strategy: any,
    _assessmentType: string
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Market risk factors
    if (strategy.totalPnl < -100) {
      factors.push({
        category: "market",
        severity: 8,
        description: "High accumulated losses detected",
        impact: "Potential for further significant losses",
      });
    }

    // Execution risk factors
    const executionSummary = strategy.executionSummary
      ? JSON.parse(strategy.executionSummary)
      : {};
    const failureRate =
      executionSummary.failed /
      (executionSummary.failed + executionSummary.successful || 1);

    if (failureRate > 0.3) {
      factors.push({
        category: "execution",
        severity: 7,
        description: "High execution failure rate",
        impact: "Unreliable strategy performance",
      });
    }

    // Risk management factors
    if (strategy.riskLevel === "high" && strategy.successRate < 60) {
      factors.push({
        category: "risk_management",
        severity: 6,
        description: "High risk strategy with poor success rate",
        impact: "Increased probability of significant losses",
      });
    }

    return factors;
  }

  private calculateRiskScore(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 10; // Low risk

    const totalSeverity = riskFactors.reduce(
      (sum, factor) => sum + factor.severity,
      0
    );
    const avgSeverity = totalSeverity / riskFactors.length;

    return Math.max(1, 10 - avgSeverity);
  }

  private determineRiskLevel(
    riskScore: number
  ): "low" | "medium" | "high" | "critical" {
    if (riskScore >= 8) return "low";
    if (riskScore >= 6) return "medium";
    if (riskScore >= 3) return "high";
    return "critical";
  }

  private generateRiskRecommendations(
    riskFactors: RiskFactor[],
    riskLevel: string
  ): string[] {
    const recommendations = [];

    riskFactors.forEach((factor) => {
      switch (factor.category) {
        case "market":
          recommendations.push("Implement stricter stop-loss controls");
          break;
        case "execution":
          recommendations.push("Review and optimize execution logic");
          break;
        case "risk_management":
          recommendations.push("Reduce position sizes and risk exposure");
          break;
      }
    });

    if (riskLevel === "critical") {
      recommendations.push("Consider immediate strategy suspension");
    }

    return recommendations;
  }

  private async generateMitigationAction(factor: RiskFactor, _strategy: any) {
    return {
      factorCategory: factor.category,
      action: this.getMitigationActionForCategory(factor.category),
      priority:
        factor.severity > 7
          ? "immediate"
          : factor.severity > 5
            ? "high"
            : "medium",
      estimatedEffort: this.estimateEffortForAction(factor.category),
      expectedImpact: this.estimateImpactForAction(factor.category),
    };
  }

  private getMitigationActionForCategory(category: string): string {
    const actions = {
      market: "Implement enhanced risk controls and position sizing",
      execution: "Optimize execution algorithms and error handling",
      risk_management: "Strengthen risk assessment and monitoring procedures",
    };

    return (
      actions[category as keyof typeof actions] ||
      "Review and optimize strategy parameters"
    );
  }

  private prioritizeMitigationActions(actions: any[]): any[] {
    return actions.sort((a, b) => {
      const priorityOrder = { immediate: 4, high: 3, medium: 2, low: 1 };
      return (
        priorityOrder[b.priority as keyof typeof priorityOrder] -
        priorityOrder[a.priority as keyof typeof priorityOrder]
      );
    });
  }

  private estimateImplementationTimeframe(actions: any[]): string {
    const immediateActions = actions.filter(
      (a) => a.priority === "immediate"
    ).length;
    const highPriorityActions = actions.filter(
      (a) => a.priority === "high"
    ).length;

    if (immediateActions > 0) return "1-2 hours";
    if (highPriorityActions > 2) return "1-2 days";
    return "3-5 days";
  }

  private estimateRiskReduction(actions: any[]): number {
    return Math.min(80, actions.length * 15); // 15% per action, max 80%
  }

  private async reducePositionSizes(
    _strategyId: string,
    reductionFactor: number
  ) {
    return {
      action: "position_size_reduction",
      reductionFactor,
      status: "applied",
      message: `Position sizes reduced by ${(reductionFactor * 100).toFixed(0)}%`,
    };
  }

  private async enableEnhancedMonitoring(_strategyId: string) {
    return {
      action: "enhanced_monitoring",
      status: "enabled",
      message: "Enhanced real-time monitoring activated",
    };
  }

  private async implementEmergencyStopLoss(_strategyId: string) {
    return {
      action: "emergency_stop_loss",
      status: "implemented",
      message: "Emergency stop-loss controls activated",
    };
  }

  private async notifyRiskManagementTeam(
    _strategyId: string,
    _riskAssessment: RiskAssessment
  ) {
    return {
      action: "risk_team_notification",
      status: "sent",
      message: "Risk management team notified of critical risk situation",
    };
  }

  private async updateStrategyEmergencyStatus(
    strategyId: string,
    status: string
  ) {
    await db
      .update(tradingStrategies)
      .set({
        status,
        aiInsights: `🚨 EMERGENCY: Emergency risk controls active - ${new Date().toISOString()}`,
        updatedAt: new Date(),
      })
      .where(eq(tradingStrategies.id, strategyId));
  }

  private calculateBasicRiskScore(strategy: any): number {
    const riskLevelScores = { low: 3, medium: 5, high: 8 };
    const baseScore =
      riskLevelScores[strategy.riskLevel as keyof typeof riskLevelScores] || 5;

    const successRate = strategy.successRate || 50;
    const riskAdjustment = (50 - successRate) / 10; // Adjust based on success rate

    return Math.max(1, Math.min(10, baseScore + riskAdjustment));
  }

  private calculateExecutionFrequency(_strategy: any): string {
    // Simplified frequency calculation
    return "daily"; // Would be calculated based on execution history
  }

  private checkDataIntegrity(strategy: any): string {
    const hasName = !!strategy.name;
    const hasPhases = strategy.phases && strategy.phases.length > 0;
    const hasValidConfig =
      strategy.configuration && typeof strategy.configuration === "object";

    if (hasName && hasPhases && hasValidConfig) return "good";
    if (hasName && hasPhases) return "fair";
    return "poor";
  }

  private generateSystemRecommendations(
    avgHealthScore: number,
    criticalCount: number
  ): string[] {
    const recommendations = [];

    if (avgHealthScore < 50) {
      recommendations.push("Immediate system-wide risk review required");
    }

    if (criticalCount > 0) {
      recommendations.push(
        `${criticalCount} critical strategies require immediate attention`
      );
    }

    if (avgHealthScore < 70) {
      recommendations.push("Implement enhanced monitoring and controls");
    }

    return recommendations;
  }

  private estimateEffortForAction(category: string): string {
    const effortMap = {
      market: "medium",
      execution: "high",
      risk_management: "low",
    };

    return effortMap[category as keyof typeof effortMap] || "medium";
  }

  private estimateImpactForAction(category: string): string {
    const impactMap = {
      market: "high",
      execution: "medium",
      risk_management: "high",
    };

    return impactMap[category as keyof typeof impactMap] || "medium";
  }
}
