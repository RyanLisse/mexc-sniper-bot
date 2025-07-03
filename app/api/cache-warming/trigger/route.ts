/**
 * Cache Warming Trigger Route
 * Minimal implementation to eliminate import errors
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategy, strategies, force = false } = body;

    if (!strategy && !strategies) {
      return NextResponse.json({
        success: false,
        error: "Strategy name or strategies array is required",
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    let results: any[] = [];

    if (strategy) {
      // Mock single strategy trigger
      results.push({
        strategy,
        success: true,
        message: `Strategy '${strategy}' triggered (mock)`,
        executionTime: 100,
        triggeredAt: new Date().toISOString()
      });
    } else if (strategies && Array.isArray(strategies)) {
      // Mock multiple strategies trigger
      results = strategies.map((strategyName: string) => ({
        strategy: strategyName,
        success: true,
        message: `Strategy '${strategyName}' triggered (mock)`,
        executionTime: 100,
        triggeredAt: new Date().toISOString()
      }));
    }

    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    return NextResponse.json({
      success: successCount > 0,
      data: {
        triggered: successCount,
        total: totalCount,
        results,
        message: `${successCount}/${totalCount} cache warming strategies triggered successfully`
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Cache Warming Trigger] Error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to trigger cache warming",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const mockStrategies = [
      {
        name: "mexc-symbols",
        enabled: true,
        priority: 1,
        frequency: 300000,
        description: "Warm up MEXC symbol data for faster trading decisions",
        lastRun: new Date(Date.now() - 180000).toISOString(),
        canTrigger: true
      },
      {
        name: "pattern-data",
        enabled: true,
        priority: 2,
        frequency: 600000,
        description: "Pre-load pattern detection data for 3.5+ hour advance detection",
        lastRun: new Date(Date.now() - 300000).toISOString(),
        canTrigger: true
      },
      {
        name: "calendar-data",
        enabled: false,
        priority: 3,
        frequency: 1800000,
        description: "Warm up upcoming coin listing calendar data",
        lastRun: null,
        canTrigger: true
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        availableStrategies: mockStrategies.map(s => s.name),
        strategies: mockStrategies,
        serviceMetrics: {
          isActive: false,
          totalExecutions: 0,
          successRate: 0,
          lastExecution: null
        },
        message: "Cache warming service strategies (mock data)"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Cache Warming Trigger] Error getting strategies:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to get available strategies",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}