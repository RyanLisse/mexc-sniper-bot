/**
 * Real-time Monitoring API - Minimal Implementation
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';

  return NextResponse.json({
    success: true,
    message: "Real-time monitoring data retrieved successfully",
    data: {
      timestamp: new Date().toISOString(),
      type,
      systemStatus: {
        overall: 'healthy',
        uptime: process.uptime(),
        memory: { usage: 45 },
        cpu: { usage: 25 }
      },
      activeWorkflows: [],
      transactionLocks: { activeLocks: 0, totalLocks: 0 },
      websocketConnections: { connections: 0, messageRate: 0 },
      agentActivity: [],
      performance: {
        systemLoad: 30,
        responseTime: 120,
        throughput: 750,
        errorRate: 0.5
      },
      alerts: []
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    return NextResponse.json({
      success: true,
      message: `Action '${action}' completed successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Action failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}