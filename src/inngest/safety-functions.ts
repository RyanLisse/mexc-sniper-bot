import { AgentManager } from "@/src/mexc-agents/agent-manager";
import { SafetyMonitorAgent } from "@/src/mexc-agents/safety-monitor-agent";
import { AdvancedRiskEngine } from "@/src/services/risk/advanced-risk-engine";
import { EmergencySafetySystem } from "@/src/services/risk/emergency-safety-system";
import { inngest } from "./client";

// Initialize safety systems
const agentManager = new AgentManager();
const riskEngine = new AdvancedRiskEngine();
const emergencySystem = new EmergencySafetySystem();
const safetyMonitor = new SafetyMonitorAgent();

// Set up system integrations
emergencySystem.setRiskEngine(riskEngine);
safetyMonitor.setIntegrations(riskEngine, emergencySystem);

// Legacy safety monitoring workflow - runs every 5 minutes
export const legacySafetyMonitor = inngest.createFunction(
  { id: "legacy-safety-monitor", name: "Legacy Comprehensive Safety Monitor" },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step, logger }) => {
    // Step 1: Perform comprehensive safety check
    const safetyStatus = await step.run("safety-check", async () => {
      return await agentManager.performComprehensiveSafetyCheck();
    });

    logger.info("Safety check completed", { status: safetyStatus.overall });

    // Step 2: Handle critical issues
    if (safetyStatus.overall === "critical") {
      await step.run("handle-critical-issues", async () => {
        // Activate emergency mode if critical issues detected
        await agentManager.activateEmergencyMode(
          "Critical safety issues detected during monitoring"
        );

        // Send alerts (would integrate with notification system)
        logger.error("CRITICAL SAFETY ISSUES DETECTED", {
          issues: safetyStatus.summary,
          timestamp: new Date().toISOString(),
        });

        return {
          action: "emergency_mode_activated",
          issues: safetyStatus.summary,
        };
      });
    }

    // Step 3: Update system metrics
    await step.run("update-metrics", async () => {
      const _riskManagerAgent = agentManager.getRiskManagerAgent();
      const errorRecoveryAgent = agentManager.getErrorRecoveryAgent();

      // Update system health metrics
      await errorRecoveryAgent.updateServiceHealth("safety_monitor", "healthy", 100, 0);

      return {
        timestamp: new Date().toISOString(),
        status: safetyStatus.overall,
      };
    });

    return {
      overall: safetyStatus.overall,
      timestamp: new Date().toISOString(),
      summary: safetyStatus.summary,
    };
  }
);

// Position reconciliation workflow - runs every 15 minutes
export const positionReconciliation = inngest.createFunction(
  { id: "position-reconciliation", name: "Position Reconciliation Check" },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step, logger }) => {
    // Step 1: Fetch local positions and balances
    const localData = await step.run("fetch-local-data", async () => {
      // This would integrate with your database to get current positions
      // For now, return mock data structure
      return {
        positions: [
          {
            symbol: "BTCUSDT",
            quantity: 0.1,
            averagePrice: 50000,
            marketValue: 5000,
            unrealizedPnL: 100,
            lastUpdated: new Date().toISOString(),
            source: "local" as const,
          },
        ],
        balances: [
          {
            totalBalance: 10000,
            availableBalance: 9000,
            lockedBalance: 1000,
            currency: "USDT",
            timestamp: new Date().toISOString(),
            source: "local" as const,
          },
        ],
      };
    });

    // Step 2: Fetch exchange positions and balances
    const exchangeData = await step.run("fetch-exchange-data", async () => {
      // This would integrate with MEXC API to get real positions
      // For now, return mock data structure
      return {
        positions: [
          {
            symbol: "BTCUSDT",
            quantity: 0.1,
            averagePrice: 50000,
            marketValue: 5000,
            unrealizedPnL: 100,
            lastUpdated: new Date().toISOString(),
            source: "exchange" as const,
          },
        ],
        balances: [
          {
            totalBalance: 10000,
            availableBalance: 9000,
            lockedBalance: 1000,
            currency: "USDT",
            timestamp: new Date().toISOString(),
            source: "exchange" as const,
          },
        ],
      };
    });

    // Step 3: Perform reconciliation
    const reconciliationReport = await step.run("perform-reconciliation", async () => {
      const reconciliationAgent = agentManager.getReconciliationAgent();

      return await reconciliationAgent.performReconciliation(
        localData.positions as any,
        localData.balances as any,
        exchangeData.positions as any,
        exchangeData.balances as any
      );
    });

    logger.info("Reconciliation completed", {
      reportId: reconciliationReport.id,
      discrepancies: reconciliationReport.discrepanciesFound,
      status: reconciliationReport.overallStatus,
    });

    // Step 4: Handle critical discrepancies
    if (reconciliationReport.criticalIssues > 0) {
      await step.run("handle-critical-discrepancies", async () => {
        const riskManagerAgent = agentManager.getRiskManagerAgent();

        // Trigger risk management response for critical discrepancies
        await riskManagerAgent.activateEmergencyHalt(
          `Critical position discrepancies found: ${reconciliationReport.criticalIssues} issues`
        );

        logger.error("CRITICAL POSITION DISCREPANCIES", {
          reportId: reconciliationReport.id,
          criticalIssues: reconciliationReport.criticalIssues,
          discrepancies: reconciliationReport.discrepancies.filter(
            (d) => d.severity === "critical"
          ),
        });

        return {
          action: "emergency_halt",
          criticalIssues: reconciliationReport.criticalIssues,
        };
      });
    }

    return reconciliationReport;
  }
);

