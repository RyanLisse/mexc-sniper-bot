/**
 * OpenTelemetry Agent Instrumentation
 * Minimal implementation for build optimization
 */

export interface AgentInstrumentationConfig {
  enabled: boolean;
  traceAgentOperations: boolean;
  includeAgentMetadata: boolean;
}

class AgentInstrumentation {
  private config: AgentInstrumentationConfig = {
    enabled: process.env.NODE_ENV === "production",
    traceAgentOperations: false,
    includeAgentMetadata: false,
  };

  initialize(config?: Partial<AgentInstrumentationConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.enabled) {
      console.log("Agent instrumentation initialized");
    }
  }

  traceAgentOperation(
    agentId: string,
    operation: string,
    metadata?: any
  ): void {
    if (!this.config.enabled || !this.config.traceAgentOperations) {
      return;
    }

    console.debug("Agent Operation:", {
      agentId,
      operation,
      metadata: this.config.includeAgentMetadata ? metadata : "[hidden]",
      timestamp: new Date().toISOString(),
    });
  }

  recordAgentMetric(agentId: string, metricName: string, value: number): void {
    if (!this.config.enabled) {
      return;
    }

    console.debug("Agent Metric:", {
      agentId,
      metric: metricName,
      value,
      timestamp: new Date().toISOString(),
    });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

export const agentInstrumentation = new AgentInstrumentation();

export function initializeAgentInstrumentation(
  config?: Partial<AgentInstrumentationConfig>
): void {
  agentInstrumentation.initialize(config);
}

export function instrumentAgentMethod(
  _target: any,
  propertyKey: string,
  descriptor?: PropertyDescriptor
): PropertyDescriptor | undefined {
  if (!agentInstrumentation.isEnabled()) {
    return descriptor;
  }

  if (!descriptor || typeof descriptor.value !== "function") {
    return descriptor;
  }

  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    try {
      const result = originalMethod.apply(this, args);
      agentInstrumentation.traceAgentOperation(
        this.id || "unknown",
        propertyKey,
        { args: args.length }
      );
      return result;
    } catch (error) {
      console.error("Agent method error:", error);
      throw error;
    }
  };

  return descriptor;
}
