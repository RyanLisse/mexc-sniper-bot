import { createLogger } from '../../../../src/lib/structured-logger';

/**
 * Real-time Safety Monitoring API Route
 * 
 * Provides endpoints for controlling and monitoring the real-time safety system.
 * Handles safety monitoring lifecycle, risk assessment, and alert management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiAuthWrapper } from '@/src/lib/api-auth';
import { createSuccessResponse, createErrorResponse } from '@/src/lib/api-response';
import { RealTimeSafetyMonitoringService, type SafetyConfiguration } from '@/src/services/real-time-safety-monitoring-modules';

const logger = createLogger('route');

// Global service instance
const safetyMonitoringService = RealTimeSafetyMonitoringService.getInstance();

/**
 * GET /api/auto-sniping/safety-monitoring
 * Get comprehensive safety monitoring report
 */
export const GET = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeRecommendations = searchParams.get('include_recommendations') === 'true';
    const includeSystemHealth = searchParams.get('include_system_health') === 'true';

    logger.info('[SafetyMonitoringAPI] Fetching safety monitoring report...');
    
    const report = await safetyMonitoringService.getSafetyReport();
    
    // Filter response based on query parameters
    const responseData = {
      ...report,
      recommendations: includeRecommendations ? report.recommendations : undefined,
      systemHealth: includeSystemHealth ? report.systemHealth : undefined,
    };

    return NextResponse.json(createSuccessResponse({
      message: 'Safety monitoring report retrieved successfully',
      data: responseData,
      metadata: {
        monitoringActive: report.status !== 'safe' ? true : false,
        riskLevel: report.overallRiskScore,
        alertCount: report.activeAlerts.length,
        lastCheck: report.lastUpdated,
      }
    }));
  } catch (error: any) {
    logger.error('[SafetyMonitoringAPI] Failed to get safety report:', { error });
    return NextResponse.json(createErrorResponse(
      'Failed to retrieve safety monitoring report',
      { code: 'SAFETY_REPORT_ERROR', details: error.message }
    ), { status: 500 });
  }
});

/**
 * POST /api/auto-sniping/safety-monitoring
 * Handle safety monitoring actions
 */
export const POST = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action, configuration, alertId, reason } = body;

    logger.info(`[SafetyMonitoringAPI] Processing action: ${action}`);

    switch (action) {
      case 'start_monitoring':
        await safetyMonitoringService.startMonitoring();
        return NextResponse.json(createSuccessResponse({
          message: 'Real-time safety monitoring started successfully',
          data: { status: 'active', timestamp: new Date().toISOString() }
        }));

      case 'stop_monitoring':
        safetyMonitoringService.stopMonitoring();
        return NextResponse.json(createSuccessResponse({
          message: 'Real-time safety monitoring stopped successfully',
          data: { status: 'inactive', timestamp: new Date().toISOString() }
        }));

      case 'update_configuration':
        if (!configuration) {
          return NextResponse.json(createErrorResponse(
            'Configuration data is required for update action',
            { code: 'MISSING_CONFIGURATION' }
          ), { status: 400 });
        }
        
        safetyMonitoringService.updateConfiguration(configuration as Partial<SafetyConfiguration>);
        return NextResponse.json(createSuccessResponse({
          updatedFields: Object.keys(configuration),
          timestamp: new Date().toISOString()
        }, {
          message: 'Safety monitoring configuration updated successfully'
        }));

      case 'trigger_emergency_response':
        if (!reason) {
          return NextResponse.json(createErrorResponse(
            'Reason is required for emergency response',
            { code: 'MISSING_REASON' }
          ), { status: 400 });
        }
        
        const emergencyActions = await safetyMonitoringService.triggerEmergencyResponse(reason);
        return NextResponse.json(createSuccessResponse({ 
          actions: emergencyActions,
          timestamp: new Date().toISOString(),
          reason 
        }, {
          message: 'Emergency safety response triggered successfully'
        }));

      case 'acknowledge_alert':
        if (!alertId) {
          return NextResponse.json(createErrorResponse(
            'Alert ID is required for acknowledgment',
            { code: 'MISSING_ALERT_ID' }
          ), { status: 400 });
        }
        
        const acknowledged = safetyMonitoringService.acknowledgeAlert(alertId);
        if (!acknowledged) {
          return NextResponse.json(createErrorResponse(
            'Alert not found or already acknowledged',
            { code: 'ALERT_NOT_FOUND' }
          ), { status: 404 });
        }
        
        return NextResponse.json(createSuccessResponse(
          { alertId, timestamp: new Date().toISOString() },
          { message: 'Alert acknowledged successfully' }
        ));

      case 'clear_acknowledged_alerts':
        const clearedCount = safetyMonitoringService.clearAcknowledgedAlerts();
        return NextResponse.json(createSuccessResponse({
          message: `${clearedCount} acknowledged alerts cleared successfully`,
          data: { clearedCount, timestamp: new Date().toISOString() }
        }));

      case 'get_risk_metrics':
        const riskMetrics = safetyMonitoringService.getRiskMetrics();
        return NextResponse.json(createSuccessResponse({
          message: 'Risk metrics retrieved successfully',
          data: riskMetrics
        }));

      case 'check_system_safety':
        const isSystemSafe = await safetyMonitoringService.isSystemSafe();
        return NextResponse.json(createSuccessResponse({
          message: 'System safety status checked successfully',
          data: { 
            isSystemSafe,
            status: isSystemSafe ? 'safe' : 'at_risk',
            timestamp: new Date().toISOString()
          }
        }));

      default:
        return NextResponse.json(createErrorResponse(
          `Unknown action: ${action}`,
          { 
            code: 'INVALID_ACTION',
            supportedActions: [
              'start_monitoring',
              'stop_monitoring', 
              'update_configuration',
              'trigger_emergency_response',
              'acknowledge_alert',
              'clear_acknowledged_alerts',
              'get_risk_metrics',
              'check_system_safety'
            ]
          }
        ), { status: 400 });
    }
  } catch (error: any) {
    logger.error('[SafetyMonitoringAPI] Action failed:', { error });
    return NextResponse.json(createErrorResponse(
      'Safety monitoring action failed',
      { code: 'ACTION_FAILED', details: error.message }
    ), { status: 500 });
  }
});