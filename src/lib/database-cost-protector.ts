/**
 * Database Cost Protection System
 * 
 * Comprehensive protection against runaway database costs with monitoring,
 * alerting, emergency shutdown mechanisms, and query optimization.
 */

import type { NextRequest, NextResponse } from "next/server";

export interface DatabaseCostMetrics {
  queryCount: number;
  connectionCount: number;
  dataTransfer: number;
  duration: number;
  endpoint: string;
  timestamp: string;
  estimatedCost: number;
  operationType: 'read' | 'write' | 'aggregate' | 'transaction';
}

export interface CostThresholds {
  queries: {
    perMinute: number;
    perHour: number;
    perDay: number;
  };
  connections: {
    concurrent: number;
    perHour: number;
  };
  cost: {
    perHour: number;
    perDay: number;
    perMonth: number;
  };
  duration: {
    singleQuery: number;
    totalPerEndpoint: number;
  };
  dataTransfer: {
    perQuery: number;
    perEndpoint: number;
    perDay: number;
  };
}

export interface EmergencyShutdownConfig {
  enabled: boolean;
  triggers: {
    costPerHour: number;
    queriesPerMinute: number;
    connectionsPerMinute: number;
    dataTransferPerHour: number; // bytes
  };
  disabledEndpoints: string[];
  emergencyMode: boolean;
}

export interface QueryCacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxSize: number;
  compressionEnabled: boolean;
}

export interface QueryBatchingConfig {
  enabled: boolean;
  maxBatchSize: number;
  maxWaitTimeMs: number;
  enableDeduplication: boolean;
}

class DatabaseCostProtector {
  private static instance: DatabaseCostProtector;
  
  // Cost tracking
  private queryMetrics = new Map<string, DatabaseCostMetrics[]>();
  private connectionPool = new Map<string, number>();
  private globalMetrics = {
    queriesLastMinute: 0,
    queriesLastHour: 0,
    queriesLastDay: 0,
    totalCost: 0,
    startTime: Date.now(),
  };
  
  // Cache system
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private pendingQueries = new Map<string, Promise<any>>();
  
  // Batching system
  private batchQueue = new Map<string, {
    queries: Array<{ sql: string; params: any[]; resolve: Function; reject: Function }>;
    timer: NodeJS.Timeout;
  }>();
  
  // Configuration
  private readonly thresholds: CostThresholds = {
    queries: {
      perMinute: parseInt(process.env.DB_QUERIES_PER_MINUTE_LIMIT || '100'),
      perHour: parseInt(process.env.DB_QUERIES_PER_HOUR_LIMIT || '5000'),
      perDay: parseInt(process.env.DB_QUERIES_PER_DAY_LIMIT || '50000'),
    },
    connections: {
      concurrent: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      perHour: parseInt(process.env.DB_CONNECTIONS_PER_HOUR_LIMIT || '1000'),
    },
    cost: {
      perHour: parseFloat(process.env.DB_COST_PER_HOUR_LIMIT || '1.0'),
      perDay: parseFloat(process.env.DB_COST_PER_DAY_LIMIT || '10.0'),
      perMonth: parseFloat(process.env.DB_COST_PER_MONTH_LIMIT || '100.0'),
    },
    duration: {
      singleQuery: parseInt(process.env.DB_SINGLE_QUERY_TIMEOUT || '30000'),
      totalPerEndpoint: parseInt(process.env.DB_ENDPOINT_TOTAL_TIMEOUT || '60000'),
    },
    dataTransfer: {
      perQuery: parseInt(process.env.DB_MAX_QUERY_DATA_TRANSFER || '1048576'), // 1MB
      perEndpoint: parseInt(process.env.DB_MAX_ENDPOINT_DATA_TRANSFER || '10485760'), // 10MB
      perDay: parseInt(process.env.DB_MAX_DAILY_DATA_TRANSFER || '1073741824'), // 1GB
    },
  };
  
  private emergencyConfig: EmergencyShutdownConfig = {
    enabled: process.env.DB_EMERGENCY_SHUTDOWN_ENABLED !== 'false',
    triggers: {
      costPerHour: parseFloat(process.env.DB_EMERGENCY_COST_TRIGGER || '5.0'),
      queriesPerMinute: parseInt(process.env.DB_EMERGENCY_QUERIES_TRIGGER || '1000'),
      connectionsPerMinute: parseInt(process.env.DB_EMERGENCY_CONNECTIONS_TRIGGER || '100'),
      dataTransferPerHour: parseInt(process.env.DB_EMERGENCY_DATA_TRIGGER || '536870912'), // 512MB
    },
    disabledEndpoints: [],
    emergencyMode: false,
  };
  
