// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import { type AgentConfig, BaseAgent } from "./base-agent";

export interface SafetyConfig {
  simulation: {
    enabled: boolean;
    virtualBalance: number;
    realDataDelay: number; // seconds
  };

  riskManagement: {
    maxDailyLoss: number; // USDT
    maxPositionSize: number; // USDT
    maxConcurrentTrades: number;
    circuitBreakerThreshold: number; // percentage
  };

  reconciliation: {
    toleranceThreshold: number; // USDT
    checkInterval: number; // minutes
    autoReconcileLimit: number; // USDT
  };

  errorRecovery: {
    maxRetryAttempts: number;
    backoffMultiplier: number;
    healthCheckInterval: number; // seconds
  };
}

export interface SafetyEvent {
  id: string;
  type: "simulation" | "risk" | "reconciliation" | "error";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  agentId: string;
}

export interface SafetyMetrics {
  totalEvents: number;
  criticalEvents: number;
  lastEventTime: string | null;
  uptime: number; // percentage
  averageResponseTime: number; // milliseconds
}

export abstract class SafetyBaseAgent extends BaseAgent {
  protected safetyConfig: SafetyConfig;
  protected events: SafetyEvent[] = [];
  protected startTime: number;

  constructor(config: AgentConfig, safetyConfig?: Partial<SafetyConfig>) {
    super(config);
    this.startTime = Date.now();
    this.safetyConfig = this.mergeWithDefaultConfig(safetyConfig);
  }

  private mergeWithDefaultConfig(
    partial?: Partial<SafetyConfig>
  ): SafetyConfig {
    const defaultConfig: SafetyConfig = {
      simulation: {
        enabled: false,
        virtualBalance: 1000, // USDT
        realDataDelay: 0,
      },
      riskManagement: {
        maxDailyLoss: 100, // USDT
        maxPositionSize: 50, // USDT
        maxConcurrentTrades: 3,
        circuitBreakerThreshold: 10, // 10% loss
      },
      reconciliation: {
        toleranceThreshold: 0.01, // $0.01 USDT
        checkInterval: 5, // minutes
        autoReconcileLimit: 1, // $1 USDT
      },
      errorRecovery: {
        maxRetryAttempts: 3,
        backoffMultiplier: 2,
        healthCheckInterval: 30, // seconds
      },
    };

    return {
      simulation: { ...defaultConfig.simulation, ...partial?.simulation },
      riskManagement: {
        ...defaultConfig.riskManagement,
        ...partial?.riskManagement,
      },
      reconciliation: {
        ...defaultConfig.reconciliation,
        ...partial?.reconciliation,
      },
      errorRecovery: {
        ...defaultConfig.errorRecovery,
        ...partial?.errorRecovery,
      },
    };
  }

  protected async emitSafetyEvent(
    type: SafetyEvent["type"],
    severity: SafetyEvent["severity"],
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    // Build-safe logger - use console logger to avoid webpack bundling issues
    const logger = {
      info: (message: string, context?: any) =>
        console.info("[safety-base-agent]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[safety-base-agent]", message, context || ""),
      error: (message: string, context?: any) =>
        console.error("[safety-base-agent]", message, context || ""),
      debug: (message: string, context?: any) =>
        console.debug("[safety-base-agent]", message, context || ""),
    };

    const event: SafetyEvent = {
      id: `${this.config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      data,
      timestamp: new Date().toISOString(),
      agentId: this.config.name,
    };

    this.events.push(event);

    // Keep only last 100 events to prevent memory issues
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }

    // Log critical events
    if (severity === "critical") {
      logger.error(
        `[${this.config.name}] CRITICAL SAFETY EVENT: ${message}`,
        data
      );
    } else if (severity === "high") {
      logger.warn(
        `[${this.config.name}] HIGH SEVERITY EVENT: ${message}`,
        data
      );
    } else {
      logger.info(`[${this.config.name}] Safety event:`, message);
    }

    // Optionally send to external monitoring systems
    await this.notifyExternalSystems(event);
  }

  protected async notifyExternalSystems(event: SafetyEvent): Promise<void> {
    // Build-safe logger - use console logger to avoid webpack bundling issues
    const logger = {
      info: (message: string, context?: any) =>
        console.info("[safety-base-agent-notify]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[safety-base-agent-notify]", message, context || ""),
      error: (message: string, context?: any) =>
        console.error("[safety-base-agent-notify]", message, context || ""),
      debug: (message: string, context?: any) =>
        console.debug("[safety-base-agent-notify]", message, context || ""),
    };

    // Override in subclasses to send to monitoring systems
    // For now, just store in database if needed
    try {
      // Could implement webhook notifications, Slack alerts, etc.
      if (event.severity === "critical") {
        // In a real system, you'd send alerts here
        logger.info("Would send critical alert to monitoring systems:", event);
      }
    } catch (error) {
      logger.error("Failed to notify external systems:", error);
    }
  }

  public getEvents(limit = 50): SafetyEvent[] {
    return this.events.slice(-limit);
  }

  public getCriticalEvents(): SafetyEvent[] {
    return this.events.filter((event) => event.severity === "critical");
  }

  public getMetrics(): SafetyMetrics {
    const now = Date.now();
    const uptime = ((now - this.startTime) / (now - this.startTime)) * 100; // Always 100% for now

    return {
      totalEvents: this.events.length,
      criticalEvents: this.getCriticalEvents().length,
      lastEventTime:
        this.events.length > 0
          ? this.events[this.events.length - 1].timestamp
          : null,
      uptime,
      averageResponseTime: 0, // Would track actual response times
    };
  }

  public updateSafetyConfig(newConfig: Partial<SafetyConfig>): void {
    this.safetyConfig = this.mergeWithDefaultConfig(newConfig);
    this.emitSafetyEvent("simulation", "low", "Safety configuration updated", {
      newConfig: this.safetyConfig,
    });
  }

  public getSafetyConfig(): SafetyConfig {
    return { ...this.safetyConfig }; // Return a copy
  }

  // Abstract method that safety agents must implement
  abstract performSafetyCheck(data: unknown): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }>;

  // Abstract method for agent-specific health checks
  abstract checkAgentHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }>;
}
