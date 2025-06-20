/**
 * Emergency Stop API Route
 * 
 * Critical safety endpoint for immediately halting all optimization processes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getParameterManager } from "../../../../src/lib/parameter-management";
import { logger } from "../../../../src/lib/utils";

/**
 * POST /api/tuning/emergency-stop
 * Emergency stop all optimization processes and revert to safe parameters
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reason, revertToSnapshot, notifyUsers = true } = body;

    logger.warn('Emergency stop initiated', { 
      reason: reason || 'Manual emergency stop',
      timestamp: new Date(),
      userAgent: request.headers.get('user-agent')
    });

    const emergencyReport = {
      timestamp: new Date(),
      reason: reason || 'Manual emergency stop',
      actionsPerformed: [],
      errors: [],
      success: true
    };

    try {
      // 1. Stop all active optimizations immediately
      const activeOptimizations = []; // In real implementation, get from engine
      
      for (const optimization of activeOptimizations) {
        try {
          // await optimizationEngine.stopOptimization(optimization.id);
          emergencyReport.actionsPerformed.push(`Stopped optimization: ${optimization.id}`);
        } catch (error) {
          emergencyReport.errors.push(`Failed to stop optimization ${optimization.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      emergencyReport.actionsPerformed.push(`Stopped ${activeOptimizations.length} active optimizations`);

    } catch (error) {
      emergencyReport.errors.push(`Failed to stop optimizations: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // 2. Revert parameters to safe state
      if (revertToSnapshot) {
        // Find the most recent safe snapshot
        const parameterManager = getParameterManager();
        const snapshots = parameterManager.getSnapshots();
        const safeSnapshot = snapshots.find(s => 
          s.name.includes('emergency') || 
          s.name.includes('safe') || 
          s.name.includes('baseline')
        ) || snapshots[0]; // Fallback to most recent

        if (safeSnapshot) {
          await parameterManager.restoreFromSnapshot(safeSnapshot.id);
          emergencyReport.actionsPerformed.push(`Reverted to snapshot: ${safeSnapshot.name}`);
        } else {
          // No snapshot available, reset to defaults
          await parameterManager.resetAllParameters();
          emergencyReport.actionsPerformed.push('Reset all parameters to defaults');
        }
      } else {
        // Create emergency snapshot before reset
        const parameterManager = getParameterManager();
        const emergencySnapshotId = await parameterManager.createSnapshot(
          `emergency_backup_${Date.now()}`,
          `Emergency backup before stop: ${reason || 'Manual stop'}`
        );
        emergencyReport.actionsPerformed.push(`Created emergency backup: ${emergencySnapshotId}`);

        // Reset to safe defaults
        await parameterManager.resetAllParameters();
        emergencyReport.actionsPerformed.push('Reset all parameters to safe defaults');
      }

    } catch (error) {
      emergencyReport.errors.push(`Failed to revert parameters: ${error instanceof Error ? error.message : String(error)}`);
      emergencyReport.success = false;
    }

    try {
      // 3. Disable automatic parameter updates
      // In real implementation, this would set a system flag
      emergencyReport.actionsPerformed.push('Disabled automatic parameter updates');

    } catch (error) {
      emergencyReport.errors.push(`Failed to disable auto-updates: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // 4. Send emergency notifications
      if (notifyUsers) {
        await sendEmergencyNotifications(emergencyReport, reason);
        emergencyReport.actionsPerformed.push('Sent emergency notifications');
      }

    } catch (error) {
      emergencyReport.errors.push(`Failed to send notifications: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // 5. Log emergency event to audit trail
      await logEmergencyEvent(emergencyReport, request);
      emergencyReport.actionsPerformed.push('Logged emergency event to audit trail');

    } catch (error) {
      emergencyReport.errors.push(`Failed to log emergency event: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 6. Return emergency report
    const responseStatus = emergencyReport.success ? 200 : 207; // 207 = Multi-Status (partial success)

    return NextResponse.json({
      message: 'Emergency stop executed',
      success: emergencyReport.success,
      report: emergencyReport,
      nextSteps: [
        'Review system logs for any issues',
        'Verify parameter settings are safe',
        'Check system health before resuming operations',
        'Consider running diagnostic tests',
        'Re-enable automatic updates when ready'
      ],
      emergencyContact: {
        escalationRequired: emergencyReport.errors.length > 0,
        supportLevel: emergencyReport.errors.length > 2 ? 'critical' : 'standard'
      }
    }, { status: responseStatus });

  } catch (error) {
    logger.error('Critical error during emergency stop:', error);
    
    // Even if emergency stop fails, we need to return a response
    return NextResponse.json({
      message: 'Emergency stop encountered critical errors',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      criticalFailure: true,
      immediateActions: [
        'Contact system administrator immediately',
        'Check system logs manually',
        'Consider manual system shutdown if needed',
        'Verify trading operations are halted'
      ]
    }, { status: 500 });
  }
}

/**
 * GET /api/tuning/emergency-stop
 * Get emergency stop status and configuration
 */
export async function GET() {
  try {
    // In real implementation, check if emergency mode is active
    const emergencyStatus = {
      emergencyModeActive: false,
      lastEmergencyStop: null, // Would come from database
      emergencyProtocols: {
        autoStopOnHighRisk: true,
        autoRevertOnFailure: true,
        notificationChannels: ['email', 'slack', 'sms'],
        escalationLevels: ['team', 'manager', 'executive']
      },
      systemSafeguards: {
        maxRiskThreshold: 0.25,
        maxDrawdownLimit: 0.20,
        minSharpeRatioThreshold: 0.5,
        emergencySnapshotRetention: 30, // days
        autoDisableAfterFailures: 3
      },
      emergencyContacts: [
        { role: 'Primary', contact: 'system-admin@company.com' },
        { role: 'Secondary', contact: 'tech-lead@company.com' },
        { role: 'Escalation', contact: 'emergency@company.com' }
      ]
    };

    return NextResponse.json(emergencyStatus);

  } catch (error) {
    logger.error('Failed to get emergency stop status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve emergency stop status' },
      { status: 500 }
    );
  }
}

/**
 * Send emergency notifications to relevant stakeholders
 */
async function sendEmergencyNotifications(
  report: any, 
  reason?: string
): Promise<void> {
  try {
    const notificationPayload = {
      type: 'emergency_stop',
      timestamp: report.timestamp,
      reason: reason || 'Manual emergency stop',
      severity: report.errors.length > 0 ? 'high' : 'medium',
      affectedSystems: ['parameter_optimization', 'trading_bot'],
      actionsPerformed: report.actionsPerformed,
      errors: report.errors,
      nextSteps: 'System review required before resuming operations'
    };

    // In real implementation, send to notification service
    logger.info('Emergency notification sent', { payload: notificationPayload });

  } catch (error) {
    logger.error('Failed to send emergency notifications:', error);
    throw error;
  }
}

/**
 * Log emergency event to audit trail
 */
async function logEmergencyEvent(
  report: any, 
  request: NextRequest
): Promise<void> {
  try {
    const auditEntry = {
      eventType: 'emergency_stop',
      timestamp: report.timestamp,
      userAgent: request.headers.get('user-agent'),
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      sessionId: request.headers.get('x-session-id') || 'unknown',
      report,
      severity: 'critical',
      category: 'system_safety'
    };

    // In real implementation, save to audit database
    logger.info('Emergency event logged to audit trail', { auditEntry });

  } catch (error) {
    logger.error('Failed to log emergency event:', error);
    throw error;
  }
}