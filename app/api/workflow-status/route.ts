import { NextRequest, NextResponse } from "next/server";
import { RATE_LIMIT_CONFIGS, withRateLimit } from "@/src/lib/api-rate-limiter";
import { 
  apiResponse, 
  createErrorResponse, 
  createSuccessResponse, 
  createValidationErrorResponse, 
  HTTP_STATUS
} from "@/src/lib/api-response";
import { withDatabaseQueryCache } from "@/src/lib/database-query-cache-middleware";
import { WorkflowStatusService } from "@/src/services/notification/workflow-status-service";

// Mock workflow definitions for frontend component compatibility
interface WorkflowDefinition {
  id: string;
  name: string;
  type: "event" | "scheduled";
  status: "running" | "stopped" | "error";
  lastRun?: string;
  nextRun?: string;
  schedule?: string;
  executionCount: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  description: string;
  trigger?: string;
}

const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: "poll-mexc-calendar",
    name: "MEXC Calendar Polling",
    type: "event",
    status: "running",
    lastRun: new Date(Date.now() - 300000).toISOString(),
    executionCount: 24,
    successCount: 23,
    errorCount: 1,
    avgDuration: 1500,
    description: "Monitors MEXC calendar for new token listings and trading opportunities",
    trigger: "mexc.calendar.updated",
  },
  {
    id: "watch-mexc-symbol",
    name: "Symbol Monitoring",
    type: "event",
    status: "running",
    lastRun: new Date(Date.now() - 120000).toISOString(),
    executionCount: 156,
    successCount: 154,
    errorCount: 2,
    avgDuration: 800,
    description: "Monitors specific symbols for trading signals and pattern detection",
    trigger: "mexc.symbol.ready",
  },
  {
    id: "analyze-mexc-patterns",
    name: "Pattern Analysis",
    type: "event",
    status: "running",
    lastRun: new Date(Date.now() - 180000).toISOString(),
    executionCount: 89,
    successCount: 87,
    errorCount: 2,
    avgDuration: 2100,
    description: "Analyzes market patterns and generates trading signals",
    trigger: "pattern.detected",
  },
  {
    id: "create-mexc-trading-strategy",
    name: "Strategy Creation",
    type: "event",
    status: "stopped",
    lastRun: new Date(Date.now() - 600000).toISOString(),
    executionCount: 12,
    successCount: 11,
    errorCount: 1,
    avgDuration: 3200,
    description: "Creates and validates trading strategies based on market analysis",
    trigger: "strategy.create",
  },
  {
    id: "scheduled-calendar-monitoring",
    name: "Scheduled Calendar Check",
    type: "scheduled",
    status: "running",
    schedule: "*/5 * * * *",
    nextRun: new Date(Date.now() + 180000).toISOString(),
    lastRun: new Date(Date.now() - 120000).toISOString(),
    executionCount: 288,
    successCount: 286,
    errorCount: 2,
    avgDuration: 1200,
    description: "Regularly checks MEXC calendar for new listings",
  },
  {
    id: "scheduled-pattern-analysis",
    name: "Scheduled Pattern Analysis",
    type: "scheduled",
    status: "running",
    schedule: "*/15 * * * *",
    nextRun: new Date(Date.now() + 420000).toISOString(),
    lastRun: new Date(Date.now() - 480000).toISOString(),
    executionCount: 96,
    successCount: 94,
    errorCount: 2,
    avgDuration: 4500,
    description: "Performs comprehensive pattern analysis on market data",
  },
  {
    id: "scheduled-health-check",
    name: "System Health Check",
    type: "scheduled",
    status: "running",
    schedule: "*/30 * * * *",
    nextRun: new Date(Date.now() + 900000).toISOString(),
    lastRun: new Date(Date.now() - 900000).toISOString(),
    executionCount: 48,
    successCount: 48,
    errorCount: 0,
    avgDuration: 2800,
    description: "Monitors system health and agent coordination",
  },
  {
    id: "scheduled-daily-report",
    name: "Daily Trading Report",
    type: "scheduled",
    status: "stopped",
    schedule: "0 9 * * *",
    nextRun: new Date(Date.now() + 82800000).toISOString(),
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    executionCount: 7,
    successCount: 7,
    errorCount: 0,
    avgDuration: 12000,
    description: "Generates comprehensive daily trading performance report",
  },
  {
    id: "scheduled-intensive-analysis",
    name: "Intensive Market Analysis",
    type: "scheduled",
    status: "running",
    schedule: "0 */2 * * *",
    nextRun: new Date(Date.now() + 3600000).toISOString(),
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    executionCount: 12,
    successCount: 12,
    errorCount: 0,
    avgDuration: 15000,
    description: "Deep analysis of market trends and pattern validation",
  },
  {
    id: "emergency-response-handler",
    name: "Emergency Response",
    type: "event",
    status: "stopped",
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    executionCount: 3,
    successCount: 3,
    errorCount: 0,
    avgDuration: 500,
    description: "Handles emergency trading situations and risk management",
    trigger: "emergency.detected",
  },
];

