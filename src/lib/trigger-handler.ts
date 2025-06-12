import { NextRequest } from "next/server";
import { inngest } from "@/src/inngest/client";
import { ApiResponse } from "./api-response";

/**
 * Factory function to create consistent trigger handlers for Inngest workflows
 */
export function createTriggerHandler(
  eventName: string,
  description: string,
  dataTransform?: (body: any) => any
) {
  return async function POST(request: NextRequest) {
    try {
      // Parse request body if present
      let body = {};
      try {
        body = await request.json();
      } catch {
        // No body or invalid JSON, use empty object
      }

      // Transform data if transformer provided
      const eventData = dataTransform ? dataTransform(body) : body;

      // Send event to Inngest
      const event = await inngest.send({
        name: eventName,
        data: {
          triggeredBy: "ui",
          timestamp: new Date().toISOString(),
          ...eventData,
        },
      });

      return ApiResponse.success(
        {
          message: `${description} workflow triggered`,
          eventId: event.ids[0],
          ...eventData,
        },
        {
          workflow: description,
          eventName,
        }
      );
    } catch (error) {
      return ApiResponse.error(error, 500, {
        workflow: description,
        eventName,
      });
    }
  };
}

/**
 * Common trigger handlers for MEXC workflows
 */
export const TriggerHandlers = {
  calendarPoll: createTriggerHandler(
    "mexc/calendar.poll",
    "Calendar polling"
  ),

  patternAnalysis: createTriggerHandler(
    "mexc/patterns.analyze",
    "Pattern analysis",
    (body) => ({
      symbols: body.symbols || [],
    })
  ),

  symbolWatch: createTriggerHandler(
    "mexc/symbol.watch",
    "Symbol watch",
    (body) => ({
      vcoinId: body.vcoinId,
      symbol: body.symbol,
    })
  ),

  tradingStrategy: createTriggerHandler(
    "mexc/strategy.create",
    "Trading strategy creation",
    (body) => ({
      symbols: body.symbols || [],
      strategy: body.strategy || "balanced",
    })
  ),

  emergency: createTriggerHandler(
    "mexc/emergency.stop",
    "Emergency stop",
    (body) => ({
      reason: body.reason || "Manual trigger",
      userId: body.userId,
    })
  ),
};

/**
 * Higher-order function to add authentication to trigger handlers
 */
export function withAuth(handler: Function, requiredRole = "user") {
  return async function(request: NextRequest) {
    // TODO: Add authentication logic here
    // For now, pass through to handler
    return handler(request);
  };
}

/**
 * Higher-order function to add rate limiting to trigger handlers
 */
export function withRateLimit(handler: Function, maxRequests = 10, windowMs = 60000) {
  const requests = new Map<string, number[]>();

  return async function(request: NextRequest) {
    const clientIP = request.ip || request.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create request log for this IP
    const clientRequests = requests.get(clientIP) || [];
    
    // Remove old requests outside the window
    const recentRequests = clientRequests.filter(timestamp => timestamp > windowStart);
    
    // Check if rate limit exceeded
    if (recentRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
      return ApiResponse.rateLimited(retryAfter);
    }

    // Add current request
    recentRequests.push(now);
    requests.set(clientIP, recentRequests);

    // Call the original handler
    return handler(request);
  };
}