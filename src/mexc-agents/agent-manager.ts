import { checkDatabaseHealth, checkMexcApiHealth, checkOpenAiHealth } from "../lib/health-checks";
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

  // Health check for all agents
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
  }> {
    try {
      // Get real health status for core dependencies
      const [mexcHealth, openAiHealth, dbHealth] = await Promise.allSettled([
        checkMexcApiHealth(),
        checkOpenAiHealth(),
        checkDatabaseHealth(),
      ]);

      const mexcApiStatus =
        mexcHealth.status === "fulfilled" ? mexcHealth.value.status : "unhealthy";
      const openAiStatus =
        openAiHealth.status === "fulfilled" ? openAiHealth.value.status : "unhealthy";
      const databaseStatus = dbHealth.status === "fulfilled" ? dbHealth.value.status : "unhealthy";

      // Check individual agent health based on their dependencies
      const agentHealthChecks = await Promise.allSettled([
        // Core trading agents
        Promise.resolve(mexcApiStatus !== "unhealthy"), // mexcApiAgent depends on MEXC API
        Promise.resolve(openAiStatus !== "unhealthy"), // patternDiscoveryAgent depends on OpenAI
        Promise.resolve(mexcApiStatus !== "unhealthy"), // calendarAgent depends on MEXC API
        Promise.resolve(mexcApiStatus !== "unhealthy" && openAiStatus !== "unhealthy"), // symbolAnalysisAgent depends on both
        Promise.resolve(openAiStatus !== "unhealthy"), // strategyAgent depends on OpenAI
        // Safety agents (self-contained, can work independently)
        this.simulationAgent
          .checkAgentHealth()
          .then((result) => result.healthy),
        this.riskManagerAgent.checkAgentHealth().then((result) => result.healthy),
        this.reconciliationAgent.checkAgentHealth().then((result) => result.healthy),
        this.errorRecoveryAgent.checkAgentHealth().then((result) => result.healthy),
      ]);

      return {
        // Core trading agents
        mexcApi: agentHealthChecks[0].status === "fulfilled" && agentHealthChecks[0].value === true,
        patternDiscovery:
          agentHealthChecks[1].status === "fulfilled" && agentHealthChecks[1].value === true,
        calendar:
          agentHealthChecks[2].status === "fulfilled" && agentHealthChecks[2].value === true,
        symbolAnalysis:
          agentHealthChecks[3].status === "fulfilled" && agentHealthChecks[3].value === true,
        strategy:
          agentHealthChecks[4].status === "fulfilled" && agentHealthChecks[4].value === true,
        // Safety agents
        simulation:
          agentHealthChecks[5].status === "fulfilled" && agentHealthChecks[5].value === true,
        riskManager:
          agentHealthChecks[6].status === "fulfilled" && agentHealthChecks[6].value === true,
        reconciliation:
          agentHealthChecks[7].status === "fulfilled" && agentHealthChecks[7].value === true,
        errorRecovery:
          agentHealthChecks[8].status === "fulfilled" && agentHealthChecks[8].value === true,
        details: {
          mexcApiStatus,
          openAiStatus,
          databaseStatus,
        },
      };
    } catch (error) {
      logger.error("[AgentManager] Health check failed:", error);
      return {
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
      };
    }
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
    simulation: { passed: boolean; issues: string[]; recommendations: string[] };
    riskManager: { passed: boolean; issues: string[]; recommendations: string[] };
    reconciliation: { passed: boolean; issues: string[]; recommendations: string[] };
    errorRecovery: { passed: boolean; issues: string[]; recommendations: string[] };
    summary: string[];
  }> {
    try {
      const [simulationCheck, riskCheck, reconciliationCheck, errorRecoveryCheck] =
        await Promise.all([
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
        criticalIssues.length === 0 ? "pass" : criticalIssues.length > 2 ? "critical" : "warning";

      const summary: string[] = [];
      if (overall === "pass") {
        summary.push("All safety systems are operational");
      } else {
        summary.push(`${criticalIssues.length} safety system(s) require attention`);
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
        simulation: { passed: false, issues: ["Safety check failed"], recommendations: [] },
        riskManager: { passed: false, issues: ["Safety check failed"], recommendations: [] },
        reconciliation: { passed: false, issues: ["Safety check failed"], recommendations: [] },
        errorRecovery: { passed: false, issues: ["Safety check failed"], recommendations: [] },
        summary: [`Safety check system error: ${error}`],
      };
    }
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
  }

  // Emergency halt coordination across all safety systems
  async activateEmergencyMode(reason: string): Promise<void> {
    await Promise.all([
      this.riskManagerAgent.activateEmergencyHalt(reason),
      this.simulationAgent.toggleSimulation(true), // Force simulation mode
    ]);

    // Get current system health for monitoring
    const systemHealth = this.errorRecoveryAgent.getSystemHealth();
    logger.info(`[Emergency Mode] System health status:`, systemHealth);
  }
}
