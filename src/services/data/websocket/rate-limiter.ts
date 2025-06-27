/**
 * WebSocket Rate Limiter
 *
 * Implements rate limiting for WebSocket connections to prevent abuse and ensure system stability.
 * Extracted from websocket-server.ts for modularity and reusability.
 *
 * Features:
 * - IP-based connection limiting
 * - Per-connection message rate limiting
 * - Automatic cleanup of expired limits
 * - Configurable thresholds and time windows
 */

interface ConnectionLimit {
  count: number;
  resetTime: number;
}

interface IPLimit {
  connections: Set<string>;
  resetTime: number;
}

export interface RateLimiterConfig {
  maxConnectionsPerIP?: number;
  maxMessagesPerMinute?: number;
  windowMs?: number;
}

export interface RateLimiterStats {
  activeConnectionLimits: number;
  activeIPLimits: number;
  totalTrackedConnections: number;
  totalTrackedIPs: number;
}

export class WebSocketRateLimiter {
  private connectionLimits = new Map<string, ConnectionLimit>();
  private ipLimits = new Map<string, IPLimit>();

  private readonly maxConnectionsPerIP: number;
  private readonly maxMessagesPerMinute: number;
  private readonly windowMs: number;

  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[websocket-rate-limiter]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[websocket-rate-limiter]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error("[websocket-rate-limiter]", message, context || "", error || ""),
    debug: (message: string, context?: unknown) =>
      console.debug("[websocket-rate-limiter]", message, context || ""),
  };

  constructor(config: RateLimiterConfig = {}) {
    this.maxConnectionsPerIP = config.maxConnectionsPerIP ?? 10;
    this.maxMessagesPerMinute = config.maxMessagesPerMinute ?? 100;
    this.windowMs = config.windowMs ?? 60000; // 1 minute

    this.logger.info("Rate limiter initialized", {
      maxConnectionsPerIP: this.maxConnectionsPerIP,
      maxMessagesPerMinute: this.maxMessagesPerMinute,
      windowMs: this.windowMs,
    });
  }

  /**
   * Check if a new connection from the specified IP is allowed
   */
  checkConnectionLimit(ip: string, connectionId: string): boolean {
    const now = Date.now();

    // Clean up expired entries
    this.cleanupExpired(now);

    const ipLimit = this.ipLimits.get(ip);
    if (!ipLimit) {
      this.ipLimits.set(ip, {
        connections: new Set([connectionId]),
        resetTime: now + this.windowMs,
      });
      this.logger.debug(`New IP registered: ${ip}`, { connectionId });
      return true;
    }

    // Check if this IP has reached the connection limit
    if (
      ipLimit.connections.size >= this.maxConnectionsPerIP &&
      !ipLimit.connections.has(connectionId)
    ) {
      this.logger.warn(`Connection limit exceeded for IP: ${ip}`, {
        connectionId,
        currentConnections: ipLimit.connections.size,
        maxConnections: this.maxConnectionsPerIP,
      });
      return false;
    }

    ipLimit.connections.add(connectionId);
    this.logger.debug(`Connection allowed for IP: ${ip}`, {
      connectionId,
      totalConnections: ipLimit.connections.size,
    });
    return true;
  }

  /**
   * Check if a message from the specified connection is allowed
   */
  checkMessageLimit(connectionId: string): boolean {
    const now = Date.now();

    const limit = this.connectionLimits.get(connectionId);
    if (!limit) {
      this.connectionLimits.set(connectionId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // Reset counter if window has expired
    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + this.windowMs;
      return true;
    }

    // Check if message limit has been reached
    if (limit.count >= this.maxMessagesPerMinute) {
      this.logger.warn(`Message rate limit exceeded for connection: ${connectionId}`, {
        currentCount: limit.count,
        maxMessages: this.maxMessagesPerMinute,
        windowMs: this.windowMs,
      });
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Remove a connection from rate limiting tracking
   */
  removeConnection(ip: string, connectionId: string): void {
    const ipLimit = this.ipLimits.get(ip);
    if (ipLimit) {
      ipLimit.connections.delete(connectionId);
      if (ipLimit.connections.size === 0) {
        this.ipLimits.delete(ip);
        this.logger.debug(`IP limit tracking removed: ${ip}`);
      } else {
        this.logger.debug(`Connection removed from IP: ${ip}`, {
          connectionId,
          remainingConnections: ipLimit.connections.size,
        });
      }
    }

    if (this.connectionLimits.delete(connectionId)) {
      this.logger.debug(`Message limit tracking removed: ${connectionId}`);
    }
  }

  /**
   * Get current rate limiter statistics
   */
  getStats(): RateLimiterStats {
    const totalTrackedConnections = Array.from(this.ipLimits.values()).reduce(
      (total, limit) => total + limit.connections.size,
      0
    );

    return {
      activeConnectionLimits: this.connectionLimits.size,
      activeIPLimits: this.ipLimits.size,
      totalTrackedConnections,
      totalTrackedIPs: this.ipLimits.size,
    };
  }

  /**
   * Get rate limit status for a specific connection
   */
  getConnectionStatus(connectionId: string): {
    messageCount: number;
    remainingMessages: number;
    resetTime: number;
    isLimited: boolean;
  } {
    const limit = this.connectionLimits.get(connectionId);
    if (!limit) {
      return {
        messageCount: 0,
        remainingMessages: this.maxMessagesPerMinute,
        resetTime: Date.now() + this.windowMs,
        isLimited: false,
      };
    }

    const remainingMessages = Math.max(0, this.maxMessagesPerMinute - limit.count);
    const isLimited = limit.count >= this.maxMessagesPerMinute;

    return {
      messageCount: limit.count,
      remainingMessages,
      resetTime: limit.resetTime,
      isLimited,
    };
  }

  /**
   * Get rate limit status for a specific IP
   */
  getIPStatus(ip: string): {
    connectionCount: number;
    remainingConnections: number;
    resetTime: number;
    isLimited: boolean;
  } {
    const limit = this.ipLimits.get(ip);
    if (!limit) {
      return {
        connectionCount: 0,
        remainingConnections: this.maxConnectionsPerIP,
        resetTime: Date.now() + this.windowMs,
        isLimited: false,
      };
    }

    const remainingConnections = Math.max(0, this.maxConnectionsPerIP - limit.connections.size);
    const isLimited = limit.connections.size >= this.maxConnectionsPerIP;

    return {
      connectionCount: limit.connections.size,
      remainingConnections,
      resetTime: limit.resetTime,
      isLimited,
    };
  }

  /**
   * Manually clean up expired rate limit entries
   */
  cleanup(): void {
    const now = Date.now();
    this.cleanupExpired(now);
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpired(now: number): void {
    // Clean up expired connection limits
    const expiredConnections: string[] = [];
    for (const [connectionId, limit] of this.connectionLimits.entries()) {
      if (now > limit.resetTime) {
        expiredConnections.push(connectionId);
      }
    }

    for (const connectionId of expiredConnections) {
      this.connectionLimits.delete(connectionId);
    }

    // Clean up expired IP limits
    const expiredIPs: string[] = [];
    for (const [ip, limit] of this.ipLimits.entries()) {
      if (now > limit.resetTime) {
        expiredIPs.push(ip);
      }
    }

    for (const ip of expiredIPs) {
      this.ipLimits.delete(ip);
    }

    if (expiredConnections.length > 0 || expiredIPs.length > 0) {
      this.logger.debug("Cleaned up expired rate limits", {
        expiredConnections: expiredConnections.length,
        expiredIPs: expiredIPs.length,
      });
    }
  }

  /**
   * Reset all rate limits (useful for testing or emergency situations)
   */
  reset(): void {
    const previousStats = this.getStats();
    this.connectionLimits.clear();
    this.ipLimits.clear();
    
    this.logger.info("Rate limiter reset", {
      previousActiveConnectionLimits: previousStats.activeConnectionLimits,
      previousActiveIPLimits: previousStats.activeIPLimits,
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimiterConfig>): void {
    const oldConfig = {
      maxConnectionsPerIP: this.maxConnectionsPerIP,
      maxMessagesPerMinute: this.maxMessagesPerMinute,
      windowMs: this.windowMs,
    };

    if (config.maxConnectionsPerIP !== undefined) {
      (this as any).maxConnectionsPerIP = config.maxConnectionsPerIP;
    }
    if (config.maxMessagesPerMinute !== undefined) {
      (this as any).maxMessagesPerMinute = config.maxMessagesPerMinute;
    }
    if (config.windowMs !== undefined) {
      (this as any).windowMs = config.windowMs;
    }

    this.logger.info("Rate limiter configuration updated", {
      oldConfig,
      newConfig: config,
    });
  }
}