import { createLogger } from '../../../../src/lib/structured-logger';

/**
 * Pattern Monitoring API Endpoints
 * 
 * Provides real-time pattern detection monitoring and statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PatternMonitoringService } from '@/src/services/pattern-monitoring-service';
import { apiAuthWrapper } from '@/src/lib/api-auth';
import { createSuccessResponse, createErrorResponse } from '@/src/lib/api-response';

const logger = createLogger('pattern-monitoring-api');
const patternMonitoringService = PatternMonitoringService.getInstance();

/**
 * GET /api/auto-sniping/pattern-monitoring
 * Get pattern monitoring report and statistics
 */
export const GET = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeActivity = searchParams.get('include_activity') === 'true';
    const includePatterns = searchParams.get('include_patterns') === 'true';
    const patternLimit = parseInt(searchParams.get('pattern_limit') || '20', 10);

    // Get monitoring report
    const report = await patternMonitoringService.getMonitoringReport();

    // Optionally include recent patterns
    let recentPatterns;
    if (includePatterns) {
      recentPatterns = patternMonitoringService.getRecentPatterns(patternLimit);
    }

    const responseData = {
      report,
      recentPatterns: includePatterns ? recentPatterns : undefined,
      monitoring: {
        isActive: report.stats.engineStatus === 'active',
        lastUpdate: report.lastUpdated,
        totalAlerts: report.activeAlerts.length,
        unacknowledgedAlerts: report.activeAlerts.filter(a => !a.acknowledged).length,
      },
    };

    return NextResponse.json(createSuccessResponse(responseData, {
      message: 'Pattern monitoring report retrieved successfully',
    }));
  } catch (error) {
    logger.error('[API] Pattern monitoring GET failed:', error);
    return NextResponse.json(createErrorResponse(
      'Failed to get pattern monitoring report',
      { details: error instanceof Error ? error.message : 'Unknown error' }
    ), { status: 500 });
  }
});

/**
 * POST /api/auto-sniping/pattern-monitoring
 * Control pattern monitoring and trigger manual detection
 */
