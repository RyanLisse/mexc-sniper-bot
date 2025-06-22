/**
 * OpenTelemetry AI Agent Instrumentation
 *
 * Provides comprehensive monitoring for multi-agent coordination including
 * task orchestration, agent health, and performance tracking.
 */

import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("mexc-sniper-agents", "1.0.0");

export interface AgentSpanOptions {
  agentId?: string;
  agentType?: string;
  taskId?: string;
  operationType?: "coordination" | "execution" | "monitoring" | "analysis" | "communication";
  includeTaskData?: boolean;
  sensitiveFields?: string[];
}

/**
 * Instrument agent task execution
 */
export async function instrumentAgentTask<T>(
  taskName: string,
  operation: () => Promise<T>,
  options: AgentSpanOptions
): Promise<T> {
  const spanName = `agent.${options.agentType || "unknown"}.${taskName}`;

  return tracer.startActiveSpan(
    spanName,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        "agent.id": options.agentId || "unknown",
        "agent.type": options.agentType || "unknown",
        "agent.task.name": taskName,
        "agent.task.id": options.taskId || "",
        "operation.type": options.operationType || "execution",
        "service.name": "mexc-sniper-agents",
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const result = await operation();

        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.task.duration_ms": duration,
          "agent.task.success": true,
          "operation.success": true,
        });

        // Add result metadata
        if (result && typeof result === "object") {
          if ("success" in result) {
            span.setAttributes({
              "agent.task.result_success": Boolean(result.success),
            });
          }
          if ("data" in result && Array.isArray((result as any).data)) {
            span.setAttributes({
              "agent.task.result_count": (result as any).data.length,
            });
          }
        }

        // Performance warnings for long-running tasks
        if (duration > 5000) {
          span.setAttributes({
            "agent.performance.slow_task": true,
            "agent.performance.threshold_exceeded": true,
          });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.task.duration_ms": duration,
          "agent.task.success": false,
          "operation.success": false,
          "error.name": error instanceof Error ? error.name : "AgentTaskError",
          "error.message": error instanceof Error ? error.message : String(error),
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Instrument agent coordination operations
 */
export async function instrumentAgentCoordination<T>(
  coordinationType: "spawn" | "terminate" | "orchestrate" | "synchronize",
  operation: () => Promise<T>,
  options: AgentSpanOptions & { agentCount?: number }
): Promise<T> {
  return tracer.startActiveSpan(
    `agent.coordination.${coordinationType}`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        "agent.coordination.type": coordinationType,
        "agent.coordination.count": options.agentCount || 0,
        "operation.type": "coordination",
        "service.name": "agent-coordination",
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const result = await operation();

        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.coordination.duration_ms": duration,
          "agent.coordination.success": true,
          "operation.success": true,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.coordination.duration_ms": duration,
          "agent.coordination.success": false,
          "operation.success": false,
          "error.name": error instanceof Error ? error.name : "CoordinationError",
          "error.message": error instanceof Error ? error.message : String(error),
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Instrument pattern detection agent operations
 */
export async function instrumentPatternDetectionAgent<T>(
  operationType: "analyze" | "detect" | "validate" | "correlate",
  operation: () => Promise<T>,
  _metadata?: { symbolCount?: number; patternType?: string; confidence?: number }
): Promise<T> {
  return instrumentAgentTask(`pattern_${operationType}`, operation, {
    agentType: "pattern-detection",
    operationType: "analysis",
    taskId: `pattern_${operationType}_${Date.now()}`,
  });
}

/**
 * Instrument trading execution agent operations
 */
export async function instrumentTradingAgent<T>(
  operationType: "execute" | "monitor" | "close" | "risk_check",
  operation: () => Promise<T>,
  _tradeData?: { symbol?: string; side?: string; quantity?: string }
): Promise<T> {
  return instrumentAgentTask(`trading_${operationType}`, operation, {
    agentType: "trading-execution",
    operationType: "execution",
    taskId: `trade_${operationType}_${Date.now()}`,
  });
}

/**
 * Instrument agent health monitoring
 */
export async function instrumentAgentHealth<T>(
  agentId: string,
  agentType: string,
  healthCheck: () => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(
    "agent.health.check",
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        "agent.id": agentId,
        "agent.type": agentType,
        "operation.type": "monitoring",
        "service.name": "agent-health",
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const health = await healthCheck();

        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.health.check_duration_ms": duration,
          "agent.health.status": "healthy",
          "operation.success": true,
        });

        // Add specific health metrics if available
        if (health && typeof health === "object") {
          if ("status" in health) {
            span.setAttributes({
              "agent.health.detailed_status": String((health as any).status),
            });
          }
          if ("responseTime" in health) {
            span.setAttributes({
              "agent.health.response_time_ms": Number((health as any).responseTime),
            });
          }
          if ("errorCount" in health) {
            span.setAttributes({
              "agent.health.error_count": Number((health as any).errorCount),
            });
          }
          if ("uptime" in health) {
            span.setAttributes({
              "agent.health.uptime_percent": Number((health as any).uptime),
            });
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return health;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.health.check_duration_ms": duration,
          "agent.health.status": "unhealthy",
          "operation.success": false,
          "error.name": error instanceof Error ? error.name : "HealthCheckError",
          "error.message": error instanceof Error ? error.message : String(error),
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Instrument agent communication
 */
export async function instrumentAgentCommunication<T>(
  fromAgent: string,
  toAgent: string,
  messageType: string,
  operation: () => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(
    "agent.communication.message",
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        "agent.communication.from": fromAgent,
        "agent.communication.to": toAgent,
        "agent.communication.message_type": messageType,
        "operation.type": "communication",
        "service.name": "agent-communication",
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const result = await operation();

        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.communication.duration_ms": duration,
          "agent.communication.success": true,
          "operation.success": true,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.communication.duration_ms": duration,
          "agent.communication.success": false,
          "operation.success": false,
          "error.name": error instanceof Error ? error.name : "CommunicationError",
          "error.message": error instanceof Error ? error.message : String(error),
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Decorator for instrumenting agent methods
 */
export function instrumentAgentMethod(options: AgentSpanOptions & { methodName?: string }) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return instrumentAgentTask(
        options.methodName || propertyKey,
        () => originalMethod.apply(this, args),
        {
          ...options,
          agentId: (this as any).id || (this as any).agentId || "unknown",
          agentType:
            (this as any).type || (this as any).agentType || options.agentType || "unknown",
        }
      );
    };

    return descriptor;
  };
}

/**
 * Instrument agent registry operations
 */
export async function instrumentAgentRegistry<T>(
  operationType: "register" | "unregister" | "lookup" | "health_check" | "update",
  operation: () => Promise<T>,
  agentInfo?: { agentId?: string; agentType?: string; agentCount?: number }
): Promise<T> {
  return tracer.startActiveSpan(
    `agent.registry.${operationType}`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        "agent.registry.operation": operationType,
        "agent.id": agentInfo?.agentId || "unknown",
        "agent.type": agentInfo?.agentType || "unknown",
        "agent.registry.count": agentInfo?.agentCount || 0,
        "operation.type": "coordination",
        "service.name": "agent-registry",
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const result = await operation();

        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.registry.duration_ms": duration,
          "agent.registry.success": true,
          "operation.success": true,
        });

        // Add registry-specific metadata
        if (result && typeof result === "object") {
          if (Array.isArray(result)) {
            span.setAttributes({
              "agent.registry.result_count": result.length,
            });
          } else if ("agents" in result && Array.isArray((result as any).agents)) {
            span.setAttributes({
              "agent.registry.active_agents": (result as any).agents.length,
            });
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          "agent.registry.duration_ms": duration,
          "agent.registry.success": false,
          "operation.success": false,
          "error.name": error instanceof Error ? error.name : "RegistryError",
          "error.message": error instanceof Error ? error.message : String(error),
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}
