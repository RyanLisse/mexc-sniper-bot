/**
 * Request Throttling Service
 * 
 * Centralized request throttling and rate limiting to prevent excessive edge requests.
 * Implements adaptive throttling based on system load and user activity.
 */

import { EventEmitter } from 'node:events';

export interface ThrottleConfig {
  maxRequestsPerMinute: number;
  maxConcurrentConnections: number;
  adaptiveThrottling: boolean;
  burstLimit: number;
  windowSizeMs: number;
  cooldownMs: number;
}

interface RequestWindow {
  requests: number[];
  connections: Set<string>;
  lastRequest: number;
}

interface ConnectionInfo {
  id: string;
  userId?: string;
  createdAt: number;
  lastActivity: number;
  requestCount: number;
  isThrottled: boolean;
}

export class RequestThrottlingService extends EventEmitter {
  private static instance: RequestThrottlingService;
  
  private config: ThrottleConfig;
  private requestWindows: Map<string, RequestWindow> = new Map();
  private connections: Map<string, ConnectionInfo> = new Map();
  private globalRequestCount = 0;
  private lastGlobalReset = Date.now();
  
  private logger = {
    info: (message: string, context?: any) => console.info('[throttling-service]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[throttling-service]', message, context || ''),
    error: (message: string, context?: any) => console.error('[throttling-service]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[throttling-service]', message, context || ''),
  };

  constructor(config: Partial<ThrottleConfig> = {}) {
    super();
    
    this.config = {
      maxRequestsPerMinute: 60, // Reduced from previous aggressive rates
      maxConcurrentConnections: 10,
      adaptiveThrottling: true,
      burstLimit: 10,
      windowSizeMs: 60000, // 1 minute
      cooldownMs: 5000, // 5 second cooldown
      ...config
    };

    this.startCleanupTimer();
    this.logger.info('Request throttling service initialized', this.config);
  }

  static getInstance(config?: Partial<ThrottleConfig>): RequestThrottlingService {
    if (!RequestThrottlingService.instance) {
      RequestThrottlingService.instance = new RequestThrottlingService(config);
    }
    return RequestThrottlingService.instance;
  }

  /**
   * Check if a request should be allowed
   */
  checkRequest(clientId: string, userId?: string): {
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
    currentRate: number;
    limits: {
      requestsPerMinute: number;
      maxConnections: number;
    };
  } {
    const now = Date.now();
    
    // Global connection limit check
    if (this.connections.size >= this.config.maxConcurrentConnections) {
      return {
        allowed: false,
        reason: 'Max concurrent connections exceeded',
        retryAfter: this.config.cooldownMs,
        currentRate: this.getCurrentRequestRate(clientId),
        limits: {
          requestsPerMinute: this.config.maxRequestsPerMinute,
          maxConnections: this.config.maxConcurrentConnections,
        }
      };
    }

    // Get or create request window for client
    let window = this.requestWindows.get(clientId);
    if (!window) {
      window = {
        requests: [],
        connections: new Set(),
        lastRequest: now
      };
      this.requestWindows.set(clientId, window);
    }

    // Clean old requests from window
    const windowStart = now - this.config.windowSizeMs;
    window.requests = window.requests.filter(timestamp => timestamp > windowStart);

    // Check rate limit
    if (window.requests.length >= this.config.maxRequestsPerMinute) {
      const retryAfter = this.config.windowSizeMs - (now - window.requests[0]);
      
      this.logger.warn('Rate limit exceeded', {
        clientId,
        requestCount: window.requests.length,
        limit: this.config.maxRequestsPerMinute,
        retryAfter
      });

      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter,
        currentRate: window.requests.length,
        limits: {
          requestsPerMinute: this.config.maxRequestsPerMinute,
          maxConnections: this.config.maxConcurrentConnections,
        }
      };
    }

    // Check for burst protection
    const recentRequests = window.requests.filter(timestamp => timestamp > now - 5000); // Last 5 seconds
    if (recentRequests.length >= this.config.burstLimit) {
      return {
        allowed: false,
        reason: 'Burst limit exceeded',
        retryAfter: this.config.cooldownMs,
        currentRate: window.requests.length,
        limits: {
          requestsPerMinute: this.config.maxRequestsPerMinute,
          maxConnections: this.config.maxConcurrentConnections,
        }
      };
    }

    // Adaptive throttling based on system load
    if (this.config.adaptiveThrottling) {
      const systemLoad = this.calculateSystemLoad();
      if (systemLoad > 0.8) { // 80% system load threshold
        const adaptiveLimit = Math.floor(this.config.maxRequestsPerMinute * (1 - systemLoad));
        if (window.requests.length >= adaptiveLimit) {
          return {
            allowed: false,
            reason: 'System under high load',
            retryAfter: this.config.cooldownMs * 2,
            currentRate: window.requests.length,
            limits: {
              requestsPerMinute: adaptiveLimit,
              maxConnections: this.config.maxConcurrentConnections,
            }
          };
        }
      }
    }

    // Allow request
    window.requests.push(now);
    window.lastRequest = now;
    this.globalRequestCount++;

