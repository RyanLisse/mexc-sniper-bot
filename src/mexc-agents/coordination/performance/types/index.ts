/**
 * Performance Collection System Types
 */

export interface AgentPerformanceMetrics {
  agentId: string;
  timestamp: Date;
  responseTime: number;
  successRate: number;
  errorRate: number;
  throughput: number; // requests per minute
  memoryUsage: number; // in MB
  cpuUsage: number; // percentage
  cacheHitRate: number;
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  uptime: number; // percentage
  lastError?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowPerformanceMetrics {
  workflowId: string;
  executionId: string;
  timestamp: Date;
  duration: number;
  status: "completed" | "failed" | "timeout" | "cancelled";
  stepsExecuted: number;
  stepsSkipped: number;
  stepsFailed: number;
  agentsUsed: string[];
  retriesPerformed: number;
  fallbacksUsed: number;
  totalResponseTime: number;
  averageStepTime: number;
  bottleneckStep?: string;
  bottleneckDuration?: number;
  resourceUsage: {
    peakMemory: number;
    averageMemory: number;
    peakCpu: number;
    averageCpu: number;
  };
  metadata?: Record<string, unknown>;
}

export interface SystemPerformanceSnapshot {
  timestamp: Date;
  totalAgents: number;
  healthyAgents: number;
  degradedAgents: number;
  unhealthyAgents: number;
  totalWorkflows: number;
  runningWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  systemMemoryUsage: number;
  systemCpuUsage: number;
  databaseConnections: number;
  averageResponseTime: number;
  throughput: number; // total requests per minute
  errorRate: number;
  uptime: number; // system uptime in milliseconds
  metadata?: Record<string, unknown>;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  agents: {
    total: number;
    metrics: AgentPerformanceMetrics[];
    topPerformers: { agentId: string; score: number }[];
    bottlenecks: { agentId: string; avgResponseTime: number }[];
  };
  workflows: {
    total: number;
    metrics: WorkflowPerformanceMetrics[];
    averageDuration: number;
    successRate: number;
    mostUsedAgents: { agentId: string; usageCount: number }[];
  };
  system: {
    snapshots: SystemPerformanceSnapshot[];
    trends: {
      responseTime: {
        trend: "improving" | "degrading" | "stable";
        change: number;
      };
      throughput: {
        trend: "improving" | "degrading" | "stable";
        change: number;
      };
      errorRate: {
        trend: "improving" | "degrading" | "stable";
        change: number;
      };
    };
  };
  recommendations: string[];
}

export interface PerformanceCollectorOptions {
  collectionInterval?: number;
  maxHistorySize?: number;
}

export interface MetricsStorage {
  agentMetricsHistory: Map<string, AgentPerformanceMetrics[]>;
  workflowMetricsHistory: WorkflowPerformanceMetrics[];
  systemSnapshotHistory: SystemPerformanceSnapshot[];
}
