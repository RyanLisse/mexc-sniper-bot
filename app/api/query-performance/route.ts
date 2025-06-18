import { NextRequest, NextResponse } from "next/server";
import { queryPerformanceMonitor } from "../../../src/services/query-performance-monitor";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const timeframe = parseInt(searchParams.get('timeframe') || '60');

    switch (action) {
      case 'stats':
        const stats = queryPerformanceMonitor.getPerformanceStats(timeframe);
        return NextResponse.json({
          success: true,
          data: stats,
        });

      case 'patterns':
        const patterns = queryPerformanceMonitor.analyzeQueryPatterns(timeframe);
        return NextResponse.json({
          success: true,
          data: patterns,
        });

      case 'recommendations':
        const recommendations = queryPerformanceMonitor.getOptimizationRecommendations(timeframe);
        return NextResponse.json({
          success: true,
          data: recommendations,
        });

      case 'export':
        const exportData = queryPerformanceMonitor.exportMetrics(timeframe);
        return NextResponse.json({
          success: true,
          data: exportData,
        });

      case 'status':
      default:
        const status = queryPerformanceMonitor.getStatus();
        return NextResponse.json({
          success: true,
          data: status,
        });
    }
  } catch (error) {
    console.error("❌ Error getting query performance data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get query performance data",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start":
        queryPerformanceMonitor.startMonitoring();
        return NextResponse.json({
          success: true,
          message: "Query performance monitoring started",
          data: queryPerformanceMonitor.getStatus(),
        });

      case "stop":
        queryPerformanceMonitor.stopMonitoring();
        return NextResponse.json({
          success: true,
          message: "Query performance monitoring stopped",
          data: queryPerformanceMonitor.getStatus(),
        });

      case "clear":
        queryPerformanceMonitor.clearMetrics();
        return NextResponse.json({
          success: true,
          message: "Query performance metrics cleared",
          data: queryPerformanceMonitor.getStatus(),
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use 'start', 'stop', or 'clear'",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("❌ Error controlling query performance monitor:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to control query performance monitor",
      },
      { status: 500 }
    );
  }
}