/**
 * OpenTelemetry WebSocket Instrumentation
 * 
 * Provides comprehensive monitoring for WebSocket connections including
 * connection health, message throughput, and real-time performance metrics.
 */

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

const tracer = trace.getTracer('mexc-sniper-websocket', '1.0.0');

export interface WebSocketSpanOptions {
  connectionId?: string;
  channel?: string;
  messageType?: string;
  clientType?: 'dashboard' | 'agent' | 'trading';
  includeMessageData?: boolean;
  sensitiveFields?: string[];
}

/**
 * Instrument WebSocket connection establishment
 */
export function instrumentWebSocketConnection(
  connectionId: string,
  operation: () => Promise<void>,
  options: Omit<WebSocketSpanOptions, 'connectionId'> = {}
) {
  return tracer.startActiveSpan(
    'websocket.connection.establish',
    {
      kind: SpanKind.SERVER,
      attributes: {
        'websocket.connection_id': connectionId,
        'websocket.client_type': options.clientType || 'unknown',
        'service.name': 'websocket-server',
        'operation.type': 'connection',
      },
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        await operation();
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'websocket.connection.established': true,
          'websocket.connection.duration_ms': duration,
          'operation.success': true,
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'websocket.connection.established': false,
          'websocket.connection.duration_ms': duration,
          'operation.success': false,
          'error.name': error instanceof Error ? error.name : 'ConnectionError',
          'error.message': error instanceof Error ? error.message : String(error),
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Instrument WebSocket message sending
 */
export function instrumentWebSocketSend<T>(
  message: T,
  operation: () => Promise<void>,
  options: WebSocketSpanOptions = {}
) {
  return tracer.startActiveSpan(
    'websocket.message.send',
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        'websocket.connection_id': options.connectionId || 'unknown',
        'websocket.channel': options.channel || 'default',
        'websocket.message_type': options.messageType || 'unknown',
        'websocket.client_type': options.clientType || 'unknown',
        'service.name': 'websocket-server',
        'operation.type': 'message_send',
      },
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        // Add message metadata
        if (message && typeof message === 'object') {
          const messageSize = JSON.stringify(message).length;
          span.setAttributes({
            'websocket.message.size_bytes': messageSize,
          });

          // Add specific message type attributes
          if ('type' in message) {
            span.setAttributes({
              'websocket.message.event_type': String((message as any).type),
            });
          }

          if ('data' in message && Array.isArray((message as any).data)) {
            span.setAttributes({
              'websocket.message.data_count': (message as any).data.length,
            });
          }
        }

        await operation();
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'websocket.message.sent': true,
          'websocket.send.duration_ms': duration,
          'operation.success': true,
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'websocket.message.sent': false,
          'websocket.send.duration_ms': duration,
          'operation.success': false,
          'error.name': error instanceof Error ? error.name : 'SendError',
          'error.message': error instanceof Error ? error.message : String(error),
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Instrument WebSocket message receiving
 */
export function instrumentWebSocketReceive<T>(
  messageHandler: (message: T) => Promise<void>,
  options: WebSocketSpanOptions = {}
) {
  return async (message: T) => {
    return tracer.startActiveSpan(
      'websocket.message.receive',
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          'websocket.connection_id': options.connectionId || 'unknown',
          'websocket.channel': options.channel || 'default',
          'websocket.client_type': options.clientType || 'unknown',
          'service.name': 'websocket-server',
          'operation.type': 'message_receive',
        },
      },
      async (span) => {
        const startTime = Date.now();
        
        try {
          // Add message metadata
          if (message && typeof message === 'object') {
            const messageSize = JSON.stringify(message).length;
            span.setAttributes({
              'websocket.message.size_bytes': messageSize,
            });

            if ('type' in message) {
              span.setAttributes({
                'websocket.message.event_type': String((message as any).type),
              });
            }
          }

          await messageHandler(message);
          
          const duration = Date.now() - startTime;
          span.setAttributes({
            'websocket.message.processed': true,
            'websocket.process.duration_ms': duration,
            'operation.success': true,
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          
        } catch (error) {
          const duration = Date.now() - startTime;
          span.setAttributes({
            'websocket.message.processed': false,
            'websocket.process.duration_ms': duration,
            'operation.success': false,
            'error.name': error instanceof Error ? error.name : 'ProcessError',
            'error.message': error instanceof Error ? error.message : String(error),
          });
          
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          
          throw error;
        } finally {
          span.end();
        }
      }
    );
  };
}

/**
 * Instrument WebSocket channel operations
 */
export async function instrumentChannelOperation<T>(
  operationType: 'subscribe' | 'unsubscribe' | 'broadcast',
  channel: string,
  operation: () => Promise<T>,
  options: WebSocketSpanOptions = {}
): Promise<T> {
  return tracer.startActiveSpan(
    `websocket.channel.${operationType}`,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'websocket.channel': channel,
        'websocket.operation': operationType,
        'websocket.connection_id': options.connectionId || 'unknown',
        'service.name': 'websocket-server',
        'operation.type': 'channel_operation',
      },
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await operation();
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'websocket.channel.operation_success': true,
          'websocket.channel.duration_ms': duration,
          'operation.success': true,
        });

        // Add result metadata for broadcast operations
        if (operationType === 'broadcast' && typeof result === 'number') {
          span.setAttributes({
            'websocket.broadcast.recipient_count': result,
          });
        }
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'websocket.channel.operation_success': false,
          'websocket.channel.duration_ms': duration,
          'operation.success': false,
          'error.name': error instanceof Error ? error.name : 'ChannelError',
          'error.message': error instanceof Error ? error.message : String(error),
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Instrument WebSocket connection health monitoring
 */
export function instrumentConnectionHealth(
  connectionId: string,
  healthCheck: () => Promise<{ status: string; metrics?: any }>,
  options: WebSocketSpanOptions = {}
) {
  return tracer.startActiveSpan(
    'websocket.connection.health_check',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'websocket.connection_id': connectionId,
        'websocket.client_type': options.clientType || 'unknown',
        'service.name': 'websocket-server',
        'operation.type': 'health_check',
      },
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        const health = await healthCheck();
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'websocket.connection.health_status': health.status,
          'websocket.health_check.duration_ms': duration,
          'operation.success': true,
        });

        // Add specific health metrics if available
        if (health.metrics) {
          if (health.metrics.messagesSent) {
            span.setAttributes({
              'websocket.metrics.messages_sent': health.metrics.messagesSent,
            });
          }
          if (health.metrics.messagesReceived) {
            span.setAttributes({
              'websocket.metrics.messages_received': health.metrics.messagesReceived,
            });
          }
          if (health.metrics.lastActivity) {
            span.setAttributes({
              'websocket.metrics.last_activity_ms': Date.now() - health.metrics.lastActivity,
            });
          }
        }
        
        span.setStatus({ code: SpanStatusCode.OK });
        return health;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'websocket.connection.health_status': 'error',
          'websocket.health_check.duration_ms': duration,
          'operation.success': false,
          'error.name': error instanceof Error ? error.name : 'HealthCheckError',
          'error.message': error instanceof Error ? error.message : String(error),
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Instrument agent coordination messages
 */
export async function instrumentAgentMessage<T>(
  agentType: string,
  messageType: string,
  operation: () => Promise<T>,
  options: WebSocketSpanOptions = {}
): Promise<T> {
  return tracer.startActiveSpan(
    `websocket.agent.${agentType}.${messageType}`,
    {
      kind: SpanKind.PRODUCER,
      attributes: {
        'agent.type': agentType,
        'agent.message_type': messageType,
        'websocket.connection_id': options.connectionId || 'unknown',
        'service.name': 'agent-coordination',
        'operation.type': 'agent_message',
      },
    },
    async (span) => {
      const startTime = Date.now();
      
      try {
        const result = await operation();
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          'agent.message.sent': true,
          'agent.message.duration_ms': duration,
          'operation.success': true,
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          'agent.message.sent': false,
          'agent.message.duration_ms': duration,
          'operation.success': false,
          'error.name': error instanceof Error ? error.name : 'AgentMessageError',
          'error.message': error instanceof Error ? error.message : String(error),
        });
        
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}