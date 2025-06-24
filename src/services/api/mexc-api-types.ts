/**
 * MEXC API Types and Interfaces
 *
 * Centralized type definitions for the MEXC API client system.
 * Extracted from mexc-api-client.ts for better modularity and reusability.
 */

// ============================================================================
// API Client Types and Interfaces
// ============================================================================

// Define possible parameter value types for API requests
export type ApiParamValue = string | number | boolean | null | undefined;
export type ApiParams = Record<string, ApiParamValue | ApiParamValue[]>;

export interface ApiRequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  params?: ApiParams;
  requiresAuth?: boolean;
  timeout?: number;
  retries?: number;
  cacheTTL?: number;
}

export interface ApiClientStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  retryCount: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  jitterFactor: number; // Add jitter to prevent thundering herd
  adaptiveRetry: boolean; // Enable adaptive retry based on success rate
}

export interface TimeoutConfig {
  defaultTimeout: number;
  connectTimeout: number;
  readTimeout: number;
  adaptiveTimeout: boolean;
  endpointTimeouts: Record<string, number>; // Per-endpoint timeouts
}

export interface RequestContext {
  requestId: string;
  correlationId?: string;
  priority: "low" | "medium" | "high" | "critical";
  endpoint: string;
  attempt: number;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface ErrorClassification {
  isRetryable: boolean;
  category: "network" | "authentication" | "rate_limit" | "server" | "client" | "timeout";
  severity: "low" | "medium" | "high" | "critical";
  suggestedDelay?: number;
  suggestedBackoff?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: ApiRequestConfig;
  request?: any;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetTime: number;
  retryAfter?: number;
}

export interface PerformanceMetrics {
  responseTime: number;
  requestSize: number;
  responseSize: number;
  cacheHit: boolean;
  retryCount: number;
  endpoint: string;
  method: string;
  timestamp: number;
}

export interface AuthenticationContext {
  apiKey: string;
  apiSecret: string;
  timestamp: number;
  signature: string;
  nonce?: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccess: number;
  metadata?: Record<string, any>;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  cacheTTL?: number;
  priority?: "low" | "medium" | "high" | "critical";
  correlationId?: string;
  metadata?: Record<string, any>;
}
