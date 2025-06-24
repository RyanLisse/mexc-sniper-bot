import { NextRequest, NextResponse } from "next/server";
// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import { inngest } from "../../../../src/inngest/client";

export async function POST(request: NextRequest) {
  // Simple console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[schedule-control]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[schedule-control]', message, context || ''),
    error: (message: string, context?: any) => console.error('[schedule-control]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[schedule-control]', message, context || ''),
  };
  try {
    const body = await request.json();
    const { action, scheduleType, data } = body;

    switch (action) {
      case "start_monitoring":
        // Update system status to running
        await fetch('http://localhost:3008/api/workflow-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'start',
            data: { scheduledStart: true }
          }),
        });

        return NextResponse.json({
          success: true,
          message: "Scheduled monitoring started",
          schedules: {
            calendar: "Every 30 minutes",
            patterns: "Every 15 minutes", 
            health: "Every 5 minutes",
            intensive: "Every 2 hours",
            daily: "Daily at 9 AM UTC"
          }
        });

      case "stop_monitoring":
        await fetch('http://localhost:3008/api/workflow-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'stop',
            data: { scheduledStop: true }
          }),
        });

        return NextResponse.json({
          success: true,
          message: "Scheduled monitoring stopped"
        });

      case "trigger_emergency":
        // Trigger emergency response
        const emergencyEvent = await inngest.send({
          name: "mexc/emergency.detected",
          data: {
            emergencyType: data.type || "manual_trigger",
            severity: data.severity || "medium",
            data: data.additionalData || {},
            triggeredBy: "manual",
            timestamp: new Date().toISOString(),
          },
        });

        return NextResponse.json({
          success: true,
          message: "Emergency response triggered",
          eventId: emergencyEvent.ids[0],
          emergencyType: data.type
        });

      case "force_analysis":
        // Force immediate comprehensive analysis
        const calendarEvent = await inngest.send({
          name: "mexc/calendar.poll",
          data: {
            trigger: "manual_force",
            force: true,
            timestamp: new Date().toISOString(),
          },
        });

        const patternEvent = await inngest.send({
          name: "mexc/patterns.analyze",
          data: {
            symbols: data.symbols || [],
            analysisType: "discovery",
            trigger: "manual_force",
            timestamp: new Date().toISOString(),
          },
        });

        return NextResponse.json({
          success: true,
          message: "Forced analysis triggered",
          events: {
            calendar: calendarEvent.ids[0],
            patterns: patternEvent.ids[0]
          }
        });

      case "get_schedule_status":
        return NextResponse.json({
          success: true,
          schedules: {
            calendar_monitoring: {
              frequency: "*/30 * * * *",
              description: "Every 30 minutes",
              status: "active"
            },
            pattern_analysis: {
              frequency: "*/15 * * * *", 
              description: "Every 15 minutes",
              status: "active"
            },
            health_check: {
              frequency: "*/5 * * * *",
              description: "Every 5 minutes",
              status: "active"
            },
            intensive_analysis: {
              frequency: "0 */2 * * *",
              description: "Every 2 hours",
              status: "active"
            },
            daily_report: {
              frequency: "0 9 * * *",
              description: "Daily at 9 AM UTC",
              status: "active"
            }
          }
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Unknown action",
            availableActions: [
              "start_monitoring",
              "stop_monitoring", 
              "trigger_emergency",
              "force_analysis",
              "get_schedule_status"
            ]
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Schedule control error:', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      status: "Scheduling system operational",
      availableActions: [
        "start_monitoring - Start all scheduled monitoring",
        "stop_monitoring - Stop scheduled monitoring", 
        "trigger_emergency - Trigger emergency response",
        "force_analysis - Force immediate analysis",
        "get_schedule_status - Get current schedule status"
      ],
      schedules: {
        calendar: "Every 30 minutes",
        patterns: "Every 15 minutes",
        health: "Every 5 minutes", 
        intensive: "Every 2 hours",
        daily: "Daily at 9 AM UTC"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "Error retrieving schedule status",
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}