// Risk monitoring workflow - runs every minute during trading hours
export const riskMonitor = inngest.createFunction(
  { id: "risk-monitor", name: "Real-time Risk Monitor" },
  { cron: "* * * * *" }, // Every minute
  async ({ step, logger }) => {
    // Step 1: Gather current risk metrics
    const currentMetrics = await step.run("gather-risk-metrics", async () => {
      // This would integrate with your trading system to get real metrics
      // For now, return mock data
      return {
        totalExposure: 5000,
        dailyPnL: -50,
        openPositions: 2,
        volatilityIndex: 45,
      };
    });

    // Step 2: Update risk manager
    const riskAssessment = await step.run("update-risk-manager", async () => {
      const riskManagerAgent = agentManager.getRiskManagerAgent();

      await (riskManagerAgent as any).updateRiskMetrics(
        currentMetrics.totalExposure,
        currentMetrics.dailyPnL,
        currentMetrics.openPositions,
        currentMetrics.volatilityIndex
      );

      return {
        metrics: riskManagerAgent.getRiskMetrics(),
        circuitBreakers: riskManagerAgent.getCircuitBreakers(),
        canTrade: riskManagerAgent.canExecuteTrade(),
      };
    });

    // Step 3: Check for immediate risk actions needed
    if (!riskAssessment.canTrade) {
      await step.run("handle-trading-halt", async () => {
        logger.warn("Trading halted by risk management", {
          reason: "Circuit breakers or emergency halt active",
          circuitBreakers: riskAssessment.circuitBreakers.filter((cb) => cb.triggered),
        });

        // This would integrate with trading system to halt trading
        return {
          action: "trading_halted",
          activeBreakers: riskAssessment.circuitBreakers.filter((cb) => cb.triggered).length,
        };
      });
    }

    return {
      riskLevel:
        currentMetrics.volatilityIndex > 70
          ? "high"
          : currentMetrics.volatilityIndex > 40
            ? "medium"
            : "low",
      canTrade: riskAssessment.canTrade,
      metrics: riskAssessment.metrics,
      timestamp: new Date().toISOString(),
    };
  }
);

// Simulation control workflow
export const simulationControl = inngest.createFunction(
  { id: "simulation-control", name: "Simulation Mode Control" },
  { event: "simulation/toggle" },
  async ({ event, step, logger }) => {
    const { enabled, userId } = event.data;

    // Step 1: Toggle simulation mode
    const simulationSession = await step.run("toggle-simulation", async () => {
      const simulationAgent = agentManager.getSimulationAgent();

      if (enabled) {
        // Start new simulation session
        const session = await simulationAgent.startSimulationSession(userId || "default", 10000);
        logger.info("Simulation session started", { sessionId: session.id });
        return session;
      }
      // End current simulation session
      const session = await simulationAgent.endSimulationSession();
      if (session) {
        logger.info("Simulation session ended", {
          sessionId: session.id,
          finalPnL: session.profitLoss,
          totalTrades: session.totalTrades,
        });
      }
      return session;
    });

    // Step 2: Coordinate with other safety systems
    await step.run("coordinate-safety-systems", async () => {
      await agentManager.toggleSimulationMode(enabled);

      // Update risk manager settings for simulation mode
      const riskManagerAgent = agentManager.getRiskManagerAgent();
      if (enabled) {
        // More relaxed limits for simulation
        riskManagerAgent.updateSafetyConfig({
          riskManagement: {
            ...riskManagerAgent.getSafetyConfig().riskManagement,
            maxDailyLoss: 10000,
            maxPositionSize: 1000,
          },
        });
      }

      return {
        simulationMode: enabled,
        coordinatedSystems: ["risk-manager", "simulation-agent"],
      };
    });

    return {
      simulationMode: enabled,
      session: simulationSession,
      timestamp: new Date().toISOString(),
    };
  }
);

