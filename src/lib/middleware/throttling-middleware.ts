/**
 * Request Throttling Middleware
 * 
 * Middleware for Next.js API routes to apply request throttling and rate limiting.
 * Prevents excessive edge requests and improves system stability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestThrottlingService } from '@/src/lib/request-throttling-service';

export interface ThrottlingOptions {
  skipThrottling?: boolean;
  customLimits?: {
    maxRequestsPerMinute?: number;
    burstLimit?: number;
  };
  identifier?: (request: NextRequest) => string;
}

/**
 * Apply request throttling to API routes
 */
export function withThrottling(
  handler: (request: NextRequest) => Promise<Response | NextResponse> | Response | NextResponse,
  options: ThrottlingOptions = {}
) {
  return async (request: NextRequest): Promise<Response | NextResponse> => {
    // Skip throttling if disabled
    if (options.skipThrottling) {
      return handler(request);
    }

    // Get client identifier
    const clientId = options.identifier 
      ? options.identifier(request)
      : getClientIdentifier(request);

    // Extract user ID if available
    const userId = await getUserId(request);

    // Apply custom limits if provided
    if (options.customLimits) {
      requestThrottlingService.updateConfig({
        maxRequestsPerMinute: options.customLimits.maxRequestsPerMinute || 30,
        burstLimit: options.customLimits.burstLimit || 5,
      });
    }

    // Check if request should be throttled
    const throttleResult = requestThrottlingService.checkRequest(clientId, userId);

    if (!throttleResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: throttleResult.reason,
          retryAfter: throttleResult.retryAfter,
          currentRate: throttleResult.currentRate,
          limits: throttleResult.limits,
          timestamp: new Date().toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((throttleResult.retryAfter || 60000) / 1000)),
            'X-RateLimit-Limit': String(throttleResult.limits.requestsPerMinute),
            'X-RateLimit-Remaining': String(Math.max(0, throttleResult.limits.requestsPerMinute - throttleResult.currentRate)),
            'X-RateLimit-Reset': String(Date.now() + (throttleResult.retryAfter || 60000)),
          },
        }
      );
    }

    try {
      // Process the request
      const response = await handler(request);

      // Add rate limit headers to successful responses
      response.headers.set('X-RateLimit-Limit', String(throttleResult.limits.requestsPerMinute));
      response.headers.set('X-RateLimit-Remaining', String(Math.max(0, throttleResult.limits.requestsPerMinute - throttleResult.currentRate)));
      response.headers.set('X-RateLimit-Reset', String(Date.now() + 60000));

      return response;
    } catch (error) {
      console.error('[throttling-middleware] Request processing error:', error);
      throw error;
    }
  };
}

/**
 * SSE-specific throttling middleware
 */
export function withSSEThrottling(
  handler: (request: NextRequest) => Promise<Response | NextResponse> | Response | NextResponse,
  options: {
    maxConnections?: number;
    heartbeatInterval?: number;
  } = {}
) {
  return withThrottling(handler, {
    customLimits: {
      maxRequestsPerMinute: 6, // Very conservative for SSE
      burstLimit: 2,
    },
    identifier: (request) => {
      // Use more restrictive identifier for SSE endpoints
      return `sse-${getClientIdentifier(request)}`;
    },
  });
}

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  // Use IP address and User-Agent for identification
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const userAgentHash = hashString(userAgent).substring(0, 8);
  
  return `${ip}-${userAgentHash}`;
}

/**
 * Extract user ID from request (implement based on your auth system)
 */
async function getUserId(request: NextRequest): Promise<string | undefined> {
  try {
    // This should be implemented based on your authentication system
    // For now, we'll use a simple approach
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // You should decode/validate the token here
      return `user-${hashString(token).substring(0, 8)}`;
    }
    
    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Connection tracking for WebSocket and SSE connections
 */
export class ConnectionTracker {
  private static instance: ConnectionTracker;
  private connections: Map<string, {
    id: string;
    type: 'websocket' | 'sse';
    clientId: string;
    userId?: string;
    createdAt: number;
    lastActivity: number;
  }> = new Map();

  static getInstance(): ConnectionTracker {
    if (!ConnectionTracker.instance) {
      ConnectionTracker.instance = new ConnectionTracker();
    }
    return ConnectionTracker.instance;
  }

  registerConnection(
    connectionId: string, 
    type: 'websocket' | 'sse', 
    clientId: string, 
    userId?: string
  ): boolean {
    // Register with throttling service
    const registered = requestThrottlingService.registerConnection(connectionId, userId);
    
    if (registered) {
      this.connections.set(connectionId, {
        id: connectionId,
        type,
        clientId,
        userId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      });
    }
    
    return registered;
  }

  unregisterConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    requestThrottlingService.unregisterConnection(connectionId);
  }

  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      connectionsByType: {
        websocket: Array.from(this.connections.values()).filter(c => c.type === 'websocket').length,
        sse: Array.from(this.connections.values()).filter(c => c.type === 'sse').length,
      },
      throttlingStats: requestThrottlingService.getStats(),
    };
  }
}

export const connectionTracker = ConnectionTracker.getInstance();