/**
 * Database Optimization API Endpoint
 * 
 * Provides access to comprehensive database optimization system:
 * - Trigger complete optimization (all 4 phases)
 * - Monitor optimization progress and results
 * - Get performance metrics and recommendations
 * - Export optimization reports
 */

import { NextRequest, NextResponse } from "next/server";
import { databaseConnectionPool } from "@/src/lib/database-connection-pool";
import { databaseIndexOptimizer } from "@/src/lib/database-index-optimizer";
import { databaseOptimizationManager } from "@/src/lib/database-optimization-manager";
import { databasePerformanceAnalyzer } from "@/src/lib/database-performance-analyzer";
import { databaseQueryOptimizer } from "@/src/lib/database-query-optimizer";
import { queryPerformanceMonitor } from "@/src/services/query-performance-monitor";

// GET - Get current optimization status and metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "status";

    switch (action) {
      case "status":
        return NextResponse.json({
          success: true,
          data: {
            optimization: databaseOptimizationManager.getOptimizationStatus(),
            performance: queryPerformanceMonitor.getPerformanceStats(),
            connections: databaseConnectionPool.getConnectionMetrics(),
            cache: databaseConnectionPool.getCacheMetrics(),
            monitoring: queryPerformanceMonitor.getStatus()
          }
        });

      case "analysis":
        const analysisResults = databasePerformanceAnalyzer.getCachedResults();
        return NextResponse.json({
          success: true,
          data: analysisResults || "No analysis data available - run analysis first"
        });

      case "recommendations":
        const recommendations = queryPerformanceMonitor.getOptimizationRecommendations();
        return NextResponse.json({
          success: true,
          data: {
            recommendations,
            timestamp: new Date().toISOString(),
            count: recommendations.recommendations.length
          }
        });

      case "report":
        const report = await databaseOptimizationManager.exportOptimizationReport();
        return NextResponse.json({
          success: true,
          data: report
        });

      case "indexes":
        const indexSQL = databaseIndexOptimizer.generateIndexSQL();
        return NextResponse.json({
          success: true,
          data: {
            sql: indexSQL,
            count: indexSQL.length,
            description: "Strategic database indexes for AI agent optimization"
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action parameter",
          validActions: ["status", "analysis", "recommendations", "report", "indexes"]
        }, { status: 400 });
    }

  } catch (error) {
    console.error("[Database Optimization API] GET error:", { error: error });
    return NextResponse.json({
      success: false,
      error: "Failed to retrieve optimization data",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// POST - Trigger database optimization
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "optimize";

    switch (action) {
      case "optimize":
        console.info("🚀 Starting comprehensive database optimization...");
        
        // Run the complete 4-phase optimization
        const optimizationResult = await databaseOptimizationManager.runCompleteOptimization();
        
        return NextResponse.json({
          success: true,
          message: "Database optimization completed successfully",
          data: {
            optimization: optimizationResult,
            summary: {
              totalDuration: `${(optimizationResult.totalDuration / 1000).toFixed(2)}s`,
              phasesCompleted: `${optimizationResult.successfulPhases}/4`,
              overallImprovement: optimizationResult.overallImprovement,
              targetAchieved: optimizationResult.overallImprovement.includes("TARGET ACHIEVED")
            }
          }
        });

      case "analyze":
        console.info("🔍 Running database performance analysis...");
        
        // Start monitoring
        queryPerformanceMonitor.startMonitoring();
        
        // Run analysis
        const analysisResult = await databasePerformanceAnalyzer.runComprehensiveAnalysis();
        
        return NextResponse.json({
          success: true,
          message: "Database analysis completed",
          data: {
            analysis: analysisResult,
            summary: {
              totalQueries: analysisResult.totalQueries,
              slowQueries: analysisResult.slowQueries,
              averageTime: `${analysisResult.averageExecutionTime.toFixed(2)}ms`,
              recommendations: analysisResult.recommendations.length
            }
          }
        });

      case "createIndexes":
        console.info("🗂️ Creating strategic database indexes...");
        
        const indexResult = await databaseIndexOptimizer.createStrategicIndexes();
        
        return NextResponse.json({
          success: true,
          message: "Strategic indexes created",
          data: {
            indexResult,
            summary: {
              created: indexResult.created.length,
              failed: indexResult.failed.length,
              analyzed: indexResult.analyzed.length,
              estimatedImprovement: indexResult.estimatedImprovement
            }
          }
        });

      case "optimizeForAgents":
        console.info("🤖 Optimizing database for AI agent workloads...");
        
        await databaseOptimizationManager.optimizeForAgentWorkloads();
        
        return NextResponse.json({
          success: true,
          message: "Database optimized for AI agent workloads",
          data: {
            configuration: {
              agentOptimized: true,
              batchOperations: true,
              patternCaching: true,
              concurrentConnections: 25
            }
          }
        });

      case "clearCache":
        console.info("🗑️ Clearing database caches...");
        
        databaseQueryOptimizer.clearCache();
        databaseConnectionPool.clearCache();
        queryPerformanceMonitor.clearMetrics();
        
        return NextResponse.json({
          success: true,
          message: "Database caches cleared",
          data: {
            cleared: ["queryCache", "connectionCache", "performanceMetrics"]
          }
        });

      case "validateIndexes":
        console.info("🔍 Validating database indexes...");
        
        const validation = await databaseIndexOptimizer.validateIndexes();
        
        return NextResponse.json({
          success: true,
          message: "Index validation completed",
          data: {
            validation,
            summary: {
              valid: validation.valid,
              invalid: validation.invalid,
              total: validation.valid + validation.invalid
            }
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action parameter",
          validActions: [
            "optimize", 
            "analyze", 
            "createIndexes", 
            "optimizeForAgents", 
            "clearCache", 
            "validateIndexes"
          ]
        }, { status: 400 });
    }

  } catch (error) {
    console.error("[Database Optimization API] POST error:", { error: error });
    return NextResponse.json({
      success: false,
      error: "Database optimization failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// PUT - Update optimization configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { target, config } = body;

    switch (target) {
      case "queryOptimizer":
        databaseQueryOptimizer.updateConfig(config);
        return NextResponse.json({
          success: true,
          message: "Query optimizer configuration updated",
          data: { config }
        });

      case "connectionPool":
        databaseConnectionPool.updateConfig(config);
        return NextResponse.json({
          success: true,
          message: "Connection pool configuration updated", 
          data: { config }
        });

      case "monitoring":
        if (config.enabled) {
          queryPerformanceMonitor.startMonitoring();
        } else {
          queryPerformanceMonitor.stopMonitoring();
        }
        return NextResponse.json({
          success: true,
          message: `Performance monitoring ${config.enabled ? 'started' : 'stopped'}`,
          data: { enabled: config.enabled }
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid target parameter",
          validTargets: ["queryOptimizer", "connectionPool", "monitoring"]
        }, { status: 400 });
    }

  } catch (error) {
    console.error("[Database Optimization API] PUT error:", { error: error });
    return NextResponse.json({
      success: false,
      error: "Failed to update configuration",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// DELETE - Reset optimization settings
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("target") || "all";

    switch (target) {
      case "cache":
        databaseQueryOptimizer.clearCache();
        databaseConnectionPool.clearCache();
        return NextResponse.json({
          success: true,
          message: "All caches cleared"
        });

      case "metrics":
        queryPerformanceMonitor.clearMetrics();
        return NextResponse.json({
          success: true,
          message: "Performance metrics cleared"
        });

      case "monitoring":
        queryPerformanceMonitor.stopMonitoring();
        return NextResponse.json({
          success: true,
          message: "Performance monitoring stopped"
        });

      case "all":
        databaseQueryOptimizer.clearCache();
        databaseConnectionPool.clearCache();
        queryPerformanceMonitor.clearMetrics();
        queryPerformanceMonitor.stopMonitoring();
        
        return NextResponse.json({
          success: true,
          message: "All optimization data cleared"
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid target parameter",
          validTargets: ["cache", "metrics", "monitoring", "all"]
        }, { status: 400 });
    }

  } catch (error) {
    console.error("[Database Optimization API] DELETE error:", { error: error });
    return NextResponse.json({
      success: false,
      error: "Failed to reset optimization settings",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}