// Error recovery workflow
export const errorRecovery = inngest.createFunction(
  { id: "error-recovery", name: "Automated Error Recovery" },
  { event: "error/recovery-needed" },
  async ({ event, step, logger }) => {
    const { error, context, severity } = event.data;

    // Step 1: Analyze error and determine recovery strategy
    const recoveryStrategy = await step.run("analyze-error", async () => {
      const errorRecoveryAgent = agentManager.getErrorRecoveryAgent();

      return await errorRecoveryAgent.handleError(new Error(error.message), {
        service: context.service || "unknown",
        operation: context.operation || "unknown",
        severity: severity || "medium",
        metadata: context,
      });
    });

    logger.info("Error recovery strategy determined", {
      shouldRetry: recoveryStrategy.shouldRetry,
      retryDelay: recoveryStrategy.retryDelay,
      action: recoveryStrategy.recommendedAction,
    });

    // Step 2: Execute recovery if recommended
    if (recoveryStrategy.shouldRetry) {
      await step.sleep("wait-before-retry", recoveryStrategy.retryDelay);

      const recoveryResult = await step.run("execute-recovery", async () => {
        // This would implement the actual recovery logic
        // For now, just log the recovery attempt
        logger.info("Executing recovery action", {
          action: recoveryStrategy.recommendedAction,
          delay: recoveryStrategy.retryDelay,
        });

        return {
          attempted: true,
          action: recoveryStrategy.recommendedAction,
          timestamp: new Date().toISOString(),
        };
      });

      return {
        recovered: true,
        strategy: recoveryStrategy,
        result: recoveryResult,
      };
    }

    // Step 3: Escalate if no retry recommended
    await step.run("escalate-error", async () => {
      if (severity === "critical") {
        await agentManager.activateEmergencyMode(`Critical error: ${error.message}`);
      }

      logger.error("Error escalated - no recovery possible", {
        error: error.message,
        context,
        severity,
        reason: recoveryStrategy.recommendedAction,
      });

      return {
        escalated: true,
        reason: recoveryStrategy.recommendedAction,
      };
    });

    return {
      recovered: false,
      escalated: true,
      strategy: recoveryStrategy,
    };
  }
);

// System health check workflow - runs every 2 minutes
export const systemHealthCheck = inngest.createFunction(
  { id: "system-health-check", name: "System Health Monitor" },
  { cron: "*/2 * * * *" }, // Every 2 minutes
  async ({ step, logger }) => {
    // Step 1: Check all agent health
    const agentHealth = await step.run("check-agent-health", async () => {
      return await agentManager.checkAgentHealth();
    });

    // Step 2: Update error recovery agent with health status
    await step.run("update-health-status", async () => {
      const errorRecoveryAgent = agentManager.getErrorRecoveryAgent();

      // Update health for each service based on agent status
      const healthUpdates = [
        { service: "mexc_api", healthy: agentHealth.mexcApi },
        { service: "openai", healthy: agentHealth.strategy && agentHealth.patternDiscovery },
        { service: "database", healthy: true }, // Derived from details if available
        { service: "safety_systems", healthy: agentHealth.simulation && agentHealth.riskManager },
      ];

      for (const update of healthUpdates) {
        await errorRecoveryAgent.updateServiceHealth(
          update.service,
          update.healthy ? "healthy" : "critical",
          100, // Mock response time
          update.healthy ? 0 : 50 // Mock error rate
        );
      }

      return healthUpdates;
    });

    logger.info("System health check completed", {
      overall: Object.values(agentHealth)
        .filter((v) => typeof v === "boolean")
        .every(Boolean)
        ? "healthy"
        : "degraded",
      agentHealth,
    });

    return {
      timestamp: new Date().toISOString(),
      agentHealth,
      systemStatus: Object.values(agentHealth)
        .filter((v) => typeof v === "boolean")
        .every(Boolean)
        ? "healthy"
        : "degraded",
    };
  }
);

