/**
 * Agent Cache Types and Interfaces
 * 
 * Centralized type definitions for the enhanced agent caching system.
 * Extracted from enhanced-agent-cache.ts for better modularity.
 */

import type { AgentResponse } from "../../mexc-agents/base-agent";

// =======================
// Agent Cache Types
// =======================

export interface AgentCacheConfig {
  defaultTTL: number;
  maxRetries: number;
  enablePerformanceTracking: boolean;
  enableWorkflowCaching: boolean;
  enableHealthCaching: boolean;
  cacheWarmupEnabled: boolean;
}

export interface AgentCacheMetrics {
  agentId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgResponseTime: number;
  errorRate: number;
  lastActivity: number;
  cacheHits: number;
  cacheSets: number;
  throughput: number;
}

export interface CachedAgentResponse extends AgentResponse {
  cacheMetadata: {
    cacheKey: string;
    cacheLevel: "L1" | "L2" | "L3";
    cacheTimestamp: number;
    originalTimestamp: number;
    hitCount: number;
    performanceScore?: number;
  };
}

export interface WorkflowCacheEntry {
  workflowId: string;
  agentSequence: string[];
  results: Map<string, AgentResponse>;
  finalResult: any;
  executionTime: number;
  timestamp: number;
  dependencies: string[];
  metadata: {
    success: boolean;
    errorCount: number;
    handoffCount: number;
    confidence: number;
  };
}

export interface AgentHealthCache {
  agentId: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: number;
  responseTime: number;
  errorRate: number;
  cacheHitRate: number;
  metadata: {
    uptime: number;
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
  };
}

export interface AgentCacheAnalytics {
  agentPerformance: Record<
    string,
    {
      hitRate: number;
      averageResponseTime: number;
      errorRate: number;
      cacheEfficiency: number;
      totalRequests: number;
    }
  >;
  workflowEfficiency: {
    totalWorkflows: number;
    cachedWorkflows: number;
    cacheHitRate: number;
    averageExecutionTime: number;
    timesSaved: number;
  };
  healthMonitoring: {
    healthyAgents: number;
    degradedAgents: number;
    unhealthyAgents: number;
    averageResponseTime: number;
    systemLoad: number;
  };
  recommendations: string[];
  cacheUtilization?: {
    totalKeys: number;
    totalSize: number;
    memoryUsage: number;
    hitRate: number;
    evictionRate: number;
  };
}

export interface CacheInvalidationCriteria {
  agentId?: string;
  agentType?: string;
  olderThan?: number;
  pattern?: string | RegExp;
  tags?: string[];
  maxAge?: number;
  dependencies?: string[];
}

export interface WorkflowInvalidationCriteria {
  workflowType?: string;
  workflowId?: string;
  agentId?: string;
  olderThan?: number;
  containsAgent?: string;
  maxAge?: number;
  dependencies?: string[];
}

export interface CacheWarmupConfig {
  agentId: string;
  patterns: string[];
  priority: "low" | "medium" | "high";
  batchSize?: number;
  maxConcurrency?: number;
  preloadData?: any[];
}

export interface CacheKeyOptions {
  agentId: string;
  input?: string;
  context?: any;
  tags?: string[];
  priority?: "low" | "medium" | "high";
  namespace?: string;
}

export interface CacheLevel {
  level: "L1" | "L2" | "L3";
  ttl: number;
  storage: "memory" | "disk" | "distributed";
  maxSize: number;
  evictionPolicy: "LRU" | "LFU" | "TTL";
}

export interface CachePerformanceMetrics {
  hitRate: number;
  missRate: number;
  responseTime: number;
  throughput: number;
  memoryUsage: number;
  errorRate: number;
  evictionCount: number;
  warmupHits: number;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccess: number;
  tags: string[];
  level: "L1" | "L2" | "L3";
  size: number;
  metadata?: {
    agentId?: string;
    workflowId?: string;
    priority?: "low" | "medium" | "high";
    dependencies?: string[];
    version?: number;
  };
}

export interface CacheStats {
  totalKeys: number;
  totalMemory: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  errorCount: number;
  uptime: number;
  lastReset: number;
  performanceMetrics: CachePerformanceMetrics;
}

export interface CacheEventData {
  type: "hit" | "miss" | "set" | "delete" | "evict" | "warmup";
  key: string;
  agentId?: string;
  workflowId?: string;
  timestamp: number;
  value?: any;
  ttl?: number;
  metadata?: any;
}

export type CacheEventHandler = (event: CacheEventData) => void | Promise<void>;

export interface CacheMiddleware {
  name: string;
  onGet?: (key: string, value: any) => any | Promise<any>;
  onSet?: (key: string, value: any, ttl: number) => any | Promise<any>;
  onDelete?: (key: string) => void | Promise<void>;
  onEvict?: (key: string, value: any) => void | Promise<void>;
}

export interface CacheStrategy {
  name: string;
  shouldCache: (agentId: string, input: any, response: AgentResponse) => boolean;
  calculateTTL: (agentId: string, input: any, response: AgentResponse) => number;
  generateKey: (agentId: string, input: any, context?: any) => string;
  shouldInvalidate: (criteria: CacheInvalidationCriteria) => boolean;
}