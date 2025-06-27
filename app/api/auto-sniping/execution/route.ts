/**
 * Auto-Sniping Execution API Endpoints
 * 
 * Provides control and monitoring for auto-sniping trade execution.
 * Enhanced with OpenTelemetry instrumentation for comprehensive monitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
// Using simple console logger to avoid webpack bundling issues
import { getCoreTrading } from '@/src/services/trading/consolidated/core-trading/base-service';
import { apiAuthWrapper } from '@/src/lib/api-auth';
import { apiResponse, createSuccessResponse, createErrorResponse } from '@/src/lib/api-response';
import { instrumentedTradingRoute } from '@/src/lib/opentelemetry-api-middleware';

function getExecutionService() {
  return getCoreTrading();
}

/**
 * GET /api/auto-sniping/execution
 * Get execution status and report
 */
export const GET = instrumentedTradingRoute(
  apiAuthWrapper(async (request: NextRequest) => {
  // Build-safe logger - simple console implementation
  const logger = {
    info: (message: string, context?: any) => console.info('[auto-sniping-execution]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[auto-sniping-execution]', message, context || ''),
    error: (message: string, context?: any) => console.error('[auto-sniping-execution]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[auto-sniping-execution]', message, context || ''),
  };
  
  try {
    const { searchParams } = new URL(request.url);
    const includePositions = searchParams.get('include_positions') === 'true';
    const includeHistory = searchParams.get('include_history') === 'true';
    const includeAlerts = searchParams.get('include_alerts') === 'true';

    // Get execution report
    const report = await getExecutionService().getExecutionReport();

    const responseData = {
      report: {
        ...report,
        activePositions: includePositions ? report.activePositions : [],
        recentExecutions: includeHistory ? report.recentExecutions : [],
        activeAlerts: includeAlerts ? report.activeAlerts : [],
      },
      execution: {
        isActive: report.status === 'active',
        status: report.status,
        activePositionsCount: report.activeTargets || 0,
        totalPnl: report.totalProfit || 0,
        successRate: report.successRate || 0,
        dailyTrades: report.executedToday || 0,
      },
    };

    return NextResponse.json(createSuccessResponse(responseData, {
      message: 'Execution report retrieved successfully',
    }));
  } catch (error) {
    console.error('[API] Auto-sniping execution GET failed:', { error });
    return NextResponse.json(createErrorResponse(
      'Failed to get execution report',
      { 
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    ), { status: 500 });
  }
}),
'sniping' // operationType for OpenTelemetry spans
);

/**
 * POST /api/auto-sniping/execution
 * Control execution and manage positions
 */
export const POST = instrumentedTradingRoute(
  apiAuthWrapper(async (request: NextRequest) => {
  // Build-safe logger - simple console implementation
  const logger = {
    info: (message: string, context?: any) => console.info('[auto-sniping-execution]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[auto-sniping-execution]', message, context || ''),
    error: (message: string, context?: any) => console.error('[auto-sniping-execution]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[auto-sniping-execution]', message, context || ''),
  };
  
  try {
    const body = await request.json();
    const { action, positionId, reason, config } = body;

    switch (action) {
      case 'start_execution':
        try {
          await getExecutionService().startExecution();
          return NextResponse.json(createSuccessResponse(
            { status: 'started' },
            { message: 'Auto-sniping execution started successfully' }
          ));
        } catch (error) {
          return NextResponse.json(createErrorResponse(
            'Failed to start execution',
            { details: error instanceof Error ? error.message : 'Unknown error' }
          ), { status: 400 });
        }

      case 'stop_execution':
        getExecutionService().stopExecution();
        return NextResponse.json(createSuccessResponse(
          { status: 'stopped' },
          { message: 'Auto-sniping execution stopped successfully' }
        ));

      case 'pause_execution':
        getExecutionService().pauseExecution();
        return NextResponse.json(createSuccessResponse(
          { status: 'paused' },
          { message: 'Auto-sniping execution paused successfully' }
        ));

      case 'resume_execution':
        try {
          await getExecutionService().resumeExecution();
          return NextResponse.json(createSuccessResponse(
            { status: 'resumed' },
            { message: 'Auto-sniping execution resumed successfully' }
          ));
        } catch (error) {
          return NextResponse.json(createErrorResponse(
            'Failed to resume execution',
            { details: error instanceof Error ? error.message : 'Unknown error' }
          ), { status: 400 });
        }

      case 'close_position':
        if (!positionId) {
          return NextResponse.json(createErrorResponse(
            'Invalid request: positionId is required',
            { code: 'MISSING_POSITION_ID' }
          ), { status: 400 });
        }

        try {
          const success = await getExecutionService().closePosition(positionId);
          if (!success) {
            return NextResponse.json(createErrorResponse(
              'Failed to close position',
              { code: 'POSITION_CLOSE_FAILED' }
            ), { status: 400 });
          }

          return NextResponse.json(createSuccessResponse(
            { positionId, status: 'closed' },
            { message: `Position ${positionId} closed successfully` }
          ));
        } catch (error) {
          return NextResponse.json(createErrorResponse(
            'Failed to close position',
            { details: error instanceof Error ? error.message : 'Unknown error' }
          ), { status: 500 });
        }

      case 'emergency_close_all':
        try {
          const closedCount = await getExecutionService().emergencyCloseAll();
          return NextResponse.json(createSuccessResponse(
            { closedCount },
            { message: `Emergency close completed: ${closedCount} positions closed` }
          ));
        } catch (error) {
          return NextResponse.json(createErrorResponse(
            'Emergency close failed',
            { details: error instanceof Error ? error.message : 'Unknown error' }
          ), { status: 500 });
        }

      case 'get_active_positions':
        const activePositions = getExecutionService().getActivePositions();
        return NextResponse.json(createSuccessResponse(
          { positions: activePositions },
          { message: `Retrieved ${activePositions.length} active positions` }
        ));

      case 'acknowledge_alert':
        if (!body.alertId) {
          return NextResponse.json(createErrorResponse(
            'Invalid request: alertId is required',
            { code: 'MISSING_ALERT_ID' }
          ), { status: 400 });
        }

        const acknowledged = getExecutionService().acknowledgeAlert(body.alertId);
        if (!acknowledged) {
          return NextResponse.json(createErrorResponse(
            'Alert not found',
            { code: 'ALERT_NOT_FOUND' }
          ), { status: 404 });
        }

        return NextResponse.json(createSuccessResponse(
          { alertId: body.alertId, status: 'acknowledged' },
          { message: 'Alert acknowledged successfully' }
        ));

      case 'clear_acknowledged_alerts':
        const clearedCount = getExecutionService().clearAcknowledgedAlerts();
        return NextResponse.json(createSuccessResponse(
          { clearedCount },
          { message: `${clearedCount} acknowledged alerts cleared` }
        ));

      case 'update_config':
        if (!config || typeof config !== 'object') {
          return NextResponse.json(createErrorResponse(
            'Invalid request: config object is required',
            { code: 'INVALID_CONFIG' }
          ), { status: 400 });
        }

        try {
          getExecutionService().updateConfig(config);
          return NextResponse.json(createSuccessResponse(
            { updated: true, configKeys: Object.keys(config) },
            { message: 'Configuration updated successfully' }
          ));
        } catch (error) {
          return NextResponse.json(createErrorResponse(
            'Failed to update configuration',
            { details: error instanceof Error ? error.message : 'Unknown error' }
          ), { status: 400 });
        }

      case 'get_execution_status':
        const report = await getExecutionService().getExecutionReport();
        return NextResponse.json(createSuccessResponse({
          status: report.status,
          isActive: report.status === 'active',
          activePositions: report.activeTargets || 0,
          totalTrades: report.totalTrades,
          successRate: report.successRate,
          totalPnl: report.totalProfit,
          systemHealth: report.systemHealth,
          lastUpdated: report.lastExecution,
        }, {
          message: 'Execution status retrieved successfully'
        }));

      default:
        return NextResponse.json(createErrorResponse(
          `Unknown action: ${action}`,
          { code: 'INVALID_ACTION' }
        ), { status: 400 });
    }
  } catch (error) {
    console.error('[API] Auto-sniping execution POST failed:', { error });
    return NextResponse.json(createErrorResponse(
      'Execution operation failed',
      { details: error instanceof Error ? error.message : 'Unknown error' }
    ), { status: 500 });
  }
}),
'sniping' // operationType for OpenTelemetry spans
);

/**
 * PUT /api/auto-sniping/execution
 * Update execution configuration
 */
export const PUT = apiAuthWrapper(async (request: NextRequest) => {
  // Build-safe logger - initialize inside function
  try {
    const body = await request.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json(createErrorResponse(
        'Invalid request: config object is required',
        { code: 'INVALID_CONFIG' }
      ), { status: 400 });
    }

    // Validate critical config values
    if (config.maxPositions !== undefined && (config.maxPositions < 1 || config.maxPositions > 50)) {
      return NextResponse.json(createErrorResponse(
        'Invalid maxPositions: must be between 1 and 50',
        { code: 'INVALID_CONFIG_VALUE', field: 'maxPositions' }
      ), { status: 400 });
    }

    if (config.minConfidence !== undefined && (config.minConfidence < 0 || config.minConfidence > 100)) {
      return NextResponse.json(createErrorResponse(
        'Invalid minConfidence: must be between 0 and 100',
        { code: 'INVALID_CONFIG_VALUE', field: 'minConfidence' }
      ), { status: 400 });
    }

    if (config.positionSizeUSDT !== undefined && config.positionSizeUSDT <= 0) {
      return NextResponse.json(createErrorResponse(
        'Invalid positionSizeUSDT: must be greater than 0',
        { code: 'INVALID_CONFIG_VALUE', field: 'positionSizeUSDT' }
      ), { status: 400 });
    }

    try {
      getExecutionService().updateConfig(config);
      
      return NextResponse.json(createSuccessResponse(
        { updatedFields: Object.keys(config) },
        { message: 'Execution configuration updated successfully' }
      ));
    } catch (error) {
      return NextResponse.json(createErrorResponse(
        'Failed to update configuration',
        { details: error instanceof Error ? error.message : 'Unknown error' }
      ), { status: 400 });
    }
  } catch (error) {
    console.error('[API] Auto-sniping execution PUT failed:', { error });
    return NextResponse.json(createErrorResponse(
      'Failed to update execution configuration',
      { details: error instanceof Error ? error.message : 'Unknown error' }
    ), { status: 500 });
  }
});

/**
 * DELETE /api/auto-sniping/execution
 * Emergency shutdown and cleanup
 */
export const DELETE = instrumentedTradingRoute(
  apiAuthWrapper(async (request: NextRequest) => {
    // Build-safe logger - initialize inside function
    try {
      console.info('[API] Emergency shutdown requested');
      
      // Stop execution
      getExecutionService().stopExecution();
      
      // Close all positions
      const closedCount = await getExecutionService().emergencyCloseAll();
      
      return NextResponse.json(createSuccessResponse(
        { closedPositions: closedCount },
        { message: `Emergency shutdown completed: ${closedCount} positions closed` }
      ));
    } catch (error) {
      console.error('[API] Emergency shutdown failed:', { error });
      return NextResponse.json(createErrorResponse(
        'Emergency shutdown failed',
        { details: error instanceof Error ? error.message : 'Unknown error' }
      ), { status: 500 });
    }
  }),
  'execution' // operationType for OpenTelemetry spans
);