  private cacheConfig: QueryCacheConfig = {
    enabled: process.env.DB_CACHE_ENABLED !== 'false',
    ttlSeconds: parseInt(process.env.DB_CACHE_TTL_SECONDS || '300'),
    maxSize: parseInt(process.env.DB_CACHE_MAX_SIZE || '1000'),
    compressionEnabled: process.env.DB_CACHE_COMPRESSION_ENABLED !== 'false',
  };
  
  private batchingConfig: QueryBatchingConfig = {
    enabled: process.env.DB_BATCHING_ENABLED !== 'false',
    maxBatchSize: parseInt(process.env.DB_MAX_BATCH_SIZE || '10'),
    maxWaitTimeMs: parseInt(process.env.DB_BATCH_WAIT_TIME_MS || '100'),
    enableDeduplication: process.env.DB_BATCH_DEDUPLICATION_ENABLED !== 'false',
  };
  
  static getInstance(): DatabaseCostProtector {
    if (!DatabaseCostProtector.instance) {
      DatabaseCostProtector.instance = new DatabaseCostProtector();
    }
    return DatabaseCostProtector.instance;
  }
  
  private constructor() {
    this.startBackgroundMonitoring();
    this.setupPeriodicCleanup();
  }
  
  private startBackgroundMonitoring(): void {
    // Monitor costs every 30 seconds
    setInterval(() => {
      this.checkCostThresholds();
    }, 30000);
    
    // Update minute/hour counters
    setInterval(() => {
      this.updateRollingCounters();
    }, 60000); // Every minute
    
    // Emergency monitoring - more frequent
    setInterval(() => {
      this.checkEmergencyTriggers();
    }, 10000); // Every 10 seconds
  }
  
  private setupPeriodicCleanup(): void {
    // Cleanup old metrics
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000); // Every 5 minutes
    
