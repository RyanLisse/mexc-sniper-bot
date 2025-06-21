/**
 * OpenTelemetry API Middleware
 * 
 * Provides automatic instrumentation for all API routes with consistent
 * span creation, error tracking, and performance monitoring.
 */

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { NextRequest, NextResponse } from 'next/server';
import { TRADING_TELEMETRY_CONFIG } from './opentelemetry-setup';

const tracer = trace.getTracer('mexc-trading-bot-api');

/**
 * Enhanced API route handler with OpenTelemetry instrumentation
 */
export function instrumentedTradingRoute<T = any>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  operationType: string
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const { pathname } = new URL(request.url);
    const method = request.method;
    
    const spanName = `${TRADING_TELEMETRY_CONFIG.spans.api_call}.${operationType}`;
    
    return tracer.startActiveSpan(spanName, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': method,
        'http.url': request.url,
        'http.route': pathname,
        'http.user_agent': request.headers.get('user-agent') || '',
        [TRADING_TELEMETRY_CONFIG.attributes.api_endpoint]: pathname,
        [TRADING_TELEMETRY_CONFIG.attributes.api_method]: method,
        'trading.operation_type': operationType,
      },
    }, async (span) => {
      const startTime = Date.now();
      
      try {
        // Execute the original handler
        const response = await handler(request);
        
        const duration = Date.now() - startTime;
        
        // Add response attributes
        span.setAttributes({
          'http.status_code': response.status,
          [TRADING_TELEMETRY_CONFIG.attributes.response_time]: duration,
          'response.size_bytes': response.headers.get('content-length') ? 
            Number.parseInt(response.headers.get('content-length')!) : 0,
        });

        // Set span status based on HTTP status
        if (response.status >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${response.status}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        // Add event for successful completion
        span.addEvent('request.completed', {
          duration_ms: duration,
          status: 'success',
        });

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Record exception details
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });

        // Add error attributes
        span.setAttributes({
          'error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
          'error.message': error instanceof Error ? error.message : 'Unknown error',
          [TRADING_TELEMETRY_CONFIG.attributes.response_time]: duration,
        });

        // Add error event
        span.addEvent('request.error', {
          duration_ms: duration,
          error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        // Re-throw the error to maintain original behavior
        throw error;
      }
    });
  };
}

/**
 * Simple API route instrumentation (for non-trading routes)
 */
export function instrumentedApiRoute<T = any>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  routeName: string
) {
  return instrumentedTradingRoute(handler, routeName);
}

/**
 * Instrumentation for database operations within API routes
 */
export async function instrumentedDatabaseOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> {
  const spanName = `${TRADING_TELEMETRY_CONFIG.spans.database_query}.${operationName}`;
  
  return tracer.startActiveSpan(spanName, {
    kind: SpanKind.CLIENT,
    attributes: {
      'db.system': 'sqlite',
      'db.name': 'mexc_trading_bot',
      'db.operation': operationName,
      ...attributes,
    },
  }, async (span) => {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'db.duration_ms': duration,
        'db.success': true,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      span.recordException(error as Error);
      span.setAttributes({
        'db.duration_ms': duration,
        'db.success': false,
        'db.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
      });
      
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Database operation failed',
      });
      
      throw error;
    }
  });
}

/**
 * Instrumentation for external API calls (MEXC API)
 */
export async function instrumentedApiCall<T>(
  endpoint: string,
  operation: () => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> {
  const spanName = `${TRADING_TELEMETRY_CONFIG.spans.api_call}.mexc`;
  
  return tracer.startActiveSpan(spanName, {
    kind: SpanKind.CLIENT,
    attributes: {
      [TRADING_TELEMETRY_CONFIG.attributes.api_endpoint]: endpoint,
      'external.service': 'mexc',
      'external.operation': 'api_call',
      ...attributes,
    },
  }, async (span) => {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        [TRADING_TELEMETRY_CONFIG.attributes.response_time]: duration,
        'api.success': true,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      
      span.addEvent('api.call.completed', {
        endpoint,
        duration_ms: duration,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      span.recordException(error as Error);
      span.setAttributes({
        [TRADING_TELEMETRY_CONFIG.attributes.response_time]: duration,
        'api.success': false,
        'api.error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
      });
      
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'API call failed',
      });
      
      span.addEvent('api.call.error', {
        endpoint,
        duration_ms: duration,
        error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
      });
      
      throw error;
    }
  });
}

/**
 * Create trading-specific span for business logic
 */
export async function instrumentedTradingOperation<T>(
  operationType: 'pattern_detection' | 'trade_execution' | 'risk_assessment' | 'position_monitoring' | 'safety_check',
  operation: () => Promise<T>,
  attributes: Record<string, any> = {}
): Promise<T> {
  const spanName = TRADING_TELEMETRY_CONFIG.spans[operationType];
  
  return tracer.startActiveSpan(spanName, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'trading.operation': operationType,
      ...attributes,
    },
  }, async (span) => {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'operation.duration_ms': duration,
        'operation.success': true,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      span.recordException(error as Error);
      span.setAttributes({
        'operation.duration_ms': duration,
        'operation.success': false,
      });
      
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Trading operation failed',
      });
      
      throw error;
    }
  });
}

/**
 * Add contextual attributes to the current active span
 */
export function addTradingAttributes(attributes: Record<string, any>): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setAttributes(attributes);
  }
}

/**
 * Add an event to the current active span
 */
export function addTradingEvent(name: string, attributes?: Record<string, any>): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}

/**
 * Record an exception in the current active span
 */
export function recordTradingException(error: Error): void {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.recordException(error);
    activeSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}