// Advanced safety monitoring workflow - runs every 2 minutes
export const advancedSafetyMonitor = inngest.createFunction(
  { id: "advanced-safety-monitor", name: "Advanced Comprehensive Safety Monitor" },
  { cron: "*/2 * * * *" }, // Every 2 minutes
  async ({ step, logger }) => {
    // Step 1: Comprehensive system health check
    const systemHealth = await step.run("system-health-check", async () => {
      return await emergencySystem.performSystemHealthCheck();
    });

    logger.info("Advanced safety check completed", { status: systemHealth.overall });

    // Step 2: Risk engine assessment
    const riskAssessment = await step.run("risk-assessment", async () => {
      const healthStatus = riskEngine.getHealthStatus();
      const portfolioMetrics = await riskEngine.getPortfolioRiskMetrics();
      const activeAlerts = riskEngine.getActiveAlerts();

      return {
        healthy: healthStatus.healthy,
        riskScore: healthStatus.metrics.riskScore,
        portfolioValue: portfolioMetrics.totalValue,
        valueAtRisk: portfolioMetrics.valueAtRisk95,
        activeAlerts: activeAlerts.length,
        criticalAlerts: activeAlerts.filter((a) => a.severity === "critical").length,
      };
    });

    // Step 3: Agent behavior monitoring
    const agentMonitoring = await step.run("agent-monitoring", async () => {
      // Mock agent metrics (in production, would get from actual agents)
      const mockMetrics = [
        {
          agentId: "pattern-discovery-agent",
          agentType: "Pattern Discovery",
          responseTime: 1200 + Math.random() * 500,
          successRate: 94 + Math.random() * 4,
          errorRate: 2 + Math.random() * 3,
          confidenceScore: 85 + Math.random() * 10,
          memoryUsage: 128 + Math.random() * 64,
          cacheHitRate: 75 + Math.random() * 20,
          lastActivity: new Date().toISOString(),
          anomalyScore: Math.random() * 30,
        },
        {
          agentId: "risk-manager-agent",
          agentType: "Risk Manager",
          responseTime: 800 + Math.random() * 300,
          successRate: 97 + Math.random() * 3,
          errorRate: 1 + Math.random() * 2,
          confidenceScore: 92 + Math.random() * 6,
          memoryUsage: 96 + Math.random() * 32,
          cacheHitRate: 85 + Math.random() * 12,
          lastActivity: new Date().toISOString(),
          anomalyScore: Math.random() * 20,
        },
      ];

      const behaviorAnalysis = await safetyMonitor.monitorAgentBehavior(mockMetrics);
      const performanceCheck = await safetyMonitor.checkPerformanceDegradation();

      return {
        anomaliesDetected: behaviorAnalysis.anomaliesDetected.length,
        violations: behaviorAnalysis.violations.length,
        degradedAgents: performanceCheck.degradedAgents.length,
        recommendations: [...behaviorAnalysis.recommendations, ...performanceCheck.recommendations],
      };
    });

    // Step 4: Market anomaly detection
    const marketAnomalies = await step.run("market-anomaly-detection", async () => {
      // Mock market data for anomaly detection
      const mockMarketData = {
        volatility: 30 + Math.random() * 40,
        liquidity: 60 + Math.random() * 30,
        priceDeviations: Math.random() * 10,
        volumeAnomalies: Math.random() * 5,
      };

      return await emergencySystem.detectMarketAnomalies(mockMarketData);
    });

    // Step 5: Handle critical conditions
    const criticalConditions = [
      systemHealth.overall === "critical" || systemHealth.overall === "emergency",
      riskAssessment.criticalAlerts > 0,
      agentMonitoring.violations > 0,
      marketAnomalies.priceAnomalies.some((a) => a.severity === "critical"),
      marketAnomalies.liquidityGaps.some((g) => g.severity === "critical"),
    ];

    if (criticalConditions.some((condition) => condition)) {
      await step.run("handle-critical-conditions", async () => {
        const criticalReasons = [];

        if (systemHealth.overall === "critical" || systemHealth.overall === "emergency") {
          criticalReasons.push(`System health: ${systemHealth.overall}`);
        }
        if (riskAssessment.criticalAlerts > 0) {
          criticalReasons.push(`${riskAssessment.criticalAlerts} critical risk alerts`);
        }
        if (agentMonitoring.violations > 0) {
          criticalReasons.push(`${agentMonitoring.violations} agent violations`);
        }
        if (marketAnomalies.priceAnomalies.some((a) => a.severity === "critical")) {
          criticalReasons.push("Critical price anomalies detected");
        }
        if (marketAnomalies.liquidityGaps.some((g) => g.severity === "critical")) {
          criticalReasons.push("Critical liquidity gaps detected");
        }

        // Activate emergency response if conditions are severe
        if (criticalReasons.length > 1) {
          await emergencySystem.activateEmergencyResponse(
            "system_failure",
            "critical",
            `Multiple critical conditions detected: ${criticalReasons.join(", ")}`,
            ["advanced_safety_monitor"]
          );
        }

        logger.error("CRITICAL SAFETY CONDITIONS DETECTED", {
          conditions: criticalReasons,
          systemHealth: systemHealth.overall,
          riskScore: riskAssessment.riskScore,
          timestamp: new Date().toISOString(),
        });

        return {
          action: "emergency_response_activated",
          conditions: criticalReasons.length,
          severity: criticalReasons.length > 1 ? "critical" : "high",
        };
      });
    }

    // Step 6: Update system metrics
    await step.run("update-system-metrics", async () => {
      // Update risk engine with current market conditions
      await riskEngine.updateMarketConditions({
        volatilityIndex: 30 + Math.random() * 20,
        liquidityIndex: 70 + Math.random() * 20,
        marketSentiment:
          Math.random() > 0.7 ? "bullish" : Math.random() > 0.4 ? "neutral" : "bearish",
      });

      return {
        timestamp: new Date().toISOString(),
        systemHealth: systemHealth.overall,
        riskScore: riskAssessment.riskScore,
        agentHealth: agentMonitoring.anomaliesDetected === 0 ? "healthy" : "degraded",
      };
    });

    return {
      overall: systemHealth.overall,
      riskAssessment,
      agentMonitoring,
      marketAnomalies: {
        priceAnomalies: marketAnomalies.priceAnomalies.length,
        volumeAnomalies: marketAnomalies.volumeAnomalies.length,
        liquidityGaps: marketAnomalies.liquidityGaps.length,
      },
      criticalConditionsDetected: criticalConditions.some((c) => c),
      timestamp: new Date().toISOString(),
    };
  }
);

