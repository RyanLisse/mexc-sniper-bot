/**
 * Real-time Safety Monitoring API Route
 * 
 * Provides endpoints for controlling and monitoring the real-time safety system.
 * Handles safety monitoring lifecycle, risk assessment, and alert management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiAuthWrapper } from '@/src/lib/api-auth';
import { createSuccessResponse, createErrorResponse } from '@/src/lib/api-response';
import { RealTimeSafetyMonitoringService, type SafetyConfiguration } from '@/src/services/risk/real-time-safety-monitoring-modules';

// Lazy service getter to avoid build-time initialization
function getSafetyMonitoringService() {
  return RealTimeSafetyMonitoringService.getInstance();
}

/**
 * GET /api/auto-sniping/safety-monitoring
 * Get safety monitoring data based on action parameter
 */
export const GET = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '10');

    console.info(`[SafetyMonitoringAPI] Processing GET action: ${action}`);

    const service = getSafetyMonitoringService();

    switch (action) {
      case 'status':
        const timerOperations = service.getTimerStatus();
        return NextResponse.json(createSuccessResponse({
          data: {
            isActive: service.getMonitoringStatus(),
            timerOperations,
            lastChecked: new Date().toISOString()
          }
        }));

      case 'report':
        const report = await service.getSafetyReport();
        return NextResponse.json(createSuccessResponse({
          data: report
        }));

      case 'risk-metrics':
        const riskMetrics = service.getRiskMetrics();
        return NextResponse.json(createSuccessResponse({
          data: {
            riskMetrics,
            timestamp: new Date().toISOString()
          }
        }));

      case 'alerts':
        const safetyReport = await service.getSafetyReport();
        let filteredAlerts = safetyReport.activeAlerts || [];
        
        // Filter by severity if specified
        if (severity && severity !== 'invalid_severity') {
          filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
        }
        
        // Apply limit
        const limitedAlerts = filteredAlerts.slice(0, limit);
        
        return NextResponse.json(createSuccessResponse({
          data: {
            alerts: limitedAlerts,
            totalCount: safetyReport.activeAlerts?.length || 0,
            filteredCount: filteredAlerts.length
          }
        }));

      case 'system-health':
        const healthReport = await service.getSafetyReport();
        return NextResponse.json(createSuccessResponse({
          data: {
            systemHealth: healthReport.systemHealth,
            overallRiskScore: healthReport.overallRiskScore,
            status: healthReport.status,
            recommendations: healthReport.recommendations,
            lastUpdated: healthReport.lastUpdated
          }
        }));

      case 'configuration':
        const config = service.getConfiguration();
        return NextResponse.json(createSuccessResponse({
          data: {
            configuration: config,
            isActive: service.getMonitoringStatus()
          }
        }));

      case 'check-safety':
        const isSafe = await service.isSystemSafe();
        const currentRiskMetrics = service.getRiskMetrics();
        const overallRiskScore = service.calculateOverallRiskScore();
        
        return NextResponse.json(createSuccessResponse({
          data: {
            isSafe,
            overallRiskScore,
            currentDrawdown: currentRiskMetrics.currentDrawdown,
            successRate: currentRiskMetrics.successRate,
            consecutiveLosses: currentRiskMetrics.consecutiveLosses
          }
        }));

      default:
        return NextResponse.json(createErrorResponse(
          `Invalid action parameter: ${action}`,
          { 
            code: 'INVALID_ACTION',
            supportedActions: [
              'status',
              'report', 
              'risk-metrics',
              'alerts',
              'system-health',
              'configuration',
              'check-safety'
            ]
          }
        ), { status: 400 });
    }
  } catch (error: any) {
    console.error('[SafetyMonitoringAPI] GET action failed:', { error });
    return NextResponse.json(createErrorResponse(
      'Safety monitoring GET action failed',
      { code: 'GET_ACTION_FAILED', details: error.message }
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
    const { action, configuration, thresholds, alertId, reason } = body;

    if (!action) {
      return NextResponse.json(createErrorResponse(
        'Action is required',
        { code: 'MISSING_ACTION' }
      ), { status: 400 });
    }

    console.info(`[SafetyMonitoringAPI] Processing POST action: ${action}`);

    const service = getSafetyMonitoringService();

    switch (action) {
      case 'start_monitoring':
        // Check if already active
        if (service.getMonitoringStatus()) {
          return NextResponse.json(createErrorResponse(
            'Safety monitoring is already active',
            { code: 'ALREADY_ACTIVE' }
          ), { status: 409 });
        }
        
        await service.startMonitoring();
        return NextResponse.json(createSuccessResponse({
          data: {
            message: 'Real-time safety monitoring started successfully',
            isActive: true,
            timestamp: new Date().toISOString()
          }
        }));

      case 'stop_monitoring':
        // Check if not active
        if (!service.getMonitoringStatus()) {
          return NextResponse.json(createErrorResponse(
            'Safety monitoring is not currently active',
            { code: 'NOT_ACTIVE' }
          ), { status: 409 });
        }
        
        service.stopMonitoring();
        return NextResponse.json(createSuccessResponse({
          data: {
            message: 'Real-time safety monitoring stopped successfully',
            isActive: false,
            timestamp: new Date().toISOString()
          }
        }));

      case 'update_configuration':
        if (!configuration) {
          return NextResponse.json(createErrorResponse(
            'Configuration is required for update action',
            { code: 'MISSING_CONFIGURATION' }
          ), { status: 400 });
        }
        
        service.updateConfiguration(configuration as Partial<SafetyConfiguration>);
        return NextResponse.json(createSuccessResponse({
          data: {
            message: 'Safety monitoring configuration updated successfully',
            updatedFields: Object.keys(configuration),
            timestamp: new Date().toISOString()
          }
        }));

      case 'update_thresholds':
        if (!thresholds) {
          return NextResponse.json(createErrorResponse(
            'Thresholds are required for update action',
            { code: 'MISSING_THRESHOLDS' }
          ), { status: 400 });
        }
        
        // Filter and validate thresholds - only accept valid numeric fields
        const validThresholdFields = [
          'maxDrawdownPercentage', 'maxDailyLossPercentage', 'maxPositionRiskPercentage',
          'maxPortfolioConcentration', 'minSuccessRatePercentage', 'maxConsecutiveLosses',
          'maxSlippagePercentage', 'maxApiLatencyMs', 'minApiSuccessRate',
          'maxMemoryUsagePercentage', 'minPatternConfidence', 'maxPatternDetectionFailures'
        ];
        
        const filteredThresholds: Record<string, number> = {};
        Object.entries(thresholds).forEach(([key, value]) => {
          if (validThresholdFields.includes(key) && typeof value === 'number') {
            filteredThresholds[key] = value;
          }
        });
        
        // Get current config and merge with new thresholds
        const currentConfig = service.getConfiguration();
        const updatedConfig = {
          ...currentConfig,
          thresholds: {
            ...currentConfig.thresholds,
            ...filteredThresholds
          }
        };
        
        service.updateConfiguration(updatedConfig);
        return NextResponse.json(createSuccessResponse({
          data: {
            message: 'Safety monitoring thresholds updated successfully',
            updatedThresholds: Object.keys(filteredThresholds),
            timestamp: new Date().toISOString()
          }
        }));

      case 'emergency_response':
        if (!reason) {
          return NextResponse.json(createErrorResponse(
            'Emergency reason is required',
            { code: 'MISSING_REASON' }
          ), { status: 400 });
        }
        
        const emergencyActions = await service.triggerEmergencyResponse(reason);
        return NextResponse.json(createSuccessResponse({
          data: {
            message: 'Emergency safety response triggered successfully',
            actionsExecuted: emergencyActions,
            reason,
            timestamp: new Date().toISOString()
          }
        }));

      case 'acknowledge_alert':
        if (!alertId) {
          return NextResponse.json(createErrorResponse(
            'Alert ID is required for acknowledgment',
            { code: 'MISSING_ALERT_ID' }
          ), { status: 400 });
        }
        
        const acknowledged = service.acknowledgeAlert(alertId);
        if (!acknowledged) {
          return NextResponse.json(createErrorResponse(
            'Alert not found or already acknowledged',
            { code: 'ALERT_NOT_FOUND' }
          ), { status: 404 });
        }
        
        return NextResponse.json(createSuccessResponse({
          data: {
            message: 'Alert acknowledged successfully',
            alertId,
            timestamp: new Date().toISOString()
          }
        }));

      case 'clear_acknowledged_alerts':
        const clearedCount = service.clearAcknowledgedAlerts();
        return NextResponse.json(createSuccessResponse({
          data: {
            message: `${clearedCount} acknowledged alerts cleared successfully`,
            clearedCount,
            timestamp: new Date().toISOString()
          }
        }));

      case 'force_risk_assessment':
        await service.performRiskAssessment();
        const currentRiskMetrics = service.getRiskMetrics();
        const overallRiskScore = service.calculateOverallRiskScore();
        
        return NextResponse.json(createSuccessResponse({
          data: {
            message: 'Forced risk assessment completed successfully',
            riskMetrics: currentRiskMetrics,
            overallRiskScore,
            timestamp: new Date().toISOString()
          }
        }));

      default:
        return NextResponse.json(createErrorResponse(
          `Invalid action: ${action}`,
          { 
            code: 'INVALID_ACTION',
            supportedActions: [
              'start_monitoring',
              'stop_monitoring',
              'update_configuration',
              'update_thresholds',
              'emergency_response',
              'acknowledge_alert',
              'clear_acknowledged_alerts',
              'force_risk_assessment'
            ]
          }
        ), { status: 400 });
    }
  } catch (error: any) {
    console.error('[SafetyMonitoringAPI] POST action failed:', { error });
    
    // Handle JSON parsing errors
    if (error.message?.includes('JSON')) {
      return NextResponse.json(createErrorResponse(
        'Invalid JSON in request body',
        { code: 'INVALID_JSON', details: error.message }
      ), { status: 400 });
    }
    
    return NextResponse.json(createErrorResponse(
      'Safety monitoring action failed',
      { code: 'ACTION_FAILED', details: error.message }
    ), { status: 500 });
  }
});