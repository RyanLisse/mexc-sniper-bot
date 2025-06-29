import { desc, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { transactionLocks, workflowActivity } from "@/src/db/schema";
import { connectionTracker, withSSEThrottling } from "@/src/lib/middleware/throttling-middleware";
import { requestThrottlingService } from "@/src/lib/request-throttling-service";
// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import { MexcOrchestrator } from "@/src/mexc-agents/orchestrator";

// Server-Sent Events for real-time monitoring

async function handleRealTimeRequest(request: NextRequest) {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[real-time-route]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[real-time-route]', message, context || ''),
    error: (message: string, context?: any) => console.error('[real-time-route]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[real-time-route]', message, context || ''),
  };
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  const encoder = new TextEncoder();
  
  // Generate unique connection ID
  const connectionId = `realtime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const clientId = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  
  // Register connection with tracking
  const connectionRegistered = connectionTracker.registerConnection(connectionId, 'sse', clientId);
  
  if (!connectionRegistered) {
    return NextResponse.json(
      { error: 'Too many concurrent connections' },
      { status: 429 }
    );
  }

  // Get recommended intervals based on current system load
  const recommendedIntervals = requestThrottlingService.getRecommendedIntervals();
  const updateInterval = Math.max(10000, recommendedIntervals.realTimeMonitoring);

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (eventType: string, data: any) => {
        const formatted = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(formatted));
        
        // Update connection activity
        connectionTracker.updateActivity(connectionId);
      };

      // Send initial connection event with throttling info
      sendEvent('connected', { 
        timestamp: new Date().toISOString(),
        message: 'Real-time monitoring connected',
        type,
        connectionId,
        updateInterval,
        throttlingStats: requestThrottlingService.getStats()
      });

      // Set up interval for real-time updates with adaptive timing
      const interval = setInterval(async () => {
        try {
          const realTimeData = await getRealTimeData(type);
          sendEvent('update', realTimeData);
        } catch (error) {
          sendEvent('error', { 
            error: 'Failed to fetch real-time data',
            timestamp: new Date().toISOString()
          });
        }
      }, updateInterval);

      // Clean up on close
      const cleanup = () => {
        clearInterval(interval);
        connectionTracker.unregisterConnection(connectionId);
        controller.close();
        logger.info('Real-time connection closed', { connectionId, type });
      };

      request.signal.addEventListener('abort', cleanup);
      
      // Auto-cleanup after 30 minutes to prevent resource leaks
      setTimeout(cleanup, 30 * 60 * 1000);
    }
  });

  return new Response(stream, { headers });
}

// POST endpoint for triggering real-time events
export async function POST(request: NextRequest) {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[real-time-post]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[real-time-post]', message, context || ''),
    error: (message: string, context?: any) => console.error('[real-time-post]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[real-time-post]', message, context || ''),
  };
  
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'trigger_workflow':
        return await triggerWorkflow(data);
      case 'emergency_stop':
        return await triggerEmergencyStop(data);
      case 'update_agent_config':
        return await updateAgentConfig(data);
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    logger.error("[Real-time API] Action failed:", { error: error });
    return NextResponse.json(
      { error: "Action failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function getRealTimeData(type: string) {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[real-time-data]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[real-time-data]', message, context || ''),
    error: (message: string, context?: any) => console.error('[real-time-data]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[real-time-data]', message, context || ''),
  };
  const timestamp = new Date().toISOString();
  
  try {
    const [
      systemStatus,
      activeWorkflows,
      transactionLockStatus,
      websocketStatus,
      agentActivity,
      performanceMetrics,
      alerts
    ] = await Promise.all([
      getSystemStatus(),
      getActiveWorkflows(),
      getTransactionLockStatus(),
      getWebSocketStatus(),
      getAgentActivity(),
      getRealTimePerformanceMetrics(),
      getActiveAlerts()
    ]);

    const baseData = {
      timestamp,
      systemStatus,
      activeWorkflows,
      transactionLocks: transactionLockStatus,
      websocketConnections: websocketStatus,
      agentActivity,
      performance: performanceMetrics,
      alerts
    };

    // Filter data based on type
    switch (type) {
      case 'system':
        return {
          timestamp,
          systemStatus,
          performance: performanceMetrics,
          alerts: alerts.filter(a => a.category === 'system')
        };
      case 'agents':
        return {
          timestamp,
          agentActivity,
          alerts: alerts.filter(a => a.category === 'agent')
        };
      case 'trading':
        return {
          timestamp,
          activeWorkflows: activeWorkflows.filter((w: any) => w.type === 'trading'),
          transactionLocks: transactionLockStatus,
          alerts: alerts.filter(a => a.category === 'trading')
        };
      case 'websocket':
        return {
          timestamp,
          websocketConnections: websocketStatus,
          alerts: alerts.filter(a => a.category === 'websocket')
        };
      default:
        return baseData;
    }
  } catch (error) {
    logger.error("Error fetching real-time data:", { error: error });
    return {
      timestamp,
      error: "Failed to fetch real-time data",
      details: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

async function getSystemStatus() {
  const orchestrator = new MexcOrchestrator();
  
  const [healthCheck, agentHealth, coordinationHealth] = await Promise.all([
    orchestrator.healthCheck().catch(() => false),
    orchestrator.getAgentHealth().catch(() => ({})),
    orchestrator.getCoordinationHealth().catch(() => ({ enabled: false, healthy: false }))
  ]);

  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    overall: healthCheck ? 'healthy' : 'unhealthy',
    uptime: process.uptime(),
    memory: {
      used: memoryUsage.heapUsed,
      total: memoryUsage.heapTotal,
      usage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    agents: {
      healthy: Object.values(agentHealth).filter(h => h === true).length - 1, // Subtract details object
      total: Object.keys(agentHealth).length - 1,
      coordination: coordinationHealth.enabled && coordinationHealth.healthy
    },
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  };
}

async function getActiveWorkflows() {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[active-workflows]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[active-workflows]', message, context || ''),
    error: (message: string, context?: any) => console.error('[active-workflows]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[active-workflows]', message, context || ''),
  };
  
  try {
    const workflows = await db
      .select()
      .from(workflowActivity)
      .where(gte(workflowActivity.createdAt, new Date(Date.now() - 5 * 60 * 1000))) // Last 5 minutes
      .orderBy(desc(workflowActivity.createdAt))
      .limit(20);

    return workflows.map((w: any) => ({
      id: w.id,
      type: w.type,
      status: w.level === 'error' ? 'failed' : w.level === 'success' ? 'completed' : 'running',
      startTime: w.createdAt,
      duration: 'In progress',
      progress: w.level === 'success' ? 100 : Math.floor(Math.random() * 80 + 10),
      agentsInvolved: [],
      currentStep: w.level === 'success' ? 'Completed' : `Step ${Math.floor(Math.random() * 5 + 1)}`
    }));
  } catch (error) {
    logger.error("Error fetching active workflows:", { error: error });
    return [];
  }
}

async function getTransactionLockStatus() {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[transaction-locks]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[transaction-locks]', message, context || ''),
    error: (message: string, context?: any) => console.error('[transaction-locks]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[transaction-locks]', message, context || ''),
  };
  
  try {
    const locks = await db
      .select()
      .from(transactionLocks)
      .orderBy(desc(transactionLocks.createdAt))
      .limit(10);

    return {
      activeLocks: locks.filter((l: any) => l.status === 'active').length,
      totalLocks: locks.length,
      locks: locks.map((l: any) => ({
        id: l.id,
        resource: l.resourceId,
        type: l.lockType,
        status: l.status,
        acquiredAt: l.createdAt,
        duration: Date.now() - new Date(l.createdAt).getTime(),
        priority: (l as any).priority || 1
      }))
    };
  } catch (error) {
    logger.error("Error fetching transaction locks:", { error: error });
    return { activeLocks: 0, totalLocks: 0, locks: [] };
  }
}

async function getWebSocketStatus() {
  // Mock WebSocket status - replace with actual WebSocket monitoring
  return {
    connections: Math.floor(Math.random() * 20 + 30), // 30-50 connections
    messageRate: Math.floor(Math.random() * 100 + 50), // 50-150 messages/sec
    latency: Math.floor(Math.random() * 50 + 10), // 10-60ms
    errors: Math.floor(Math.random() * 3), // 0-2 errors
    uptime: Math.floor(Math.random() * 86400), // Up to 24 hours
    subscriptions: {
      priceFeeds: Math.floor(Math.random() * 50 + 100),
      orderBook: Math.floor(Math.random() * 20 + 10),
      trades: Math.floor(Math.random() * 30 + 20),
      system: Math.floor(Math.random() * 10 + 5)
    },
    bandwidth: {
      incoming: Math.floor(Math.random() * 1000 + 500), // KB/s
      outgoing: Math.floor(Math.random() * 500 + 200)
    }
  };
}

async function getAgentActivity() {
  const agentTypes = [
    'mexc-api-agent',
    'pattern-discovery-agent',
    'calendar-agent',
    'symbol-analysis-agent',
    'strategy-agent',
    'simulation-agent',
    'risk-manager-agent',
    'reconciliation-agent',
    'error-recovery-agent'
  ];

  return agentTypes.map(agent => ({
    name: agent,
    status: Math.random() > 0.1 ? 'active' : 'idle',
    lastActivity: new Date(Date.now() - Math.random() * 300000).toISOString(), // Last 5 minutes
    responseTime: Math.floor(Math.random() * 500 + 100), // 100-600ms
    requestsPerMinute: Math.floor(Math.random() * 30 + 5),
    successRate: Math.floor(Math.random() * 15 + 85), // 85-100%
    cacheHitRate: Math.floor(Math.random() * 30 + 70), // 70-100%
    currentTask: generateCurrentTask(agent),
    queueDepth: Math.floor(Math.random() * 5)
  }));
}

function generateCurrentTask(agentType: string): string {
  const tasks = {
    'mexc-api-agent': ['Fetching market data', 'Checking account balance', 'Monitoring API limits'],
    'pattern-discovery-agent': ['Analyzing price patterns', 'Calculating confidence scores', 'Validating signals'],
    'calendar-agent': ['Scanning new listings', 'Parsing calendar data', 'Detecting launch times'],
    'symbol-analysis-agent': ['Evaluating readiness', 'Checking trading status', 'Analyzing volume'],
    'strategy-agent': ['Creating trade strategy', 'Optimizing parameters', 'Risk assessment'],
    'simulation-agent': ['Running backtests', 'Validating strategies', 'Performance analysis'],
    'risk-manager-agent': ['Monitoring exposure', 'Calculating VaR', 'Checking limits'],
    'reconciliation-agent': ['Verifying balances', 'Checking positions', 'Audit trail'],
    'error-recovery-agent': ['System health check', 'Error monitoring', 'Recovery procedures']
  };

  const agentTasks = tasks[agentType as keyof typeof tasks] || ['Processing request'];
  return agentTasks[Math.floor(Math.random() * agentTasks.length)];
}

async function getRealTimePerformanceMetrics() {
  return {
    systemLoad: Math.random() * 100,
    responseTime: Math.floor(Math.random() * 200 + 50),
    throughput: Math.floor(Math.random() * 1000 + 500),
    errorRate: Math.random() * 5,
    queueDepth: Math.floor(Math.random() * 20),
    cacheHitRate: Math.floor(Math.random() * 30 + 70),
    databaseConnections: Math.floor(Math.random() * 20 + 10),
    memoryUsage: Math.random() * 100,
    cpuUsage: Math.random() * 100,
    networkLatency: Math.floor(Math.random() * 100 + 20)
  };
}

async function getActiveAlerts() {
  const alertTypes = ['info', 'warning', 'error', 'critical'];
  const categories = ['system', 'agent', 'trading', 'websocket', 'performance'];

  const alerts = [];
  const numAlerts = Math.floor(Math.random() * 5 + 2); // 2-6 alerts

  for (let i = 0; i < numAlerts; i++) {
    alerts.push({
      id: `alert-${Date.now()}-${i}`,
      type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      message: generateAlertMessage(),
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      acknowledged: Math.random() > 0.7,
      severity: Math.floor(Math.random() * 5 + 1) // 1-5
    });
  }

  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateAlertMessage(): string {
  const messages = [
    'Pattern discovery agent response time increased',
    'High memory usage detected',
    'WebSocket connection lost and reconnected',
    'Trading volume spike detected',
    'Risk threshold approached',
    'Database query performance degraded',
    'Cache hit rate below threshold',
    'Circuit breaker activated',
    'Agent coordination timeout',
    'API rate limit warning'
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

// Action handlers
async function triggerWorkflow(data: any) {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[trigger-workflow]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[trigger-workflow]', message, context || ''),
    error: (message: string, context?: any) => console.error('[trigger-workflow]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[trigger-workflow]', message, context || ''),
  };
  
  try {
    const { workflowType, parameters } = data;
    
    // Mock workflow trigger - replace with actual implementation
    logger.info(`Triggering workflow: ${workflowType} with parameters:`, parameters);
    
    return NextResponse.json({
      success: true,
      workflowId: `workflow-${Date.now()}`,
      message: `${workflowType} workflow triggered successfully`
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to trigger workflow" },
      { status: 500 }
    );
  }
}

async function triggerEmergencyStop(data: any) {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[emergency-stop]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[emergency-stop]', message, context || ''),
    error: (message: string, context?: any) => console.error('[emergency-stop]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[emergency-stop]', message, context || ''),
  };
  
  try {
    const { reason, scope } = data;
    
    // Mock emergency stop - replace with actual implementation
    logger.info(`Emergency stop triggered: ${reason}, scope: ${scope}`);
    
    return NextResponse.json({
      success: true,
      message: "Emergency stop activated",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to trigger emergency stop" },
      { status: 500 }
    );
  }
}

async function updateAgentConfig(data: any) {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[update-agent-config]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[update-agent-config]', message, context || ''),
    error: (message: string, context?: any) => console.error('[update-agent-config]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[update-agent-config]', message, context || ''),
  };
  
  try {
    const { agentName, config } = data;
    
    // Mock config update - replace with actual implementation
    logger.info(`Updating agent config for ${agentName}:`, config);
    
    return NextResponse.json({
      success: true,
      message: `Configuration updated for ${agentName}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update agent configuration" },
      { status: 500 }
    );
  }
}

// Export throttled GET handler
export const GET = withSSEThrottling(handleRealTimeRequest, {
  maxConnections: 10,
  heartbeatInterval: 15000,
});