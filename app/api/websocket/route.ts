/**
 * WebSocket API Route
 * 
 * Next.js API route to manage WebSocket server lifecycle and integration.
 * Provides endpoints for WebSocket server management and client information.
 * 
 * Features:
 * - WebSocket server status and metrics
 * - Connection management
 * - Integration with agent system
 * - Performance monitoring
 */

import { NextRequest } from 'next/server';
import { 
  authenticatedHandler,
  createApiHandler,
  publicHandler,
} from "@/src/lib/api-middleware";
import { webSocketAgentBridge } from "@/src/mexc-agents/websocket-agent-bridge";
import { mexcWebSocketStream } from "@/src/services/data/mexc-websocket-stream";
import { webSocketServer } from "@/src/services/data/websocket-server";
// Build-safe imports - avoid structured logger to prevent webpack bundling issues

// ======================
// WebSocket Server Status
// ======================

export const GET = publicHandler({
  cache: {
    enabled: true,
    ttl: 5000, // 5 seconds
  },
})(async (request, context) => {
  // Simple console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[websocket-api]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[websocket-api]', message, context || ''),
    error: (message: string, context?: any) => console.error('[websocket-api]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[websocket-api]', message, context || ''),
  };
  try {
    // Get WebSocket server status
    const serverMetrics = webSocketServer.getServerMetrics();
    const connectionMetrics = webSocketServer.getConnectionMetrics();
    const isServerHealthy = webSocketServer.isHealthy();

    // Get MEXC WebSocket stream status
    const mexcStreamStatus = mexcWebSocketStream.getConnectionStatus();
    const mexcHealthy = await mexcWebSocketStream.healthCheck();

    // Get agent bridge status
    const bridgeStatus = webSocketAgentBridge.getStatus();

    // Compile comprehensive status
    const status = {
      websocketServer: {
        healthy: isServerHealthy,
        metrics: serverMetrics,
        connections: connectionMetrics.length,
        uptime: serverMetrics.uptime,
      },
      mexcStream: {
        healthy: mexcHealthy,
        connected: mexcStreamStatus.connected,
        connecting: mexcStreamStatus.connecting,
        subscriptions: mexcStreamStatus.subscriptions,
        lastMessage: mexcStreamStatus.lastMessage,
      },
      agentBridge: {
        initialized: bridgeStatus.initialized,
        running: bridgeStatus.running,
        connectedClients: bridgeStatus.connectedClients,
        dataStreaming: bridgeStatus.dataStreaming,
      },
      overall: {
        healthy: isServerHealthy && mexcHealthy && bridgeStatus.running,
        lastCheck: new Date().toISOString(),
      },
    };

    return context.success(status, {
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[WebSocket API] Error getting status:', { error });
    return context.error(
      'Failed to get WebSocket status',
      500,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
});

// ======================
// WebSocket Server Management
// ======================

export const POST = authenticatedHandler({
  parseBody: true,
  validation: {
    action: 'required',
  },
})(async (request, context) => {
  // Simple console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[websocket-api]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[websocket-api]', message, context || ''),
    error: (message: string, context?: any) => console.error('[websocket-api]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[websocket-api]', message, context || ''),
  };
  try {
    const { action, ...params } = context.body;

    switch (action) {
      case 'start_server':
        if (!webSocketServer.isHealthy()) {
          await webSocketServer.start();
        }
        return context.success({ 
          message: 'WebSocket server started',
          status: webSocketServer.getServerMetrics(),
        });

      case 'stop_server':
        if (webSocketServer.isHealthy()) {
          await webSocketServer.stop();
        }
        return context.success({ 
          message: 'WebSocket server stopped',
        });

      case 'start_mexc_stream':
        if (!mexcWebSocketStream.isConnected) {
          await mexcWebSocketStream.start();
        }
        return context.success({ 
          message: 'MEXC stream started',
          status: mexcWebSocketStream.getConnectionStatus(),
        });

      case 'stop_mexc_stream':
        if (mexcWebSocketStream.isConnected) {
          mexcWebSocketStream.stop();
        }
        return context.success({ 
          message: 'MEXC stream stopped',
        });

      case 'start_agent_bridge':
        if (!webSocketAgentBridge.isRunning()) {
          webSocketAgentBridge.start();
        }
        return context.success({ 
          message: 'Agent bridge started',
          status: webSocketAgentBridge.getStatus(),
        });

      case 'stop_agent_bridge':
        if (webSocketAgentBridge.isRunning()) {
          webSocketAgentBridge.stop();
        }
        return context.success({ 
          message: 'Agent bridge stopped',
        });

      case 'broadcast_message':
        const { channel, type, data } = params;
        if (!channel || !type || !data) {
          return context.validationError('broadcast_message', 'channel, type, and data are required for broadcast');
        }

        webSocketServer.broadcast({
          type,
          channel,
          data,
        });

        return context.success({ 
          message: 'Message broadcasted',
          channel,
          type,
        });

      case 'subscribe_symbols':
        const { symbols } = params;
        if (!Array.isArray(symbols)) {
          return context.validationError('symbols', 'symbols must be an array');
        }

        await mexcWebSocketStream.subscribeToSymbolList(symbols);
        
        return context.success({ 
          message: `Subscribed to ${symbols.length} symbols`,
          symbols,
        });

      case 'get_connections':
        const connections = webSocketServer.getConnectionMetrics();
        return context.success({
          connections: connections.map(conn => ({
            connectionId: conn.connectionId,
            userId: conn.userId,
            connectedAt: conn.connectedAt,
            lastActivity: conn.lastActivity,
            messagesSent: conn.messagesSent,
            messagesReceived: conn.messagesReceived,
            subscriptions: conn.subscriptions,
          })),
          total: connections.length,
        });

      case 'get_metrics':
        const serverMetrics = webSocketServer.getServerMetrics();
        const mexcStatus = mexcWebSocketStream.getConnectionStatus();
        const bridgeStatus = webSocketAgentBridge.getStatus();

        return context.success({
          server: serverMetrics,
          mexcStream: mexcStatus,
          agentBridge: bridgeStatus,
          timestamp: Date.now(),
        });

      default:
        return context.validationError('action', 'Invalid action specified');
    }

  } catch (error) {
    console.error('[WebSocket API] Error in POST action:', { error });
    return context.error(
      `Failed to execute action: ${context.body?.action}`,
      500,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
});

// ======================
// WebSocket Connection Info
// ======================

export const PUT = authenticatedHandler({
  parseBody: true,
})(async (request, context) => {
  // Simple console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[websocket-api]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[websocket-api]', message, context || ''),
    error: (message: string, context?: any) => console.error('[websocket-api]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[websocket-api]', message, context || ''),
  };
  try {
    const { connectionId, action, ...params } = context.body;

    if (!connectionId) {
      return context.validationError('connectionId', 'Connection ID is required');
    }

    switch (action) {
      case 'get_info':
        // Get connection info
        const connections = webSocketServer.getConnectionMetrics();
        const connection = connections.find(c => c.connectionId === connectionId);
        
        if (!connection) {
          return context.error('Connection not found', 404);
        }

        return context.success(connection);

      case 'disconnect':
        // Disconnect specific connection
        // This would require adding a disconnect method to the server
        return context.success({ 
          message: 'Connection disconnect requested',
          connectionId,
        });

      case 'send_message':
        const { message } = params;
        if (!message) {
          return context.validationError('message', 'Message is required');
        }

        const success = webSocketServer.sendMessage(connectionId, {
          type: 'system:ack',
          channel: 'system',
          data: message,
          messageId: crypto.randomUUID(),
          timestamp: Date.now(),
        });

        return context.success({ 
          success,
          message: success ? 'Message sent' : 'Failed to send message',
        });

      default:
        return context.validationError('action', 'Invalid action specified');
    }

  } catch (error) {
    console.error('[WebSocket API] Error in PUT action:', { error });
    return context.error(
      'Failed to manage connection',
      500,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
});

// ======================
// Advanced Operations
// ======================

export const PATCH = authenticatedHandler({
  parseBody: true,
  // Admin only operations - auth is handled by authenticatedHandler
})(async (request, context) => {
  // Simple console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[websocket-api]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[websocket-api]', message, context || ''),
    error: (message: string, context?: any) => console.error('[websocket-api]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[websocket-api]', message, context || ''),
  };
  try {
    const { operation, ...params } = context.body;

    switch (operation) {
      case 'health_check':
        // Comprehensive health check
        const serverHealthy = webSocketServer.isHealthy();
        const mexcHealthy = await mexcWebSocketStream.healthCheck();
        const bridgeHealthy = webSocketAgentBridge.isRunning();

        const issues: string[] = [];
        const recommendations: string[] = [];

        if (!serverHealthy) {
          issues.push('WebSocket server is not running');
          recommendations.push('Start the WebSocket server');
        }

        if (!mexcHealthy) {
          issues.push('MEXC WebSocket stream is not connected');
          recommendations.push('Check MEXC connectivity and restart stream');
        }

        if (!bridgeHealthy) {
          issues.push('Agent bridge is not running');
          recommendations.push('Initialize and start the agent bridge');
        }

        const overall = serverHealthy && mexcHealthy && bridgeHealthy;

        return context.success({
          healthy: overall,
          components: {
            websocketServer: serverHealthy,
            mexcStream: mexcHealthy,
            agentBridge: bridgeHealthy,
          },
          issues,
          recommendations,
          timestamp: Date.now(),
        });

      case 'restart_all':
        // Restart all WebSocket services
        console.info('[WebSocket API] Restarting all WebSocket services...');

        // Stop services
        if (webSocketAgentBridge.isRunning()) {
          webSocketAgentBridge.stop();
        }
        
        if (mexcWebSocketStream.isConnected) {
          mexcWebSocketStream.stop();
        }

        if (webSocketServer.isHealthy()) {
          await webSocketServer.stop();
        }

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Start services
        await webSocketServer.start();
        await mexcWebSocketStream.start();
        webSocketAgentBridge.start();

        return context.success({
          message: 'All WebSocket services restarted',
          timestamp: Date.now(),
        });

      case 'performance_report':
        // Generate comprehensive performance report
        const serverMetrics = webSocketServer.getServerMetrics();
        const connectionMetrics = webSocketServer.getConnectionMetrics();
        const mexcStatus = mexcWebSocketStream.getConnectionStatus();

        const performanceReport = {
          server: {
            totalConnections: serverMetrics.totalConnections,
            authenticatedConnections: serverMetrics.authenticatedConnections,
            messagesPerSecond: serverMetrics.messagesPerSecond,
            averageLatency: serverMetrics.averageLatency,
            errorRate: serverMetrics.errorRate,
            uptime: serverMetrics.uptime,
          },
          connections: {
            total: connectionMetrics.length,
            active: connectionMetrics.filter(c => Date.now() - c.lastActivity < 60000).length,
            averageMessages: connectionMetrics.reduce((sum, c) => sum + c.messagesSent + c.messagesReceived, 0) / connectionMetrics.length || 0,
            topUsers: connectionMetrics
              .sort((a, b) => (b.messagesSent + b.messagesReceived) - (a.messagesSent + a.messagesReceived))
              .slice(0, 10)
              .map(c => ({
                userId: c.userId,
                connectionId: c.connectionId,
                totalMessages: c.messagesSent + c.messagesReceived,
                uptime: Date.now() - c.connectedAt,
              })),
          },
          mexcStream: {
            connected: mexcStatus.connected,
            subscriptions: mexcStatus.subscriptions,
            connecting: mexcStatus.connecting,
          },
          recommendations: generatePerformanceRecommendations(serverMetrics, connectionMetrics),
        };

        return context.success(performanceReport);

      default:
        return context.validationError('operation', 'Invalid operation specified');
    }

  } catch (error) {
    console.error('[WebSocket API] Error in PATCH operation:', { error });
    return context.error(
      'Failed to execute operation',
      500,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
});

// ======================
// Helper Functions
// ======================

function generatePerformanceRecommendations(serverMetrics: any, connectionMetrics: any[]): string[] {
  const recommendations: string[] = [];

  if (serverMetrics.totalConnections > 1000) {
    recommendations.push('Consider implementing connection pooling for high connection counts');
  }

  if (serverMetrics.errorRate > 0.05) {
    recommendations.push('High error rate detected - investigate error patterns');
  }

  if (serverMetrics.averageLatency > 100) {
    recommendations.push('High latency detected - consider optimizing message handling');
  }

  const inactiveConnections = connectionMetrics.filter(c => Date.now() - c.lastActivity > 300000).length;
  if (inactiveConnections > connectionMetrics.length * 0.3) {
    recommendations.push('High number of inactive connections - consider implementing connection cleanup');
  }

  if (recommendations.length === 0) {
    recommendations.push('All metrics within normal ranges');
  }

  return recommendations;
}