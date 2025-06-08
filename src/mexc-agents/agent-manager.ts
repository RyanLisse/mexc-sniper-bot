import { StrategyAgent } from "../agents/strategy-agent";
import { checkDatabaseHealth, checkMexcApiHealth, checkOpenAiHealth } from "../lib/health-checks";
import { CalendarAgent } from "./calendar-agent";
import { MexcApiAgent } from "./mexc-api-agent";
import { PatternDiscoveryAgent } from "./pattern-discovery-agent";
import { SymbolAnalysisAgent } from "./symbol-analysis-agent";

export class AgentManager {
  private mexcApiAgent: MexcApiAgent;
  private patternDiscoveryAgent: PatternDiscoveryAgent;
  private calendarAgent: CalendarAgent;
  private symbolAnalysisAgent: SymbolAnalysisAgent;
  private strategyAgent: StrategyAgent;

  constructor() {
    // Initialize all agents
    this.mexcApiAgent = new MexcApiAgent();
    this.patternDiscoveryAgent = new PatternDiscoveryAgent();
    this.calendarAgent = new CalendarAgent();
    this.symbolAnalysisAgent = new SymbolAnalysisAgent();
    this.strategyAgent = new StrategyAgent();
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

  // Health check for all agents
  async checkAgentHealth(): Promise<{
    mexcApi: boolean;
    patternDiscovery: boolean;
    calendar: boolean;
    symbolAnalysis: boolean;
    strategy: boolean;
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
        Promise.resolve(mexcApiStatus !== "unhealthy"), // mexcApiAgent depends on MEXC API
        Promise.resolve(openAiStatus !== "unhealthy"), // patternDiscoveryAgent depends on OpenAI
        Promise.resolve(mexcApiStatus !== "unhealthy"), // calendarAgent depends on MEXC API
        Promise.resolve(mexcApiStatus !== "unhealthy" && openAiStatus !== "unhealthy"), // symbolAnalysisAgent depends on both
        Promise.resolve(openAiStatus !== "unhealthy"), // strategyAgent depends on OpenAI
      ]);

      return {
        mexcApi: agentHealthChecks[0].status === "fulfilled" && agentHealthChecks[0].value === true,
        patternDiscovery:
          agentHealthChecks[1].status === "fulfilled" && agentHealthChecks[1].value === true,
        calendar:
          agentHealthChecks[2].status === "fulfilled" && agentHealthChecks[2].value === true,
        symbolAnalysis:
          agentHealthChecks[3].status === "fulfilled" && agentHealthChecks[3].value === true,
        strategy:
          agentHealthChecks[4].status === "fulfilled" && agentHealthChecks[4].value === true,
        details: {
          mexcApiStatus,
          openAiStatus,
          databaseStatus,
        },
      };
    } catch (error) {
      console.error("[AgentManager] Health check failed:", error);
      return {
        mexcApi: false,
        patternDiscovery: false,
        calendar: false,
        symbolAnalysis: false,
        strategy: false,
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
    agentTypes: string[];
    initialized: boolean;
  } {
    return {
      totalAgents: 5,
      agentTypes: ["mexc-api", "pattern-discovery", "calendar", "symbol-analysis", "strategy"],
      initialized: !!(
        this.mexcApiAgent &&
        this.patternDiscoveryAgent &&
        this.calendarAgent &&
        this.symbolAnalysisAgent &&
        this.strategyAgent
      ),
    };
  }
}
