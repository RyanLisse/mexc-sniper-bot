// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type { BaseAgent } from "../base-agent";

export type AgentStatus =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "unknown"
  | "recovering";

export interface HealthThresholds {
  responseTime: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
  consecutiveErrors: { warning: number; critical: number };
  uptime: { warning: number; critical: number };
  memoryUsage: { warning: number; critical: number };
  cpuUsage: { warning: number; critical: number };
}

export interface AgentHealth {
  status: AgentStatus;
  lastChecked: Date;
  lastResponse: Date | null;
  responseTime: number;
  errorCount: number;
  errorRate: number;
  consecutiveErrors: number;
  uptime: number;
  lastError?: string;
  capabilities: string[];
  load: { current: number; peak: number; average: number };
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  requestCount: number;
  successCount: number;
  lastRecoveryAttempt?: Date;
  recoveryAttempts: number;
  healthScore: number;
  trends: {
    responseTime: "improving" | "degrading" | "stable";
    errorRate: "improving" | "degrading" | "stable";
    throughput: "improving" | "degrading" | "stable";
  };
}

export interface RegisteredAgent {
  id: string;
  name: string;
  type: string;
  instance: BaseAgent;
  health: AgentHealth;
  registeredAt: Date;
  dependencies: string[];
  priority: number;
  tags: string[];
  thresholds: HealthThresholds;
  autoRecovery: boolean;
}

export interface AgentRegistryOptions {
  healthCheckInterval?: number;
  maxHealthHistorySize?: number;
  defaultThresholds?: HealthThresholds;
  autoRecoveryEnabled?: boolean;
  alertThresholds?: {
    unhealthyAgentPercentage: number;
    systemResponseTime: number;
    systemErrorRate: number;
  };
}

/**
 * Core agent registry for basic agent management
 */
export class AgentRegistryCore {
  protected logger = {
    info: (message: string, context?: any) =>
      console.info("[agent-registry-core]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[agent-registry-core]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[agent-registry-core]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[agent-registry-core]", message, context || ""),
  };
  protected agents: Map<string, RegisteredAgent> = new Map();
  protected isRunning = false;

  constructor(protected options?: AgentRegistryOptions) {}

  /**
   * Register an agent in the registry
   */
  registerAgent(
    id: string,
    instance: BaseAgent,
    options: {
      name: string;
      type: string;
      dependencies?: string[];
      priority?: number;
      tags?: string[];
      capabilities?: string[];
      thresholds?: HealthThresholds;
      autoRecovery?: boolean;
    }
  ): void {
    if (this.agents.has(id)) {
      throw new Error(`Agent with ID '${id}' is already registered`);
    }

    const registeredAgent: RegisteredAgent = {
      id,
      name: options.name,
      type: options.type,
      instance,
      registeredAt: new Date(),
      dependencies: options.dependencies || [],
      priority: options.priority || 5,
      tags: options.tags || [],
      thresholds: options.thresholds || this.getDefaultThresholds(),
      autoRecovery: options.autoRecovery ?? true,
      health: this.createInitialHealth(options.capabilities || []),
    };

    this.agents.set(id, registeredAgent);
    this.logger.info(`Registered agent: ${id} (${options.name})`);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;

    if (typeof agent.instance.destroy === "function") {
      agent.instance.destroy();
    }

    this.agents.delete(id);
    this.logger.info(`Unregistered agent: ${id}`);
    return true;
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: string): RegisteredAgent | null {
    return this.agents.get(id) || null;
  }

  /**
   * Get agent instance by ID
   */
  getAgentInstance(id: string): BaseAgent | null {
    const agent = this.agents.get(id);
    return agent?.instance || null;
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by type
   */
  getAgentsByType(type: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.type === type
    );
  }

  /**
   * Get agents by tag
   */
  getAgentsByTag(tag: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      agent.tags.includes(tag)
    );
  }

  /**
   * Check if an agent is available for workflows
   */
  isAgentAvailable(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    return (
      agent.health.status === "healthy" || agent.health.status === "degraded"
    );
  }

  /**
   * Get available agents by type
   */
  getAvailableAgentsByType(type: string): RegisteredAgent[] {
    return this.getAgentsByType(type).filter((agent) =>
      this.isAgentAvailable(agent.id)
    );
  }

  /**
   * Check if agent is already registered
   */
  hasAgent(id: string): boolean {
    return this.agents.has(id);
  }

  /**
   * Force unregister all agents (for testing)
   */
  clearAllAgents(): void {
    for (const [id] of this.agents) {
      this.unregisterAgent(id);
    }
  }

  /**
   * Create initial health state
   */
  protected createInitialHealth(capabilities: string[]): AgentHealth {
    return {
      status: "unknown",
      lastChecked: new Date(),
      lastResponse: null,
      responseTime: 0,
      errorCount: 0,
      errorRate: 0,
      consecutiveErrors: 0,
      uptime: 100,
      capabilities,
      load: { current: 0, peak: 0, average: 0 },
      memoryUsage: 0,
      cpuUsage: 0,
      cacheHitRate: 0,
      requestCount: 0,
      successCount: 0,
      recoveryAttempts: 0,
      healthScore: 100,
      trends: {
        responseTime: "stable",
        errorRate: "stable",
        throughput: "stable",
      },
    };
  }

  /**
   * Get default health thresholds
   */
  protected getDefaultThresholds(): HealthThresholds {
    return {
      responseTime: { warning: 1000, critical: 5000 },
      errorRate: { warning: 0.05, critical: 0.15 },
      consecutiveErrors: { warning: 3, critical: 5 },
      uptime: { warning: 95, critical: 90 },
      memoryUsage: { warning: 512, critical: 1024 },
      cpuUsage: { warning: 70, critical: 90 },
    };
  }
}
