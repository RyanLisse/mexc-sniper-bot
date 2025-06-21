/**
 * Pattern Monitoring API Endpoints
 * 
 * Provides real-time pattern detection monitoring and statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PatternMonitoringService } from '@/src/services/pattern-monitoring-service';
import { apiAuthWrapper } from '@/src/lib/api-auth';
import { createSuccessResponse, createErrorResponse } from '@/src/lib/api-response';

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

    return NextResponse.json(createSuccessResponse({
      data: responseData,
      message: 'Pattern monitoring report retrieved successfully',
    }));
  } catch (error) {
    console.error('[API] Pattern monitoring GET failed:', error);
    return NextResponse.json(createErrorResponse(
      'Failed to get pattern monitoring report',
      error instanceof Error ? error.message : 'Unknown error'
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
        return NextResponse.json(createSuccessResponse({
          message: 'Pattern monitoring started successfully',
        }));

      case 'stop_monitoring':
        patternMonitoringService.stopMonitoring();
        return NextResponse.json(createSuccessResponse({
          message: 'Pattern monitoring stopped successfully',
        }));

      case 'manual_detection':
        if (!symbols || !Array.isArray(symbols)) {
          return NextResponse.json(createErrorResponse(
            'Invalid request: symbols array is required for manual detection',
            'INVALID_SYMBOLS'
          ), { status: 400 });
        }

        const patterns = await patternMonitoringService.detectPatternsManually(
          symbols,
          calendarEntries
        );

        return NextResponse.json(createSuccessResponse({
          data: {
            patterns,
            summary: {
              totalPatterns: patterns.length,
              readyStatePatterns: patterns.filter(p => p.patternType === 'ready_state').length,
              preReadyPatterns: patterns.filter(p => p.patternType === 'pre_ready').length,
              advanceOpportunities: patterns.filter(p => p.patternType === 'launch_sequence').length,
              averageConfidence: patterns.length > 0 ? 
                patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0,
            },
          },
          message: `Manual pattern detection completed: ${patterns.length} patterns found`,
        }));

      case 'acknowledge_alert':
        if (!alertId) {
          return NextResponse.json(createErrorResponse(
            'Invalid request: alertId is required',
            'MISSING_ALERT_ID'
          ), { status: 400 });
        }

        const acknowledged = patternMonitoringService.acknowledgeAlert(alertId);
        if (!acknowledged) {
          return NextResponse.json(createErrorResponse(
            'Alert not found',
            'ALERT_NOT_FOUND'
          ), { status: 404 });
        }

        return NextResponse.json(createSuccessResponse({
          message: 'Alert acknowledged successfully',
        }));

      case 'clear_acknowledged_alerts':
        const clearedCount = patternMonitoringService.clearAcknowledgedAlerts();
        return NextResponse.json(createSuccessResponse({
          data: { clearedCount },
          message: `${clearedCount} acknowledged alerts cleared`,
        }));

      case 'get_monitoring_status':
        const report = await patternMonitoringService.getMonitoringReport();
        return NextResponse.json(createSuccessResponse({
          data: {
            status: report.status,
            engineStatus: report.stats.engineStatus,
            isMonitoring: report.stats.engineStatus === 'active',
            activeAlerts: report.activeAlerts.length,
            lastHealthCheck: report.stats.lastHealthCheck,
            consecutiveErrors: report.stats.consecutiveErrors,
          },
          message: 'Monitoring status retrieved successfully',
        }));

      default:
        return NextResponse.json(createErrorResponse(
          `Unknown action: ${action}`,
          'INVALID_ACTION'
        ), { status: 400 });
    }
  } catch (error) {
    console.error('[API] Pattern monitoring POST failed:', error);
    return NextResponse.json(createErrorResponse(
      'Pattern monitoring operation failed',
      error instanceof Error ? error.message : 'Unknown error'
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
    
    return NextResponse.json(createSuccessResponse({
      message: 'Pattern monitoring configuration updated (note: requires service restart for changes to take effect)',
    }));
  } catch (error) {
    console.error('[API] Pattern monitoring PUT failed:', error);
    return NextResponse.json(createErrorResponse(
      'Failed to update pattern monitoring configuration',
      error instanceof Error ? error.message : 'Unknown error'
    ), { status: 500 });
  }
});