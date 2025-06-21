/**
 * Dynamic Agent Loader
 * Implements lazy loading for all 11 AI agents to reduce initial bundle size
 * Part of Task 5.1: Bundle Size Optimization
 */

import type { BaseAgent } from "./base-agent";

// Agent type definitions for type safety
export type AgentType =
  | "base"
  | "calendar"
  | "pattern-discovery"
  | "symbol-analysis"
  | "strategy"
  | "mexc-api"
  | "safety-base"
  | "risk-manager"
  | "simulation"
  | "reconciliation"
  | "error-recovery";

// Agent configuration interface
export interface DynamicAgentConfig {
  type: AgentType;
  config?: Record<string, unknown>;
}

// Agent instance cache for performance
const agentCache = new Map<AgentType, BaseAgent>();

/**
 * Dynamically loads and instantiates agents on demand
 * Uses dynamic imports to reduce initial bundle size
 */
export class DynamicAgentLoader {
  private static instance: DynamicAgentLoader;

  private constructor() {}

  static getInstance(): DynamicAgentLoader {
    if (!DynamicAgentLoader.instance) {
      DynamicAgentLoader.instance = new DynamicAgentLoader();
    }
    return DynamicAgentLoader.instance;
  }

  /**
   * Load agent dynamically with caching
   */
  async loadAgent(type: AgentType): Promise<BaseAgent> {
    // Return cached instance if available
    if (agentCache.has(type)) {
      return agentCache.get(type)!;
    }

    let AgentClass: new (...args: any[]) => BaseAgent;

    // Dynamic imports for each agent type
    switch (type) {
      case "base": {
        const { BaseAgent } = await import("./base-agent");
        AgentClass = BaseAgent;
        break;
      }

      case "calendar": {
        const { CalendarAgent } = await import("./calendar-agent");
        AgentClass = CalendarAgent;
        break;
      }

      case "pattern-discovery": {
        const { PatternDiscoveryAgent } = await import("./pattern-discovery-agent");
        AgentClass = PatternDiscoveryAgent;
        break;
      }

      case "symbol-analysis": {
        const { SymbolAnalysisAgent } = await import("./symbol-analysis-agent");
        AgentClass = SymbolAnalysisAgent;
        break;
      }


      case "mexc-api": {
        const { MexcApiAgent } = await import("./mexc-api-agent");
        AgentClass = MexcApiAgent;
        break;
      }

      case "safety-base": {
        // SafetyBaseAgent is abstract, can't be instantiated directly
        // Return a concrete implementation or throw error
        throw new Error(
          "SafetyBaseAgent is abstract and cannot be instantiated directly. Use a concrete safety agent instead."
        );
      }

      case "risk-manager": {
        const { RiskManagerAgent } = await import("./risk-manager-agent");
        AgentClass = RiskManagerAgent;
        break;
      }

      case "simulation": {
        const { SimulationAgent } = await import("./simulation-agent");
        AgentClass = SimulationAgent;
        break;
      }

      case "reconciliation": {
        const { ReconciliationAgent } = await import("./reconciliation-agent");
        AgentClass = ReconciliationAgent;
        break;
      }

      case "error-recovery": {
        const { ErrorRecoveryAgent } = await import("./error-recovery-agent");
        AgentClass = ErrorRecoveryAgent;
        break;
      }

      default:
        throw new Error(`Unknown agent type: ${type}`);
    }

    // Instantiate and cache the agent
    const agent = new AgentClass();
    agentCache.set(type, agent);

    return agent;
  }

  /**
   * Load multiple agents concurrently
   */
  async loadAgents(types: AgentType[]): Promise<Map<AgentType, BaseAgent>> {
    const loadPromises = types.map(async (type) => {
      const agent = await this.loadAgent(type);
      return [type, agent] as const;
    });

    const results = await Promise.all(loadPromises);
    return new Map(results);
  }

  /**
   * Preload commonly used agents for better UX
   */
  async preloadCoreAgents(): Promise<void> {
    const coreAgents: AgentType[] = [
      "mexc-api",
      "pattern-discovery",
      "symbol-analysis",
      "safety-base",
    ];

    await this.loadAgents(coreAgents);
  }

  /**
   * Clear agent cache (useful for memory management)
   */
  clearCache(): void {
    agentCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; types: AgentType[] } {
    return {
      size: agentCache.size,
      types: Array.from(agentCache.keys()),
    };
  }

  /**
   * Check if agent is cached
   */
  isAgentCached(type: AgentType): boolean {
    return agentCache.has(type);
  }
}

// Convenience functions for common operations
export const agentLoader = DynamicAgentLoader.getInstance();

/**
 * Helper function to load a single agent
 */
export async function loadAgent(type: AgentType): Promise<BaseAgent> {
  return agentLoader.loadAgent(type);
}

/**
 * Helper function to load multiple agents
 */
export async function loadAgents(types: AgentType[]): Promise<Map<AgentType, BaseAgent>> {
  return agentLoader.loadAgents(types);
}

/**
 * Preload core agents for better initial experience
 */
export async function preloadCoreAgents(): Promise<void> {
  return agentLoader.preloadCoreAgents();
}