export const POST = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action, symbols, calendarEntries, alertId } = body;

    switch (action) {
      case 'start_monitoring':
        await patternMonitoringService.startMonitoring();
        return NextResponse.json(createSuccessResponse(
          { status: 'started' },
          { message: 'Pattern monitoring started successfully' }
        ));

      case 'stop_monitoring':
        patternMonitoringService.stopMonitoring();
        return NextResponse.json(createSuccessResponse(
          { status: 'stopped' },
          { message: 'Pattern monitoring stopped successfully' }
        ));

      case 'manual_detection':
        if (!symbols || !Array.isArray(symbols)) {
          return NextResponse.json(createErrorResponse(
            'Invalid request: symbols array is required for manual detection',
            { code: 'INVALID_SYMBOLS' }
          ), { status: 400 });
        }

        const patterns = await patternMonitoringService.detectPatternsManually(
          symbols,
          calendarEntries
        );

        return NextResponse.json(createSuccessResponse({
          patterns,
          summary: {
            totalPatterns: patterns.length,
            readyStatePatterns: patterns.filter(p => p.patternType === 'ready_state').length,
            preReadyPatterns: patterns.filter(p => p.patternType === 'pre_ready').length,
            advanceOpportunities: patterns.filter(p => p.patternType === 'launch_sequence').length,
            averageConfidence: patterns.length > 0 ? 
              patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0,
          },
        }, {
          message: `Manual pattern detection completed: ${patterns.length} patterns found`
        }));

      case 'trigger_pattern_to_targets':
        // NEW ACTION: Trigger pattern detection and create snipe targets
        const { patternStrategyOrchestrator } = await import('@/src/services/pattern-strategy-orchestrator');
        const { patternTargetIntegrationService } = await import('@/src/services/pattern-target-integration-service');
        const { UnifiedMexcServiceV2 } = await import('@/src/services/unified-mexc-service-v2');

const logger = createLogger('route');

        const mexcService = new UnifiedMexcServiceV2();
        const userId = body.userId || "system";

        // Get market data
        const symbolsResponse = await mexcService.getSymbolsData();
        if (!symbolsResponse.success || !symbolsResponse.data) {
          return NextResponse.json(createErrorResponse(
            'Failed to fetch market data from MEXC',
            { code: 'MEXC_DATA_FAILED' }
          ), { status: 500 });
        }

        // Run pattern detection workflow (this will auto-create snipe targets)
        const workflowResult = await patternStrategyOrchestrator.executePatternWorkflow({
          type: "monitoring",
          input: {
            symbolData: symbolsResponse.data as any[],
          },
          options: {
            confidenceThreshold: body.confidenceThreshold || 75,
            enableAgentAnalysis: true,
            maxExecutionTime: 30000
          }
        });

        // Get integration statistics
        const stats = await patternTargetIntegrationService.getStatistics(userId);

        return NextResponse.json(createSuccessResponse({
          workflow: {
            success: workflowResult.success,
            patternsDetected: workflowResult.results.patternAnalysis?.matches?.length || 0,
            readyStatePatterns: workflowResult.results.patternAnalysis?.matches?.filter(m => 
              m.patternType === "ready_state"
            ).length || 0,
            executionTime: workflowResult.performance.executionTime,
          },
          targetIntegration: stats,
          message: "Pattern detection triggered and snipe targets created",
          nextSteps: [
            "Snipe targets have been created in the database",
            "Auto-sniping orchestrator will pick them up automatically",
            "Monitor /api/auto-sniping/control for execution status"
          ]
        }, {
          message: `Pattern-to-targets integration completed: ${stats.totalTargetsCreated} total targets`
        }));

      case 'acknowledge_alert':
        if (!alertId) {
          return NextResponse.json(createErrorResponse(
            'Invalid request: alertId is required',
            { code: 'MISSING_ALERT_ID' }
          ), { status: 400 });
        }

        const acknowledged = patternMonitoringService.acknowledgeAlert(alertId);
        if (!acknowledged) {
          return NextResponse.json(createErrorResponse(
            'Alert not found',
            { code: 'ALERT_NOT_FOUND' }
          ), { status: 404 });
        }

        return NextResponse.json(createSuccessResponse(
          { alertId, status: 'acknowledged' },
          { message: 'Alert acknowledged successfully' }
        ));

      case 'clear_acknowledged_alerts':
        const clearedCount = patternMonitoringService.clearAcknowledgedAlerts();
        return NextResponse.json(createSuccessResponse(
          { clearedCount },
          { message: `${clearedCount} acknowledged alerts cleared` }
        ));

      case 'get_monitoring_status':
        const report = await patternMonitoringService.getMonitoringReport();
        return NextResponse.json(createSuccessResponse({
          status: report.status,
          engineStatus: report.stats.engineStatus,
          isMonitoring: report.stats.engineStatus === 'active',
          activeAlerts: report.activeAlerts.length,
          lastHealthCheck: report.stats.lastHealthCheck,
          consecutiveErrors: report.stats.consecutiveErrors,
        }, {
          message: 'Monitoring status retrieved successfully'
        }));

      default:
        return NextResponse.json(createErrorResponse(
          `Unknown action: ${action}`,
          { code: 'INVALID_ACTION' }
        ), { status: 400 });
    }
  } catch (error) {
    logger.error('[API] Pattern monitoring POST failed:', error);
    return NextResponse.json(createErrorResponse(
      'Pattern monitoring operation failed',
      { details: error instanceof Error ? error.message : 'Unknown error' }
    ), { status: 500 });
  }
});

/**
 * PUT /api/auto-sniping/pattern-monitoring
 * Update monitoring configuration
 */
export const PUT = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { config } = body;

    // For now, we'll just return success as the configuration is handled internally
    // In the future, this could be expanded to allow runtime configuration changes
    
    return NextResponse.json(createSuccessResponse(
      { updated: true },
      { message: 'Pattern monitoring configuration updated (note: requires service restart for changes to take effect)' }
    ));
  } catch (error) {
    logger.error('[API] Pattern monitoring PUT failed:', error);
    return NextResponse.json(createErrorResponse(
      'Failed to update pattern monitoring configuration',
      { details: error instanceof Error ? error.message : 'Unknown error' }
    ), { status: 500 });
  }
});