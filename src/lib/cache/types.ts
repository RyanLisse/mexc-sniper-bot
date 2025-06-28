/**
 * Cache Types and Interfaces
 *
 * Comprehensive type definitions for the multi-level cache system
 */

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: {
    type?: CacheDataType;
    source?: string;
    size?: number;
    dependencies?: string[];
  };
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  enableMetrics: boolean;
  enablePersistence?: boolean;
  persistenceFile?: string;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalSize: number;
  memoryUsage: number;
  hitRate: number;
  averageAccessTime: number;
  lastCleanup: number;
}

export interface CacheAnalytics {
  performance: CacheMetrics;
  topKeys: Array<{ key: string; hits: number; lastAccessed: number }>;
  typeBreakdown: Record<CacheDataType, { count: number; size: number; hitRate: number }>;
  recommendations: string[];
}

export type CacheDataType =
  | "agent_response"
  | "api_response"
  | "pattern_detection"
  | "query_result"
  | "session_data"
  | "user_preferences"
  | "workflow_result"
  | "performance_metrics"
  | "health_status"
  | "market_data"
  | "user_data"
  | "config"
  | "health_check"
  | "pattern_analysis"
  | "trading_signal"
  | "session"
  | "generic";

export type CacheInvalidationStrategy = "time_based" | "event_based" | "manual" | "smart";

export interface TTLConfig {
  [key: string]: number;
  agent_response: number;
  api_response: number;
  pattern_detection: number;
  query_result: number;
  session_data: number;
  user_preferences: number;
  workflow_result: number;
  performance_metrics: number;
  health_status: number;
}

export interface CacheSetOptions<T = unknown> {
  type?: CacheDataType;
  ttl?: number;
  level?: "L1" | "L2" | "L3" | "all";
  metadata?: CacheEntry<T>["metadata"];
}
