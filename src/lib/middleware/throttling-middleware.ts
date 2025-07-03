/**
 * Throttling Middleware
 * Minimal implementation for build optimization
 */

import { NextRequest, NextResponse } from 'next/server';

interface ThrottleConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
}

const requestMap = new Map<string, { count: number; resetTime: number }>();

export function createThrottlingMiddleware(config: ThrottleConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const clientId = getClientId(request);
    const now = Date.now();
    
    const record = requestMap.get(clientId);
    
    if (!record || now > record.resetTime) {
      requestMap.set(clientId, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return null; // Allow request
    }
    
    if (record.count >= config.maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: Math.ceil((record.resetTime - now) / 1000) },
        { status: 429 }
      );
    }
    
    record.count++;
    return null; // Allow request
  };
}

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

export const defaultThrottlingMiddleware = createThrottlingMiddleware({
  maxRequests: 100,
  windowMs: 60000 // 1 minute
});

// Add missing export aliases for compatibility
export const connectionTracker = {
  getActiveConnections: () => requestMap.size,
  getTotalRequests: () => Array.from(requestMap.values()).reduce((total, record) => total + record.count, 0),
  clearTracking: () => requestMap.clear()
};