async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default";
    const workflowId = searchParams.get("workflowId");
    const includeMetrics = searchParams.get("includeMetrics") === "true";
    const format = searchParams.get("format") || "system"; // "system" (legacy) or "workflows" (new)

    // New workflow format for frontend component
    if (format === "workflows") {
      let workflows = [...WORKFLOW_DEFINITIONS];
      
      // Filter by specific workflow if requested
      if (workflowId) {
        workflows = workflows.filter(w => w.id === workflowId);
        if (workflows.length === 0) {
          return apiResponse(
            createErrorResponse("Workflow not found"),
            HTTP_STATUS.NOT_FOUND
          );
        }
      }

      // Add runtime metrics if requested
      const workflowsWithMetrics = workflows.map(workflow => {
        const baseWorkflow = { ...workflow };
        
        if (includeMetrics) {
          return {
            ...baseWorkflow,
            metrics: {
              successRate: workflow.executionCount > 0 
                ? (workflow.successCount / workflow.executionCount * 100).toFixed(1)
                : "0.0",
              errorRate: workflow.executionCount > 0 
                ? (workflow.errorCount / workflow.executionCount * 100).toFixed(1)
                : "0.0",
              avgDurationFormatted: `${(workflow.avgDuration / 1000).toFixed(1)}s`,
              lastRunFormatted: workflow.lastRun 
                ? new Date(workflow.lastRun).toLocaleString()
                : "Never",
              nextRunFormatted: "nextRun" in workflow && workflow.nextRun
                ? new Date(workflow.nextRun).toLocaleString()
                : "Not scheduled",
            }
          };
        }
        
        return baseWorkflow;
      });

      return apiResponse(
        createSuccessResponse(workflowsWithMetrics, {
          summary: {
            totalWorkflows: workflows.length,
            runningWorkflows: workflows.filter(w => w.status === "running").length,
            stoppedWorkflows: workflows.filter(w => w.status === "stopped").length,
            errorWorkflows: workflows.filter(w => w.status === "error").length,
            eventWorkflows: workflows.filter(w => w.type === "event").length,
            scheduledWorkflows: workflows.filter(w => w.type === "scheduled").length,
            totalExecutions: workflows.reduce((sum, w) => sum + w.executionCount, 0),
            totalSuccesses: workflows.reduce((sum, w) => sum + w.successCount, 0),
            totalErrors: workflows.reduce((sum, w) => sum + w.errorCount, 0),
            overallSuccessRate: workflows.reduce((sum, w) => sum + w.executionCount, 0) > 0
              ? ((workflows.reduce((sum, w) => sum + w.successCount, 0) / 
                  workflows.reduce((sum, w) => sum + w.executionCount, 0)) * 100).toFixed(1)
              : "0.0",
            lastUpdated: new Date().toISOString(),
          }
        })
      );
    }
    
    // Legacy system status format
    const statusService = new WorkflowStatusService(userId);
    const workflowStatus = await statusService.getFullStatus();
    
    return apiResponse(
      createSuccessResponse(workflowStatus)
    );
  } catch (error) {
    console.error("Failed to get workflow status:", { error: error });
    
    // Return a fallback status when database is unavailable
    const fallbackStatus = {
      systemStatus: "error",
      lastUpdate: new Date().toISOString(),
      activeWorkflows: [],
      metrics: {
        readyTokens: 0,
        totalDetections: 0,
        successfulSnipes: 0,
        totalProfit: 0,
        successRate: 0,
        averageROI: 0,
        bestTrade: 0,
      },
      recentActivity: [
        {
          id: "error",
          type: "analysis",
          message: "Database connection issue - using fallback mode",
          timestamp: new Date().toISOString(),
          level: "error",
        }
      ],
    };
    
    return apiResponse(
      createErrorResponse("Database connection issue - using fallback mode", {
        fallbackData: fallbackStatus
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

async function postHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data, userId = "default", workflowId, status } = body;

    // Handle workflow-specific actions for frontend component
    if (workflowId && action) {
      const workflow = WORKFLOW_DEFINITIONS.find(w => w.id === workflowId);
      if (!workflow) {
        return apiResponse(
          createErrorResponse("Workflow not found"),
          HTTP_STATUS.NOT_FOUND
        );
      }

      // Update workflow status
      switch (action) {
        case "start":
          workflow.status = "running";
          break;
        case "stop":
          workflow.status = "stopped";
          break;
        case "restart":
          workflow.status = "running";
          workflow.lastRun = new Date().toISOString();
          break;
        default:
          return apiResponse(
            createValidationErrorResponse('action', 'Invalid action for workflow'),
            HTTP_STATUS.BAD_REQUEST
          );
      }

      return apiResponse(
        createSuccessResponse({
          workflowId,
          previousStatus: workflow.status,
          newStatus: workflow.status,
          message: `Workflow ${workflowId} ${action} successfully`,
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Legacy system status handling
    const statusService = new WorkflowStatusService(userId);
    let updatedStatus;

    switch (action) {
      case "start":
        updatedStatus = await statusService.updateSystemStatus("running");
        await statusService.addActivity({
          type: "analysis",
          message: "System started - monitoring active",
          level: "success"
        });
        break;

      case "stop":
        updatedStatus = await statusService.updateSystemStatus("stopped");
        await statusService.addActivity({
          type: "analysis",
          message: "System stopped",
          level: "info"
        });
        break;

      case "updateMetrics":
        if (data?.metrics) {
          updatedStatus = await statusService.updateMetrics(data.metrics);
        } else {
          return apiResponse(
            createValidationErrorResponse('metrics', 'Metrics data required for updateMetrics action'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        break;

      case "addActivity":
        if (data?.activity) {
          await statusService.addActivity(data.activity);
          updatedStatus = await statusService.getOrCreateSystemStatus();
        } else {
          return apiResponse(
            createValidationErrorResponse('activity', 'Activity data required for addActivity action'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        break;

      case "addWorkflow":
        if (data?.workflowId) {
          updatedStatus = await statusService.updateActiveWorkflows("add", data.workflowId);
        } else {
          return apiResponse(
            createValidationErrorResponse('workflowId', 'Workflow ID required for addWorkflow action'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        break;

      case "removeWorkflow":
        if (data?.workflowId) {
          updatedStatus = await statusService.updateActiveWorkflows("remove", data.workflowId);
        } else {
          return apiResponse(
            createValidationErrorResponse('workflowId', 'Workflow ID required for removeWorkflow action'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        break;

      default:
        return apiResponse(
          createValidationErrorResponse('action', `Unknown action: ${action}`),
          HTTP_STATUS.BAD_REQUEST
        );
    }

    // Get full status for response
    const fullStatus = await statusService.getFullStatus();

    return apiResponse(
      createSuccessResponse(fullStatus, {
        message: `Action '${action}' completed successfully`
      })
    );
  } catch (error) {
    console.error("Failed to update workflow status:", { error: error });
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// Export rate-limited and cached handlers
export const GET = withRateLimit(
  withDatabaseQueryCache(getHandler, {
    endpoint: "/api/workflow-status",
    cacheTtlSeconds: 180, // 3 minutes cache
    enableCompression: true,
    enableStaleWhileRevalidate: true,
  }),
  RATE_LIMIT_CONFIGS.moderate
);

export const POST = withRateLimit(
  withDatabaseQueryCache(postHandler, {
    endpoint: "/api/workflow-status",
    cacheTtlSeconds: 30, // 30 seconds cache for updates
    enableCompression: true,
    enableStaleWhileRevalidate: false,
  }),
  RATE_LIMIT_CONFIGS.moderate
);