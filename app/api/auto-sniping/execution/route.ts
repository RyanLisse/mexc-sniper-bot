/**
 * Auto-Sniping Execution API Endpoints
 * 
 * Provides control and monitoring for auto-sniping trade execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AutoSnipingExecutionService } from '@/src/services/auto-sniping-execution-service';
import { apiAuthWrapper } from '@/src/lib/api-auth';
import { createSuccessResponse, createErrorResponse } from '@/src/lib/api-response';

const executionService = AutoSnipingExecutionService.getInstance();

/**
 * GET /api/auto-sniping/execution
 * Get execution status and report
 */
export const GET = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const includePositions = searchParams.get('include_positions') === 'true';
    const includeHistory = searchParams.get('include_history') === 'true';
    const includeAlerts = searchParams.get('include_alerts') === 'true';

    // Get execution report
    const report = await executionService.getExecutionReport();

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
        activePositionsCount: report.activePositions.length,
        totalPnl: report.stats.totalPnl,
        successRate: report.stats.successRate,
        dailyTrades: report.stats.dailyTradeCount,
      },
    };

    return NextResponse.json(createSuccessResponse(responseData, {
      message: 'Execution report retrieved successfully',
    }));
  } catch (error) {
    console.error('[API] Auto-sniping execution GET failed:', error);
    return NextResponse.json(createErrorResponse(
      'Failed to get execution report',
      { 
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    ), { status: 500 });
  }
});

/**
 * POST /api/auto-sniping/execution
 * Control execution and manage positions
 */
export const POST = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action, positionId, reason, config } = body;

    switch (action) {
      case 'start_execution':
        try {
          await executionService.startExecution();
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
        executionService.stopExecution();
        return NextResponse.json(createSuccessResponse(
          { status: 'stopped' },
          { message: 'Auto-sniping execution stopped successfully' }
        ));

      case 'pause_execution':
        executionService.pauseExecution();
        return NextResponse.json(createSuccessResponse(
          { status: 'paused' },
          { message: 'Auto-sniping execution paused successfully' }
        ));

      case 'resume_execution':
        try {
          await executionService.resumeExecution();
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
          const success = await executionService.closePosition(positionId, reason || 'manual');
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
          const closedCount = await executionService.emergencyCloseAll();
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
        const activePositions = executionService.getActivePositions();
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

        const acknowledged = executionService.acknowledgeAlert(body.alertId);
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
        const clearedCount = executionService.clearAcknowledgedAlerts();
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
          executionService.updateConfig(config);
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
        const report = await executionService.getExecutionReport();
        return NextResponse.json(createSuccessResponse({
          status: report.status,
          isActive: report.status === 'active',
          activePositions: report.activePositions.length,
          totalTrades: report.stats.totalTrades,
          successRate: report.stats.successRate,
          totalPnl: report.stats.totalPnl,
          systemHealth: report.systemHealth,
          lastUpdated: report.lastUpdated,
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
    console.error('[API] Auto-sniping execution POST failed:', error);
    return NextResponse.json(createErrorResponse(
      'Execution operation failed',
      { details: error instanceof Error ? error.message : 'Unknown error' }
    ), { status: 500 });
  }
});

/**
 * PUT /api/auto-sniping/execution
 * Update execution configuration
 */
export const PUT = apiAuthWrapper(async (request: NextRequest) => {
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
      executionService.updateConfig(config);
      
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
    console.error('[API] Auto-sniping execution PUT failed:', error);
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
export const DELETE = apiAuthWrapper(async (request: NextRequest) => {
  try {
    console.log('[API] Emergency shutdown requested');
    
    // Stop execution
    executionService.stopExecution();
    
    // Close all positions
    const closedCount = await executionService.emergencyCloseAll();
    
    return NextResponse.json(createSuccessResponse(
      { closedPositions: closedCount },
      { message: `Emergency shutdown completed: ${closedCount} positions closed` }
    ));
  } catch (error) {
    console.error('[API] Emergency shutdown failed:', error);
    return NextResponse.json(createErrorResponse(
      'Emergency shutdown failed',
      { details: error instanceof Error ? error.message : 'Unknown error' }
    ), { status: 500 });
  }
});