    // Cleanup cache
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 60000); // Every minute
  }
  
  /**
   * Main middleware wrapper for database cost protection
   */
  async withCostProtection<T>(
    operation: () => Promise<T>,
    context: {
      endpoint: string;
      operationType: DatabaseCostMetrics['operationType'];
      estimatedQueries?: number;
      estimatedDataSize?: number;
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    // Pre-flight checks
    await this.preFlightCheck(context);
    
    // Track connection
    this.trackConnection(context.endpoint);
    
    let queryCount = 0;
    let dataTransfer = 0;
    
    try {
      // Execute operation with monitoring
      const result = await this.executeWithMonitoring(operation, context);
      
      // Extract metrics from result if available
      if (typeof result === 'object' && result !== null) {
        queryCount = (result as any).queryCount || context.estimatedQueries || 1;
        dataTransfer = (result as any).dataSize || context.estimatedDataSize || 
                      JSON.stringify(result).length;
      }
      
      const duration = Date.now() - startTime;
      
      // Record successful operation
      await this.recordMetrics({
        queryCount,
        connectionCount: 1,
        dataTransfer,
        duration,
        endpoint: context.endpoint,
        timestamp: new Date().toISOString(),
        estimatedCost: this.calculateCost(queryCount, duration, dataTransfer),
        operationType: context.operationType,
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed operation
      await this.recordMetrics({
        queryCount: queryCount || 0,
        connectionCount: 1,
        dataTransfer: 0,
        duration,
        endpoint: `${context.endpoint}[ERROR]`,
        timestamp: new Date().toISOString(),
        estimatedCost: this.calculateCost(queryCount || 0, duration, 0),
        operationType: context.operationType,
      });
      
      throw error;
    } finally {
      this.releaseConnection(context.endpoint);
    }
  }
  
  private async preFlightCheck(context: {
    endpoint: string;
    operationType: string;
    estimatedQueries?: number;
  }): Promise<void> {
    // Check if endpoint is disabled
    if (this.emergencyConfig.disabledEndpoints.includes(context.endpoint)) {
      throw new Error(`Endpoint ${context.endpoint} is temporarily disabled due to cost protection`);
    }
    
    // Check if in emergency mode
    if (this.emergencyConfig.emergencyMode) {
      // Only allow essential read operations in emergency mode
      if (context.operationType !== 'read' || context.endpoint.includes('health')) {
        throw new Error('System in emergency mode - only essential read operations allowed');
      }
    }
    
    // Check rate limits
    const currentMinuteQueries = this.getQueriesInTimeWindow(60000); // 1 minute
    if (currentMinuteQueries >= this.thresholds.queries.perMinute) {
      throw new Error(`Query rate limit exceeded: ${currentMinuteQueries}/${this.thresholds.queries.perMinute} per minute`);
    }
    
    // Check connection limits
    const currentConnections = this.getCurrentConnections();
    if (currentConnections >= this.thresholds.connections.concurrent) {
      throw new Error(`Connection limit exceeded: ${currentConnections}/${this.thresholds.connections.concurrent} concurrent connections`);
    }
  }
  
  private async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    context: { endpoint: string; operationType: string }
  ): Promise<T> {
    // Add timeout protection
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Database operation timeout after ${this.thresholds.duration.singleQuery}ms`));
      }, this.thresholds.duration.singleQuery);
    });
    
    return Promise.race([operation(), timeoutPromise]);
  }
  
  private trackConnection(endpoint: string): void {
    const current = this.connectionPool.get(endpoint) || 0;
    this.connectionPool.set(endpoint, current + 1);
  }
  
  private releaseConnection(endpoint: string): void {
    const current = this.connectionPool.get(endpoint) || 0;
    if (current > 0) {
      this.connectionPool.set(endpoint, current - 1);
    }
  }
  
  private getCurrentConnections(): number {
    return Array.from(this.connectionPool.values()).reduce((sum, count) => sum + count, 0);
  }
  
  private async recordMetrics(metrics: DatabaseCostMetrics): Promise<void> {
    // Store metrics by endpoint
    if (!this.queryMetrics.has(metrics.endpoint)) {
      this.queryMetrics.set(metrics.endpoint, []);
    }
    
    const endpointMetrics = this.queryMetrics.get(metrics.endpoint)!;
    endpointMetrics.push(metrics);
    
    // Keep only last 1000 entries per endpoint
    if (endpointMetrics.length > 1000) {
      endpointMetrics.shift();
    }
    
    // Update global counters
    this.globalMetrics.queriesLastMinute += metrics.queryCount;
    this.globalMetrics.queriesLastHour += metrics.queryCount;
    this.globalMetrics.queriesLastDay += metrics.queryCount;
    this.globalMetrics.totalCost += metrics.estimatedCost;
    
    console.debug('🗄️ [DB COST PROTECTOR] Recorded metrics', {
      endpoint: metrics.endpoint,
      queryCount: metrics.queryCount,
      duration: metrics.duration,
      estimatedCost: metrics.estimatedCost,
      totalCost: this.globalMetrics.totalCost,
    });
  }
  
  private calculateCost(queryCount: number, duration: number, dataTransfer: number): number {
    // Neon pricing model (approximate)
    const queryCost = queryCount * 0.001; // $0.001 per query
    const computeCost = (duration / 1000) * 0.01; // $0.01 per compute second
    const storageCost = (dataTransfer / (1024 * 1024)) * 0.05; // $0.05 per MB
    
    return queryCost + computeCost + storageCost;
  }
  
  private updateRollingCounters(): void {
    const now = Date.now();
    const oneMinute = 60000;
    const oneHour = 3600000;
    const oneDay = 86400000;
    
    // Reset minute counter
    this.globalMetrics.queriesLastMinute = this.getQueriesInTimeWindow(oneMinute);
    
    // Reset hour counter
    this.globalMetrics.queriesLastHour = this.getQueriesInTimeWindow(oneHour);
    
    // Reset day counter
    this.globalMetrics.queriesLastDay = this.getQueriesInTimeWindow(oneDay);
  }
  
  private getQueriesInTimeWindow(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    let count = 0;
    
    for (const metrics of this.queryMetrics.values()) {
      for (const metric of metrics) {
        if (new Date(metric.timestamp).getTime() > cutoff) {
          count += metric.queryCount;
        }
      }
    }
    
    return count;
  }
  
  private async checkCostThresholds(): Promise<void> {
    const now = Date.now();
    const uptime = now - this.globalMetrics.startTime;
    const hourlyRate = (this.globalMetrics.totalCost / uptime) * 3600000; // Cost per hour
    
    // Check cost thresholds
    if (hourlyRate > this.thresholds.cost.perHour) {
      await this.sendCostAlert('HIGH', 'Cost rate exceeded', {
        currentRate: hourlyRate,
        threshold: this.thresholds.cost.perHour,
        type: 'hourly_cost',
      });
    }
    
    // Check query thresholds
    if (this.globalMetrics.queriesLastMinute > this.thresholds.queries.perMinute * 0.8) {
      await this.sendCostAlert('MEDIUM', 'Query rate approaching limit', {
        currentRate: this.globalMetrics.queriesLastMinute,
        threshold: this.thresholds.queries.perMinute,
        type: 'query_rate',
      });
    }
  }
  
  private async checkEmergencyTriggers(): Promise<void> {
    if (!this.emergencyConfig.enabled) return;
    
    const now = Date.now();
    const uptime = now - this.globalMetrics.startTime;
    const hourlyRate = (this.globalMetrics.totalCost / uptime) * 3600000;
    
    let triggerEmergency = false;
    const reasons: string[] = [];
    
    // Check emergency triggers
    if (hourlyRate > this.emergencyConfig.triggers.costPerHour) {
      triggerEmergency = true;
      reasons.push(`Cost rate: $${hourlyRate.toFixed(2)}/hour > $${this.emergencyConfig.triggers.costPerHour}/hour`);
    }
    
    if (this.globalMetrics.queriesLastMinute > this.emergencyConfig.triggers.queriesPerMinute) {
      triggerEmergency = true;
      reasons.push(`Query rate: ${this.globalMetrics.queriesLastMinute}/min > ${this.emergencyConfig.triggers.queriesPerMinute}/min`);
    }
    
    if (triggerEmergency && !this.emergencyConfig.emergencyMode) {
      await this.triggerEmergencyShutdown(reasons);
    }
  }
  
  private async triggerEmergencyShutdown(reasons: string[]): Promise<void> {
    console.error('🚨🚨🚨 [EMERGENCY SHUTDOWN] Database cost protection triggered', {
      reasons,
      currentMetrics: this.globalMetrics,
      timestamp: new Date().toISOString(),
    });
    
    this.emergencyConfig.emergencyMode = true;
    this.emergencyConfig.disabledEndpoints = [
      '/api/execution-history',
      '/api/transactions',
      '/api/pattern-detection',
      '/api/workflow-executions',
      // Keep essential endpoints active
    ];
    
    // Send external alerts
    await this.sendExternalAlert('EMERGENCY', 'Database emergency shutdown activated', reasons);
  }
  
  private async sendCostAlert(severity: 'LOW' | 'MEDIUM' | 'HIGH', message: string, data: any): Promise<void> {
    const emoji = { LOW: '💡', MEDIUM: '⚠️', HIGH: '🚨' }[severity];
    
    console.warn(`${emoji} [DB COST ALERT] ${message}`, {
      severity,
      data,
      currentMetrics: this.globalMetrics,
      timestamp: new Date().toISOString(),
    });
  }
  
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - 86400000; // 24 hours
    
    for (const [endpoint, metrics] of this.queryMetrics) {
      const filtered = metrics.filter(m => new Date(m.timestamp).getTime() > cutoff);
      this.queryMetrics.set(endpoint, filtered);
    }
  }
  
  private cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.queryCache) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.queryCache.delete(key);
      }
    }
    
    // Enforce max cache size
    if (this.queryCache.size > this.cacheConfig.maxSize) {
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, entries.length - this.cacheConfig.maxSize);
      
      for (const [key] of toDelete) {
        this.queryCache.delete(key);
      }
    }
  }
  
  /**
   * Query caching system for database operations
   */
  async withQueryCache<T>(
    key: string,
    operation: () => Promise<T>,
    ttlSeconds: number = this.cacheConfig.ttlSeconds
  ): Promise<T> {
    if (!this.cacheConfig.enabled) {
      return operation();
    }
    
    const cached = this.queryCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < cached.ttl * 1000) {
      console.debug('🎯 [DB CACHE HIT]', { key, age: Date.now() - cached.timestamp });
      return cached.data;
    }
    
    // Check for pending query to avoid duplicate operations
    if (this.pendingQueries.has(key)) {
      console.debug('⏳ [DB CACHE PENDING]', { key });
      return this.pendingQueries.get(key)!;
    }
    
    const promise = operation();
    this.pendingQueries.set(key, promise);
    
    try {
      const result = await promise;
      
      // Cache the result
      this.queryCache.set(key, {
        data: result,
        timestamp: Date.now(),
        ttl: ttlSeconds,
      });
      
      console.debug('💾 [DB CACHE STORE]', { key, ttl: ttlSeconds });
      return result;
      
    } finally {
      this.pendingQueries.delete(key);
    }
  }
  
  /**
   * Query batching system for multiple similar operations
   */
  async withQueryBatching<T>(
    batchKey: string,
    query: { sql: string; params: any[] },
    operation: (queries: Array<{ sql: string; params: any[] }>) => Promise<T[]>
  ): Promise<T> {
    if (!this.batchingConfig.enabled) {
      return operation([query]) as any;
    }
    
    return new Promise((resolve, reject) => {
      if (!this.batchQueue.has(batchKey)) {
        this.batchQueue.set(batchKey, {
          queries: [],
          timer: setTimeout(() => {
            this.executeBatch(batchKey, operation);
          }, this.batchingConfig.maxWaitTimeMs),
        });
      }
      
      const batch = this.batchQueue.get(batchKey)!;
      batch.queries.push({ ...query, resolve, reject });
      
      // Execute immediately if batch is full
      if (batch.queries.length >= this.batchingConfig.maxBatchSize) {
        clearTimeout(batch.timer);
        this.executeBatch(batchKey, operation);
      }
    });
  }
  
  private async executeBatch<T>(
    batchKey: string,
    operation: (queries: Array<{ sql: string; params: any[] }>) => Promise<T[]>
  ): Promise<void> {
    const batch = this.batchQueue.get(batchKey);
    if (!batch) return;
    
    this.batchQueue.delete(batchKey);
    
    try {
      const queries = batch.queries.map(q => ({ sql: q.sql, params: q.params }));
      
      // Deduplicate if enabled
      const dedupedQueries = this.batchingConfig.enableDeduplication
        ? this.deduplicateQueries(queries)
        : queries;
      
      console.debug('🔄 [DB BATCH EXECUTE]', {
        batchKey,
        originalCount: queries.length,
        dedupedCount: dedupedQueries.length,
      });
      
      const results = await operation(dedupedQueries);
      
      // Resolve all promises
      batch.queries.forEach((query, index) => {
        query.resolve(results[index]);
      });
      
    } catch (error) {
      // Reject all promises
      batch.queries.forEach(query => {
        query.reject(error);
      });
    }
  }
  
  private deduplicateQueries(queries: Array<{ sql: string; params: any[] }>): Array<{ sql: string; params: any[] }> {
    const seen = new Set<string>();
    return queries.filter(query => {
      const key = `${query.sql}:${JSON.stringify(query.params)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Get current system usage and statistics
   */
  getUsageStats() {
    const now = Date.now();
    const uptime = now - this.globalMetrics.startTime;
    const hourlyRate = (this.globalMetrics.totalCost / uptime) * 3600000;
    
    return {
      queries: {
        lastMinute: this.globalMetrics.queriesLastMinute,
        lastHour: this.globalMetrics.queriesLastHour,
        lastDay: this.globalMetrics.queriesLastDay,
        perMinuteLimit: this.thresholds.queries.perMinute,
        perHourLimit: this.thresholds.queries.perHour,
      },
      connections: {
        current: this.getCurrentConnections(),
        limit: this.thresholds.connections.concurrent,
      },
      cost: {
        total: this.globalMetrics.totalCost,
        hourlyRate,
        hourlyLimit: this.thresholds.cost.perHour,
        dailyLimit: this.thresholds.cost.perDay,
      },
      cache: {
        size: this.queryCache.size,
        maxSize: this.cacheConfig.maxSize,
        hitRate: this.calculateCacheHitRate(),
      },
      emergency: {
        mode: this.emergencyConfig.emergencyMode,
        disabledEndpoints: this.emergencyConfig.disabledEndpoints,
      },
      uptime: uptime,
    };
  }
  
  private calculateCacheHitRate(): number {
    // Calculate actual cache hit rate based on cache operations
    const cacheMetrics = (globalThis as any).cacheMetrics || { hits: 0, misses: 0 };
    const totalRequests = cacheMetrics.hits + cacheMetrics.misses;
    
    if (totalRequests === 0) {
      return 0;
    }
    
    return cacheMetrics.hits / totalRequests;
  }
  
  /**
   * Enable/disable emergency mode manually
   */
  setEmergencyMode(enabled: boolean, reason?: string): void {
    this.emergencyConfig.emergencyMode = enabled;
    
    if (enabled) {
      console.error('🚨 [EMERGENCY MODE ENABLED]', { reason, timestamp: new Date().toISOString() });
    } else {
      console.info('✅ [EMERGENCY MODE DISABLED]', { reason, timestamp: new Date().toISOString() });
      this.emergencyConfig.disabledEndpoints = [];
    }
  }
  
  /**
   * Get endpoint-specific metrics
   */
  getEndpointMetrics(endpoint?: string) {
    if (endpoint) {
      return this.queryMetrics.get(endpoint) || [];
    }
    
    const summary = new Map<string, {
      totalQueries: number;
      totalCost: number;
      averageDuration: number;
      operationCount: number;
      lastActivity: string;
    }>();
    
    for (const [ep, metrics] of this.queryMetrics) {
      const aggregated = metrics.reduce((acc, m) => ({
        totalQueries: acc.totalQueries + m.queryCount,
        totalCost: acc.totalCost + m.estimatedCost,
        totalDuration: acc.totalDuration + m.duration,
        operationCount: acc.operationCount + 1,
        lastTimestamp: Math.max(acc.lastTimestamp, new Date(m.timestamp).getTime()),
      }), { totalQueries: 0, totalCost: 0, totalDuration: 0, operationCount: 0, lastTimestamp: 0 });
      
      summary.set(ep, {
        totalQueries: aggregated.totalQueries,
        totalCost: aggregated.totalCost,
        averageDuration: aggregated.totalDuration / aggregated.operationCount,
        operationCount: aggregated.operationCount,
        lastActivity: new Date(aggregated.lastTimestamp).toISOString(),
      });
    }
    
    return summary;
  }

  private async sendExternalAlert(
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY',
    message: string,
    data: any
  ): Promise<void> {
    try {
      const alertPayload = {
        text: `${severity} Database Alert: ${message}`,
        attachments: [{
          color: this.getAlertColor(severity),
          title: 'Database Cost Protection Alert',
          text: message,
          fields: [
            { title: "Severity", value: severity, short: true },
            { title: "Timestamp", value: new Date().toISOString(), short: true },
            { title: "Details", value: JSON.stringify(data, null, 2), short: false }
          ],
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      // Send to webhook if configured
      const webhookUrl = process.env.DB_ALERT_WEBHOOK_URL || process.env.COST_ALERT_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertPayload)
        });
      }

      // Send email if configured
      const emailEndpoint = process.env.DB_ALERT_EMAIL_ENDPOINT;
      if (emailEndpoint) {
        await fetch(emailEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: process.env.DB_ALERT_EMAIL_TO,
            subject: `${severity} Database Alert - ${message}`,
            body: JSON.stringify({ message, data }, null, 2)
          })
        });
      }

      // For emergency alerts, try multiple channels
      if (severity === 'EMERGENCY') {
        const emergencyWebhook = process.env.EMERGENCY_WEBHOOK_URL;
        if (emergencyWebhook && emergencyWebhook !== webhookUrl) {
          await fetch(emergencyWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...alertPayload,
              text: `🚨 EMERGENCY DATABASE ALERT 🚨: ${message}`
            })
          });
        }
      }
    } catch (error) {
      console.error('[DB COST PROTECTOR] Failed to send external alert:', error);
    }
  }

  private getAlertColor(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY'): string {
    switch (severity) {
      case 'EMERGENCY': return 'danger';
      case 'HIGH': return 'danger';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'good';
      default: return 'warning';
    }
  }
}

