/**
 * Cache Monitoring Types and Interfaces
 *
 * Extracted from cache-monitoring.ts to reduce file size and improve modularity
 */

import type { APICacheAnalytics } from "../api-response-cache";
import type { CacheMetrics } from "../cache-manager";
import type { AgentCacheAnalytics } from "../enhanced-agent-cache";

export interface CacheMonitoringConfig {
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number;
  performanceThresholds: {
    minHitRate: number;
    maxMemoryUsage: number;
    maxResponseTime: number;
    maxCacheSize: number;
  };
  alerting: {
    enabled: boolean;
    channels: ("console" | "webhook" | "email")[];
    webhookUrl?: string;
    emailRecipients?: string[];
  };
  enableMetricsCollection: boolean;
  metricsRetentionDays: number;
}

export interface SystemCacheMetrics {
  timestamp: number;
  global: CacheMetrics;
  levels: {
    L1: CacheMetrics;
    L2: CacheMetrics;
    L3: CacheMetrics;
  };
  agents: AgentCacheAnalytics;
  apis: APICacheAnalytics;
  performance: {
    totalMemoryUsage: number;
    responseTimeP95: number;
    responseTimeP99: number;
    throughput: number;
    errorRate: number;
  };
  health: {
    status: "healthy" | "degraded" | "critical";
    issues: string[];
    warnings: string[];
  };
}

export interface CacheAlert {
  id: string;
  type: "performance" | "memory" | "error" | "threshold";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  timestamp: number;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
}

export interface CacheRecommendation {
  id: string;
  type: "configuration" | "optimization" | "scaling" | "cleanup";
  priority: "low" | "medium" | "high";
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: {
    hitRate?: number;
    memoryUsage?: number;
    responseTime?: number;
  };
  timestamp: number;
}

export interface PerformanceReport {
  period: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    averageResponseTime: number;
    memoryUsage: number;
    errorRate: number;
  };
  trends: {
    hitRateTrend: "improving" | "stable" | "declining";
    memoryTrend: "improving" | "stable" | "increasing";
    responseTrend: "improving" | "stable" | "degrading";
  };
  breakdown: {
    agents: Record<string, { hitRate: number; usage: number }>;
    apis: Record<string, { hitRate: number; usage: number }>;
    levels: Record<string, { hitRate: number; usage: number }>;
  };
  alerts: CacheAlert[];
  recommendations: CacheRecommendation[];
}
