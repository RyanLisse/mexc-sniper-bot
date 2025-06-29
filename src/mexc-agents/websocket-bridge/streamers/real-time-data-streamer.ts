/**
 * Real-time Data Streamer
 * 
 * Handles real-time streaming of agent status and workflow updates
 */

import { EventEmitter } from "node:events";
import type {
  AgentStatusMessage,
  AgentWorkflowMessage,
} from "@/src/lib/websocket-types";
import { webSocketServer } from "@/src/services/data/websocket-server";
import type { AgentStatusTracker, WorkflowTracker } from "../types";

export class RealTimeDataStreamer extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[real-time-data-streamer]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[real-time-data-streamer]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[real-time-data-streamer]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[real-time-data-streamer]", message, context || ""),
  };

  private updateInterval?: NodeJS.Timeout;
  private agentTrackers = new Map<string, AgentStatusTracker>();
  private workflowTrackers = new Map<string, WorkflowTracker>();
  private isStreaming = false;

  constructor(private updateIntervalMs = 5000) {
    super();
  }

  start(): void {
    if (this.isStreaming) return;

    this.isStreaming = true;
    this.updateInterval = setInterval(() => {
      this.broadcastAgentStatuses();
      this.broadcastWorkflowStatuses();
    }, this.updateIntervalMs);

    this.logger.info("Real-time streaming started");
  }

  stop(): void {
    if (!this.isStreaming) return;

    this.isStreaming = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.logger.info("Real-time streaming stopped");
  }

  updateAgentStatus(agentId: string, agentType: string, metrics: any): void {
    const tracker: AgentStatusTracker = {
      agentId,
      agentType,
      lastUpdate: Date.now(),
      status: this.calculateAgentStatus(metrics),
      metrics: {
        responseTime: metrics.averageResponseTime || 0,
        errorCount: metrics.errorCount || 0,
        successRate: metrics.successRate || 1,
        cacheHitRate: metrics.cacheHitRate || 0,
        workflowsActive: metrics.workflowsActive || 0,
      },
      metadata: {
        version: metrics.version || "1.0.0",
        memory: metrics.memory || 0,
        cpu: metrics.cpu || 0,
        uptime: metrics.uptime || 0,
      },
    };

    this.agentTrackers.set(agentId, tracker);
    this.broadcastAgentStatus(tracker);
  }

  updateWorkflowStatus(
    workflowId: string,
    workflowType: string,
    status: WorkflowTracker["status"],
    progress: number,
    agentsInvolved: string[],
    currentAgent?: string,
    metadata: Record<string, any> = {}
  ): void {
    const existing = this.workflowTrackers.get(workflowId);

    const tracker: WorkflowTracker = {
      workflowId,
      workflowType,
      status,
      progress,
      agentsInvolved,
      currentAgent,
      startTime: existing?.startTime || Date.now(),
      lastUpdate: Date.now(),
      metadata: { ...existing?.metadata, ...metadata },
    };

    this.workflowTrackers.set(workflowId, tracker);
    this.broadcastWorkflowStatus(tracker);

    // Clean up completed workflows after 5 minutes
    if (status === "completed" || status === "failed" || status === "cancelled") {
      setTimeout(
        () => {
          this.workflowTrackers.delete(workflowId);
        },
        5 * 60 * 1000
      );
    }
  }

  private calculateAgentStatus(metrics: any): AgentStatusTracker["status"] {
    const errorRate = metrics.errorRate || 0;
    const responseTime = metrics.averageResponseTime || 0;
    const successRate = metrics.successRate || 1;

    if (errorRate > 0.2 || responseTime > 5000 || successRate < 0.8) {
      return "unhealthy";
    }
    if (errorRate > 0.1 || responseTime > 3000 || successRate < 0.9) {
      return "degraded";
    }
    return "healthy";
  }

  private broadcastAgentStatuses(): void {
    for (const tracker of this.agentTrackers.values()) {
      this.broadcastAgentStatus(tracker);
    }
  }

  private broadcastWorkflowStatuses(): void {
    for (const tracker of this.workflowTrackers.values()) {
      this.broadcastWorkflowStatus(tracker);
    }
  }

  private broadcastAgentStatus(tracker: AgentStatusTracker): void {
    const message: AgentStatusMessage = {
      agentId: tracker.agentId,
      agentType: tracker.agentType,
      status: tracker.status,
      lastActivity: tracker.lastUpdate,
      responseTime: tracker.metrics.responseTime,
      errorCount: tracker.metrics.errorCount,
      cacheHitRate: tracker.metrics.cacheHitRate,
      workflowsActive: tracker.metrics.workflowsActive,
      metadata: tracker.metadata,
    };

    webSocketServer.broadcastAgentStatus(message);
  }

  private broadcastWorkflowStatus(tracker: WorkflowTracker): void {
    const message: AgentWorkflowMessage = {
      workflowId: tracker.workflowId,
      workflowType: tracker.workflowType as any,
      status: tracker.status,
      progress: tracker.progress,
      agentsInvolved: tracker.agentsInvolved,
      currentAgent: tracker.currentAgent,
      metadata: {
        startTime: tracker.startTime,
        duration: tracker.lastUpdate - tracker.startTime,
        ...tracker.metadata,
      },
    };

    webSocketServer.broadcast({
      type: "agent:workflow",
      channel: "agents:workflows",
      data: message,
    });
  }

  // Getters for status
  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  getAgentTrackers(): Map<string, AgentStatusTracker> {
    return new Map(this.agentTrackers);
  }

  getWorkflowTrackers(): Map<string, WorkflowTracker> {
    return new Map(this.workflowTrackers);
  }
}