// Real-time risk monitoring - runs every minute during trading hours
export const realTimeRiskMonitor = inngest.createFunction(
  { id: "real-time-risk-monitor", name: "Real-time Advanced Risk Monitor" },
  { cron: "* 9-16 * * 1-5" }, // Every minute during trading hours (9 AM - 4 PM, Mon-Fri)
  async ({ step, logger }) => {
    // Step 1: Update current risk metrics
    const currentRiskMetrics = await step.run("update-risk-metrics", async () => {
      // Mock current trading data
      const mockTradingData = {
        totalExposure: 45000 + Math.random() * 10000,
        dailyPnL: -200 + Math.random() * 800,
        openPositions: 3 + Math.floor(Math.random() * 5),
        volatilityIndex: 25 + Math.random() * 30,
      };

      await (riskEngine as any).updateRiskMetrics(
        mockTradingData.totalExposure,
        mockTradingData.dailyPnL,
        mockTradingData.openPositions,
        mockTradingData.volatilityIndex
      );

      return await riskEngine.getPortfolioRiskMetrics();
    });

    // Step 2: Perform stress testing (every 10 minutes)
    const stressTestResults = await step.run("stress-testing", async () => {
      const shouldRunStressTest = Math.random() > 0.9; // ~10% chance

      if (shouldRunStressTest) {
        return await riskEngine.performStressTest();
      }

      return null;
    });

    // Step 3: Check for risk threshold breaches
    const riskAlerts = await step.run("check-risk-thresholds", async () => {
      const healthStatus = riskEngine.getHealthStatus();
      const activeAlerts = riskEngine.getActiveAlerts();

      // Check if risk score exceeds emergency threshold
      if (healthStatus.metrics.riskScore > 80) {
        await emergencySystem.activateEmergencyResponse(
          "risk_breach",
          "high",
          `Risk score exceeded threshold: ${healthStatus.metrics.riskScore}`,
          ["real_time_risk_monitor"]
        );
      }

      return {
        riskScore: healthStatus.metrics.riskScore,
        activeAlerts: activeAlerts.length,
        emergencyTriggered: healthStatus.metrics.riskScore > 80,
      };
    });

    // Type guard for portfolio metrics
    const portfolioMetrics = currentRiskMetrics as {
      totalValue?: number;
      valueAtRisk95?: number;
      diversificationScore?: number;
      concentrationRisk?: number;
    } | null;

    logger.info("Real-time risk monitoring completed", {
      portfolioValue: portfolioMetrics?.totalValue ?? 0,
      riskScore: riskAlerts.riskScore,
      activeAlerts: riskAlerts.activeAlerts,
      stressTestRun: stressTestResults !== null,
    });

    return {
      portfolioMetrics: {
        totalValue: portfolioMetrics?.totalValue ?? 0,
        valueAtRisk: portfolioMetrics?.valueAtRisk95 ?? 0,
        diversificationScore: portfolioMetrics?.diversificationScore ?? 0,
        concentrationRisk: portfolioMetrics?.concentrationRisk ?? 0,
      },
      riskAlerts,
      stressTestResults,
      timestamp: new Date().toISOString(),
    };
  }
);