// Global instance
export const globalDatabaseCostProtector = DatabaseCostProtector.getInstance();

/**
 * Middleware wrapper for Next.js API routes
 */
export function withDatabaseCostProtection<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  config: {
    endpoint?: string;
    operationType?: DatabaseCostMetrics['operationType'];
    estimatedQueries?: number;
    cacheKey?: string;
    cacheTtl?: number;
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as NextRequest;
    const endpoint = config.endpoint || new URL(request.url).pathname;
    
    return globalDatabaseCostProtector.withCostProtection(
      () => handler(...args),
      {
        endpoint,
        operationType: config.operationType || 'read',
        estimatedQueries: config.estimatedQueries,
      }
    );
  }) as T;
}

/**
 * Higher-order function for cached database operations
 */
export function withDatabaseCache<T>(
  operation: () => Promise<T>,
  cacheKey: string,
  ttlSeconds?: number
): Promise<T> {
  return globalDatabaseCostProtector.withQueryCache(cacheKey, operation, ttlSeconds);
}

/**
 * Higher-order function for batched database operations
 */
export function withDatabaseBatching<T>(
  batchKey: string,
  query: { sql: string; params: any[] },
  operation: (queries: Array<{ sql: string; params: any[] }>) => Promise<T[]>
): Promise<T> {
  return globalDatabaseCostProtector.withQueryBatching(batchKey, query, operation);
}