    this.emit('request-allowed', { clientId, userId, timestamp: now });

    return {
      allowed: true,
      currentRate: window.requests.length,
      limits: {
        requestsPerMinute: this.config.maxRequestsPerMinute,
        maxConnections: this.config.maxConcurrentConnections,
      }
    };
  }

  /**
   * Register a new connection
   */
  registerConnection(connectionId: string, userId?: string): boolean {
    if (this.connections.size >= this.config.maxConcurrentConnections) {
      return false;
    }

    const connection: ConnectionInfo = {
      id: connectionId,
      userId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      requestCount: 0,
      isThrottled: false
    };

    this.connections.set(connectionId, connection);
    this.logger.info('Connection registered', { connectionId, userId, totalConnections: this.connections.size });
    
    this.emit('connection-registered', connection);
    return true;
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.requestWindows.delete(connectionId);
      
      this.logger.info('Connection unregistered', { 
        connectionId, 
        duration: Date.now() - connection.createdAt,
        totalConnections: this.connections.size
      });
      
      this.emit('connection-unregistered', connection);
    }
  }

  /**
   * Get current request rate for a client
   */
  getCurrentRequestRate(clientId: string): number {
    const window = this.requestWindows.get(clientId);
    if (!window) return 0;

    const now = Date.now();
    const windowStart = now - this.config.windowSizeMs;
    const validRequests = window.requests.filter(timestamp => timestamp > windowStart);
    
    return validRequests.length;
  }

  /**
   * Get throttling statistics
   */
  getStats(): {
    totalConnections: number;
    totalRequestWindows: number;
    globalRequestCount: number;
    config: ThrottleConfig;
    systemLoad: number;
    uptime: number;
  } {
    return {
      totalConnections: this.connections.size,
      totalRequestWindows: this.requestWindows.size,
      globalRequestCount: this.globalRequestCount,
      config: this.config,
      systemLoad: this.calculateSystemLoad(),
      uptime: Date.now() - this.lastGlobalReset
    };
  }

  /**
   * Update throttling configuration
   */
  updateConfig(updates: Partial<ThrottleConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Throttling config updated', updates);
    this.emit('config-updated', this.config);
  }

  /**
   * Calculate system load (simplified)
   */
  private calculateSystemLoad(): number {
    // Simplified load calculation based on active connections and requests
    const connectionLoad = this.connections.size / this.config.maxConcurrentConnections;
    const requestLoad = Math.min(this.globalRequestCount / 1000, 1); // Normalize to 1000 requests
    
    return Math.max(connectionLoad, requestLoad);
  }

  /**
   * Start cleanup timer to remove old data
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup old request windows and inactive connections
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedWindows = 0;
    let cleanedConnections = 0;

    // Clean up old request windows
    for (const [clientId, window] of this.requestWindows) {
      const windowStart = now - this.config.windowSizeMs;
      window.requests = window.requests.filter(timestamp => timestamp > windowStart);
      
      // Remove empty windows that haven't been used recently
      if (window.requests.length === 0 && now - window.lastRequest > this.config.windowSizeMs * 2) {
        this.requestWindows.delete(clientId);
        cleanedWindows++;
      }
    }

    // Clean up inactive connections
    for (const [connectionId, connection] of this.connections) {
      if (now - connection.lastActivity > this.config.windowSizeMs * 5) { // 5 minutes inactive
        this.connections.delete(connectionId);
        this.requestWindows.delete(connectionId);
        cleanedConnections++;
      }
    }

    // Reset global counter periodically
    if (now - this.lastGlobalReset > this.config.windowSizeMs * 60) { // Reset every hour
      this.globalRequestCount = 0;
      this.lastGlobalReset = now;
    }

    if (cleanedWindows > 0 || cleanedConnections > 0) {
      this.logger.debug('Cleanup completed', {
        cleanedWindows,
        cleanedConnections,
        remainingConnections: this.connections.size,
        remainingWindows: this.requestWindows.size
      });
    }
  }

  /**
   * Get recommended intervals based on current load
   */
  getRecommendedIntervals(): {
    realTimeMonitoring: number;
    analytics: number;
    heartbeat: number;
    patternCheck: number;
  } {
    const systemLoad = this.calculateSystemLoad();
    const baseMultiplier = 1 + systemLoad; // Increase intervals when system is loaded

    return {
      realTimeMonitoring: Math.max(10000, 5000 * baseMultiplier), // 10-15s
      analytics: Math.max(15000, 10000 * baseMultiplier), // 15-25s
      heartbeat: Math.max(30000, 20000 * baseMultiplier), // 30-50s
      patternCheck: Math.max(15000, 10000 * baseMultiplier), // 15-25s
    };
  }
}

// Export singleton instance
export const requestThrottlingService = RequestThrottlingService.getInstance({
  maxRequestsPerMinute: 30, // Conservative limit
  maxConcurrentConnections: 15,
  adaptiveThrottling: true,
  burstLimit: 5,
  windowSizeMs: 60000,
  cooldownMs: 10000,
});