// Pattern validation safety check
export const patternValidationSafety = inngest.createFunction(
  { id: "pattern-validation-safety", name: "Pattern Discovery Safety Validation" },
  { event: "pattern/discovered" },
  async ({ event, step, logger }) => {
    const { patternId, symbol, confidence, riskScore, patternData } = event.data;

    // Step 1: Safety monitor validation
    const validationResult = await step.run("safety-validation", async () => {
      return await safetyMonitor.validatePatternDiscovery(
        patternId,
        symbol,
        confidence,
        riskScore,
        patternData
      );
    });

    logger.info("Pattern validation completed", {
      patternId,
      symbol,
      recommendation: validationResult.recommendation,
      confidence: validationResult.confidence,
    });

    // Step 2: Consensus requirement check
    if (validationResult.consensus.required) {
      const consensusResult = await step.run("consensus-check", async () => {
        const consensusRequest = {
          requestId: `${patternId}-consensus`,
          type: "pattern_validation" as const,
          data: { patternId, symbol, confidence, riskScore, patternData },
          requiredAgents: ["strategy-agent", "risk-manager-agent", "pattern-discovery-agent"],
          consensusThreshold: 70,
          timeout: 30000,
          priority: "high" as const,
        };

        return await safetyMonitor.requestAgentConsensus(consensusRequest);
      });

      // Override validation if consensus disagrees
      if (!consensusResult.consensus.achieved && validationResult.recommendation === "proceed") {
        validationResult.recommendation = "reject";
        validationResult.reasoning.push(
          `Consensus not achieved: ${consensusResult.consensus.approvalRate}% approval`
        );
      }
    }

    // Step 3: Final safety approval
    const finalApproval = await step.run("final-approval", async () => {
      const approved = validationResult.recommendation === "proceed";

      if (!approved) {
        logger.warn("Pattern rejected by safety validation", {
          patternId,
          symbol,
          reasons: validationResult.reasoning,
        });
      }

      return {
        approved,
        confidence: validationResult.confidence,
        reasoning: validationResult.reasoning,
        consensusRequired: validationResult.consensus.required,
        consensusAchieved: validationResult.consensus.required
          ? validationResult.consensus.agreementLevel >= 70
          : true,
      };
    });

    return {
      patternId,
      symbol,
      validationResult,
      finalApproval,
      timestamp: new Date().toISOString(),
    };
  }
);

// Export all safety functions
export const safetyFunctions = [
  safetyMonitor,
  positionReconciliation,
  riskMonitor,
  simulationControl,
  errorRecovery,
  systemHealthCheck,
  advancedSafetyMonitor,
  realTimeRiskMonitor,
  patternValidationSafety,
];
