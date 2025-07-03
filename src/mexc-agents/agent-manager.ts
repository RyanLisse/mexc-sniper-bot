import {
  checkDatabaseHealth,
  checkMexcApiHealth,
  checkOpenAiHealth,
} from "@/src/lib/health-checks";
// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import { CalendarAgent } from "./calendar-agent";
import { ErrorRecoveryAgent } from "./error-recovery-agent";
import { MexcApiAgent } from "./mexc-api-agent";
import { PatternDiscoveryAgent } from "./pattern-discovery-agent";
import { ReconciliationAgent } from "./reconciliation-agent";
import { RiskManagerAgent } from "./risk-manager-agent";
// Safety agents
import { SimulationAgent } from "./simulation-agent";
import { StrategyAgent } from "./strategy-agent";
import { SymbolAnalysisAgent } from "./symbol-analysis-agent";

export class AgentManager {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[agent-manager]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[agent-manager]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[agent-manager]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[agent-manager]", message, context || ""),
  };

  // Health check optimization: cache health status for 30 seconds
  private healthCache: {
    timestamp: number;
    data: any;
  } | null = null;
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds

  // Core trading agents
  private mexcApiAgent: MexcApiAgent;
  private patternDiscoveryAgent: PatternDiscoveryAgent;
  private calendarAgent: CalendarAgent;
  private symbolAnalysisAgent: SymbolAnalysisAgent;
  private strategyAgent: StrategyAgent;

  // Safety agents
  private simulationAgent: SimulationAgent;
  private riskManagerAgent: RiskManagerAgent;
  private reconciliationAgent: ReconciliationAgent;
  private errorRecoveryAgent: ErrorRecoveryAgent;

  constructor() {
    // Initialize core trading agents
    this.mexcApiAgent = new MexcApiAgent();
    this.patternDiscoveryAgent = new PatternDiscoveryAgent();
    this.calendarAgent = new CalendarAgent();
    this.symbolAnalysisAgent = new SymbolAnalysisAgent();
    this.strategyAgent = new StrategyAgent();

    // Initialize safety agents
    this.simulationAgent = new SimulationAgent();
    this.riskManagerAgent = new RiskManagerAgent();
    this.reconciliationAgent = new ReconciliationAgent();
    this.errorRecoveryAgent = new ErrorRecoveryAgent();
  }

  getMexcApiAgent(): MexcApiAgent {
    return this.mexcApiAgent;
  }

  getPatternDiscoveryAgent(): PatternDiscoveryAgent {
    return this.patternDiscoveryAgent;
  }

  getCalendarAgent(): CalendarAgent {
    return this.calendarAgent;
  }

  getSymbolAnalysisAgent(): SymbolAnalysisAgent {
    return this.symbolAnalysisAgent;
  }

  getStrategyAgent(): StrategyAgent {
    return this.strategyAgent;
  }

  // Safety agent getters
  getSimulationAgent(): SimulationAgent {
    return this.simulationAgent;
  }

  getRiskManagerAgent(): RiskManagerAgent {
    return this.riskManagerAgent;
  }

  getReconciliationAgent(): ReconciliationAgent {
    return this.reconciliationAgent;
  }

  getErrorRecoveryAgent(): ErrorRecoveryAgent {
    return this.errorRecoveryAgent;
  }

  // Health check for all agents with caching optimization
  async checkAgentHealth(): Promise<{
    // Core trading agents
    mexcApi: boolean;
    patternDiscovery: boolean;
    calendar: boolean;
    symbolAnalysis: boolean;
    strategy: boolean;
    // Safety agents
    simulation: boolean;
    riskManager: boolean;
    reconciliation: boolean;
    errorRecovery: boolean;
    details: {
      mexcApiStatus: string;
      openAiStatus: string;
      databaseStatus: string;
    };
    cached?: boolean;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    // Check cache first for performance optimization
    if (
      this.healthCache &&
      Date.now() - this.healthCache.timestamp < this.HEALTH_CACHE_TTL
    ) {
      this.logger.debug("[AgentManager] Returning cached health status");
      return {
        ...this.healthCache.data,
        cached: true,
        responseTime: Date.now() - startTime,
      };
    }

    try {
      // Optimized batch health checks with timeout
      const healthCheckPromises = Promise.allSettled([
        this.checkCoreSystemsHealth(),
        this.checkSafetyAgentsHealth(),
      ]);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Health check timeout")), 3000)
      );

      const [coreSystemsResult, safetyAgentsResult] = (await Promise.race([
        healthCheckPromises,
        timeoutPromise,
      ])) as PromiseSettledResult<any>[];

      const coreSystemsHealth =
        coreSystemsResult.status === "fulfilled"
          ? coreSystemsResult.value
          : null;
      const safetyAgentsHealth =
        safetyAgentsResult.status === "fulfilled"
          ? safetyAgentsResult.value
          : null;

      const result = {
        // Core trading agents (based on system dependencies)
        mexcApi: coreSystemsHealth?.mexcApiStatus !== "unhealthy",
        patternDiscovery: coreSystemsHealth?.openAiStatus !== "unhealthy",
        calendar: coreSystemsHealth?.mexcApiStatus !== "unhealthy",
        symbolAnalysis:
          coreSystemsHealth?.mexcApiStatus !== "unhealthy" &&
          coreSystemsHealth?.openAiStatus !== "unhealthy",
        strategy: coreSystemsHealth?.openAiStatus !== "unhealthy",
        // Safety agents
        simulation: safetyAgentsHealth?.simulation || false,
        riskManager: safetyAgentsHealth?.riskManager || false,
        reconciliation: safetyAgentsHealth?.reconciliation || false,
        errorRecovery: safetyAgentsHealth?.errorRecovery || false,
        details: {
          mexcApiStatus: coreSystemsHealth?.mexcApiStatus || "error",
          openAiStatus: coreSystemsHealth?.openAiStatus || "error",
          databaseStatus: coreSystemsHealth?.databaseStatus || "error",
        },
        cached: false,
        responseTime: Date.now() - startTime,
      };

      // Cache the result for future requests
      this.healthCache = {
        timestamp: Date.now(),
        data: result,
      };

      this.logger.debug(
        `[AgentManager] Health check completed in ${result.responseTime}ms`
      );
      return result;
    } catch (error) {
      this.logger.error("[AgentManager] Health check failed:", error);
      const errorResult = {
        // Core trading agents
        mexcApi: false,
        patternDiscovery: false,
        calendar: false,
        symbolAnalysis: false,
        strategy: false,
        // Safety agents
        simulation: false,
        riskManager: false,
        reconciliation: false,
        errorRecovery: false,
        details: {
          mexcApiStatus: "error",
          openAiStatus: "error",
          databaseStatus: "error",
        },
        cached: false,
        responseTime: Date.now() - startTime,
      };

      // Cache error result for a shorter time (5 seconds)
      this.healthCache = {
        timestamp: Date.now() - (this.HEALTH_CACHE_TTL - 5000),
        data: errorResult,
      };

      return errorResult;
    }
  }

  /**
   * Optimized core systems health check
   */
  private async checkCoreSystemsHealth(): Promise<{
    mexcApiStatus: string;
    openAiStatus: string;
    databaseStatus: string;
  }> {
    const [mexcHealth, openAiHealth, dbHealth] = await Promise.allSettled([
      checkMexcApiHealth(),
      checkOpenAiHealth(),
      checkDatabaseHealth(),
    ]);

    return {
      mexcApiStatus:
        mexcHealth.status === "fulfilled"
          ? mexcHealth.value.status
          : "unhealthy",
      openAiStatus:
        openAiHealth.status === "fulfilled"
          ? openAiHealth.value.status
          : "unhealthy",
      databaseStatus:
        dbHealth.status === "fulfilled" ? dbHealth.value.status : "unhealthy",
    };
  }

  /**
   * Optimized safety agents health check
   */
  private async checkSafetyAgentsHealth(): Promise<{
    simulation: boolean;
    riskManager: boolean;
    reconciliation: boolean;
    errorRecovery: boolean;
  }> {
    // Batch safety agent health checks with shorter timeout
    const agentHealthChecks = await Promise.allSettled([
      Promise.race([
        this.simulationAgent
          .checkAgentHealth()
          .then((result) => result.healthy),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(false), 1000)
        ),
      ]),
      Promise.race([
        this.riskManagerAgent
          .checkAgentHealth()
          .then((result) => result.healthy),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(false), 1000)
        ),
      ]),
      Promise.race([
        this.reconciliationAgent
          .checkAgentHealth()
          .then((result) => result.healthy),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(false), 1000)
        ),
      ]),
      Promise.race([
        this.errorRecoveryAgent
          .checkAgentHealth()
          .then((result) => result.healthy),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(false), 1000)
        ),
      ]),
    ]);

    return {
      simulation:
        agentHealthChecks[0].status === "fulfilled" &&
        agentHealthChecks[0].value === true,
      riskManager:
        agentHealthChecks[1].status === "fulfilled" &&
        agentHealthChecks[1].value === true,
      reconciliation:
        agentHealthChecks[2].status === "fulfilled" &&
        agentHealthChecks[2].value === true,
      errorRecovery:
        agentHealthChecks[3].status === "fulfilled" &&
        agentHealthChecks[3].value === true,
    };
  }

  // Get agent status summary
  getAgentSummary(): {
    totalAgents: number;
    coreAgents: number;
    safetyAgents: number;
    agentTypes: string[];
    initialized: boolean;
  } {
    return {
      totalAgents: 9,
      coreAgents: 5,
      safetyAgents: 4,
      agentTypes: [
        // Core trading agents
        "mexc-api",
        "pattern-discovery",
        "calendar",
        "symbol-analysis",
        "strategy",
        // Safety agents
        "simulation",
        "risk-manager",
        "reconciliation",
        "error-recovery",
      ],
      initialized: !!(
        // Core agents
        (
          this.mexcApiAgent &&
          this.patternDiscoveryAgent &&
          this.calendarAgent &&
          this.symbolAnalysisAgent &&
          this.strategyAgent &&
          // Safety agents
          this.simulationAgent &&
          this.riskManagerAgent &&
          this.reconciliationAgent &&
          this.errorRecoveryAgent
        )
      ),
    };
  }

  // Safety-specific methods
  async performComprehensiveSafetyCheck(): Promise<{
    overall: "pass" | "warning" | "critical";
    simulation: {
      passed: boolean;
      issues: string[];
      recommendations: string[];
    };
    riskManager: {
      passed: boolean;
      issues: string[];
      recommendations: string[];
    };
    reconciliation: {
      passed: boolean;
      issues: string[];
      recommendations: string[];
    };
    errorRecovery: {
      passed: boolean;
      issues: string[];
      recommendations: string[];
    };
    summary: string[];
  }> {
    try {
      const [
        simulationCheck,
        riskCheck,
        reconciliationCheck,
        errorRecoveryCheck,
      ] = await Promise.all([
        this.simulationAgent.performSafetyCheck(null),
        this.riskManagerAgent.performSafetyCheck(null),
        this.reconciliationAgent.performSafetyCheck(null),
        this.errorRecoveryAgent.performSafetyCheck(null),
      ]);

      const criticalIssues = [
        simulationCheck,
        riskCheck,
        reconciliationCheck,
        errorRecoveryCheck,
      ].filter((check) => !check.passed);

      const overall =
        criticalIssues.length === 0
          ? "pass"
          : criticalIssues.length > 2
            ? "critical"
            : "warning";

      const summary: string[] = [];
      if (overall === "pass") {
        summary.push("All safety systems are operational");
      } else {
        summary.push(
          `${criticalIssues.length} safety system(s) require attention`
        );
        criticalIssues.forEach((check) => {
          summary.push(...check.issues);
        });
      }

      return {
        overall,
        simulation: simulationCheck,
        riskManager: riskCheck,
        reconciliation: reconciliationCheck,
        errorRecovery: errorRecoveryCheck,
        summary,
      };
    } catch (error) {
      return {
        overall: "critical",
        simulation: {
          passed: false,
          issues: ["Safety check failed"],
          recommendations: [],
        },
        riskManager: {
          passed: false,
          issues: ["Safety check failed"],
          recommendations: [],
        },
        reconciliation: {
          passed: false,
          issues: ["Safety check failed"],
          recommendations: [],
        },
        errorRecovery: {
          passed: false,
          issues: ["Safety check failed"],
          recommendations: [],
        },
        summary: [`Safety check system error: ${error}`],
      };
    }
  }

  /**
   * Clear health cache to force fresh health check
   */
  clearHealthCache(): void {
    this.healthCache = null;
    this.logger.debug("[AgentManager] Health cache cleared");
  }

  /**
   * Get health cache status for monitoring
   */
  getHealthCacheStatus(): {
    isCached: boolean;
    cacheAge: number;
    cacheValid: boolean;
  } {
    if (!this.healthCache) {
      return { isCached: false, cacheAge: 0, cacheValid: false };
    }

    const cacheAge = Date.now() - this.healthCache.timestamp;
    const cacheValid = cacheAge < this.HEALTH_CACHE_TTL;

    return {
      isCached: true,
      cacheAge,
      cacheValid,
    };
  }

  // Toggle simulation mode across all relevant systems
  async toggleSimulationMode(enabled: boolean): Promise<void> {
    this.simulationAgent.toggleSimulation(enabled);

    // Coordinate with risk manager to adjust thresholds for simulation
    if (enabled) {
      this.riskManagerAgent.updateSafetyConfig({
        riskManagement: {
          ...this.riskManagerAgent.getSafetyConfig().riskManagement,
          maxDailyLoss: 10000, // Higher limits for simulation
          maxPositionSize: 1000,
        },
      });
    }

    // Clear health cache after configuration changes
    this.clearHealthCache();
  }

  // Emergency halt coordination across all safety systems
  async activateEmergencyMode(reason: string): Promise<void> {
    await Promise.all([
      this.riskManagerAgent.activateEmergencyHalt(reason),
      this.simulationAgent.toggleSimulation(true), // Force simulation mode
    ]);

    // Get current system health for monitoring
    const systemHealth = this.errorRecoveryAgent.getSystemHealth();
    this.logger.info(`[Emergency Mode] System health status:`, systemHealth);
  }
}
