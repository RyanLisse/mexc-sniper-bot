import { NextRequest, NextResponse } from "next/server";
import { PatternDetectionCore } from "../../../src/core/pattern-detection";
import { patternStrategyOrchestrator } from "../../../src/services/pattern-strategy-orchestrator";
import { patternEmbeddingService } from "../../../src/services/pattern-embedding-service";
import { apiAuthWrapper } from "../../../src/lib/api-auth";
import { createApiResponse } from "../../../src/lib/api-response";
import { z } from "zod";

// Import schemas from MEXC schemas module
import { CalendarEntrySchema, SymbolEntrySchema } from "../../../src/services/mexc-schemas";

// Request schemas
const PatternDetectionRequestSchema = z.object({
  action: z.enum(["analyze", "discover", "monitor", "validate", "trends", "performance"]),
  
  // Data inputs - using proper schemas
  symbolData: z.array(SymbolEntrySchema).optional(),
  calendarEntries: z.array(CalendarEntrySchema).optional(),

  // Analysis options
  analysisType: z.enum(["discovery", "monitoring", "validation", "correlation"]).optional(),
  confidenceThreshold: z.number().min(0).max(100).optional(),
  includeHistorical: z.boolean().optional(),
  enableAdvanceDetection: z.boolean().optional(),
  enableAgentAnalysis: z.boolean().optional(),

  // Specific queries
  vcoinId: z.string().optional(),
  symbols: z.array(z.string()).optional(),
  patternType: z.string().optional(),
  timeWindow: z.number().optional(), // hours
});

export const POST = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const validatedRequest = PatternDetectionRequestSchema.parse(body);

    console.log(`[PatternDetection API] Processing ${validatedRequest.action} request`);

    switch (validatedRequest.action) {
      case "analyze":
        return await handlePatternAnalysis(validatedRequest);
      
      case "discover":
        return await handlePatternDiscovery(validatedRequest);
      
      case "monitor":
        return await handlePatternMonitoring(validatedRequest);
      
      case "validate":
        return await handlePatternValidation(validatedRequest);
      
      case "trends":
        return await handlePatternTrends(validatedRequest);
      
      case "performance":
        return await handlePatternPerformance(validatedRequest);
      
      default:
        return createApiResponse({ 
          success: false, 
          error: `Unknown action: ${validatedRequest.action}` 
        }, 400);
    }
  } catch (error) {
    console.error("[PatternDetection API] Request failed:", error);
    
    if (error instanceof z.ZodError) {
      return createApiResponse({
        success: false,
        error: "Invalid request format",
        details: { issues: error.errors }
      }, 400);
    }

    return createApiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Pattern detection failed"
    }, 500);
  }
});

// ============================================================================
// Action Handlers
// ============================================================================

async function handlePatternAnalysis(request: z.infer<typeof PatternDetectionRequestSchema>) {
  const result = await PatternDetectionCore.getInstance().analyzePatterns({
    symbols: request.symbolData || [],
    calendarEntries: request.calendarEntries || [],
    analysisType: request.analysisType || "discovery",
    confidenceThreshold: request.confidenceThreshold || 70,
    includeHistorical: request.includeHistorical ?? true
  });

  return createApiResponse({
    success: true,
    data: {
      analysis: result,
      summary: {
        totalMatches: result.matches.length,
        readyStatePatterns: result.matches.filter(m => m.patternType === "ready_state").length,
        advanceOpportunities: result.matches.filter(m => 
          m.patternType === "ready_state" && m.advanceNoticeHours >= 3.5
        ).length,
        highConfidenceMatches: result.matches.filter(m => m.confidence >= 80).length,
        averageConfidence: result.summary.averageConfidence
      },
      recommendations: result.recommendations,
      correlations: result.correlations,
      metadata: result.analysisMetadata
    }
  });
}

async function handlePatternDiscovery(request: z.infer<typeof PatternDetectionRequestSchema>) {
  if (!request.calendarEntries || request.calendarEntries.length === 0) {
    return createApiResponse({
      success: false,
      error: "Calendar entries required for pattern discovery"
    }, 400);
  }

  const workflowResult = await patternStrategyOrchestrator.executePatternWorkflow({
    type: "discovery",
    input: {
      calendarEntries: request.calendarEntries,
      symbols: request.symbols || []
    },
    options: {
      confidenceThreshold: request.confidenceThreshold || 70,
      includeAdvanceDetection: request.enableAdvanceDetection ?? true,
      enableAgentAnalysis: request.enableAgentAnalysis ?? true
    }
  });

  return createApiResponse({
    success: workflowResult.success,
    data: {
      workflow: workflowResult,
      patternAnalysis: workflowResult.results.patternAnalysis,
      strategicRecommendations: workflowResult.results.strategicRecommendations,
      monitoringPlan: workflowResult.results.monitoringPlan,
      performance: workflowResult.performance
    },
    error: workflowResult.error
  });
}

async function handlePatternMonitoring(request: z.infer<typeof PatternDetectionRequestSchema>) {
  if (!request.symbolData || request.symbolData.length === 0) {
    return createApiResponse({
      success: false,
      error: "Symbol data required for pattern monitoring"
    }, 400);
  }

  const workflowResult = await patternStrategyOrchestrator.executePatternWorkflow({
    type: "monitoring",
    input: {
      symbolData: request.symbolData,
      vcoinId: request.vcoinId,
      symbols: request.symbols || []
    },
    options: {
      confidenceThreshold: request.confidenceThreshold || 80,
      enableAgentAnalysis: request.enableAgentAnalysis ?? true
    }
  });

  return createApiResponse({
    success: workflowResult.success,
    data: {
      workflow: workflowResult,
      readyStateDetection: workflowResult.results.patternAnalysis?.matches.filter(m => 
        m.patternType === "ready_state"
      ) || [],
      preReadyPatterns: workflowResult.results.patternAnalysis?.matches.filter(m => 
        m.patternType === "pre_ready"
      ) || [],
      strategicRecommendations: workflowResult.results.strategicRecommendations,
      performance: workflowResult.performance
    },
    error: workflowResult.error
  });
}

async function handlePatternValidation(request: z.infer<typeof PatternDetectionRequestSchema>) {
  if (!request.symbolData || request.symbolData.length === 0) {
    return createApiResponse({
      success: false,
      error: "Symbol data required for pattern validation"
    }, 400);
  }

  const workflowResult = await patternStrategyOrchestrator.executePatternWorkflow({
    type: "validation",
    input: {
      symbolData: request.symbolData,
      vcoinId: request.vcoinId
    },
    options: {
      confidenceThreshold: 85, // Higher threshold for validation
      enableAgentAnalysis: true
    }
  });

  return createApiResponse({
    success: workflowResult.success,
    data: {
      validationResult: workflowResult,
      readyStateValidation: workflowResult.results.patternAnalysis?.matches.filter(m => 
        m.patternType === "ready_state" && m.confidence >= 85
      ) || [],
      riskAssessment: workflowResult.results.patternAnalysis?.matches.filter(m => 
        m.riskLevel === "high"
      ) || [],
      recommendations: workflowResult.results.strategicRecommendations,
      performance: workflowResult.performance
    },
    error: workflowResult.error
  });
}

async function handlePatternTrends(request: z.infer<typeof PatternDetectionRequestSchema>) {
  const patternType = request.patternType || "ready_state";
  const timeWindows = [1, 6, 24, 168]; // 1h, 6h, 24h, 7d

  const trends = await patternEmbeddingService.detectPatternTrends(patternType, timeWindows);

  return createApiResponse({
    success: true,
    data: {
      patternType,
      trends: trends.trends,
      insights: trends.insights,
      alerts: trends.alerts,
      summary: {
        totalTrendWindows: trends.trends.length,
        increasingTrends: trends.trends.filter(t => t.trend === "increasing").length,
        decreasingTrends: trends.trends.filter(t => t.trend === "decreasing").length,
        avgSuccessRate: trends.trends.reduce((sum, t) => sum + t.successRate, 0) / trends.trends.length,
        alertCount: trends.alerts.length
      }
    }
  });
}

async function handlePatternPerformance(request: z.infer<typeof PatternDetectionRequestSchema>) {
  const timeRange = {
    start: new Date(Date.now() - (request.timeWindow || 168) * 60 * 60 * 1000), // Default 7 days
    end: new Date()
  };

  const performance = await patternEmbeddingService.analyzeHistoricalPerformance(
    request.patternType,
    timeRange
  );

  return createApiResponse({
    success: true,
    data: {
      timeRange,
      patternType: request.patternType || "all",
      performance,
      summary: {
        totalPatterns: performance.summary.totalPatterns,
        overallSuccessRate: performance.summary.successRate,
        avgProfit: performance.summary.avgProfit,
        patternTypeCount: performance.breakdown.length,
        topPerformingType: performance.breakdown.reduce((best, current) => 
          current.successRate > best.successRate ? current : best, 
          { patternType: "none", successRate: 0 }
        )
      },
      breakdown: performance.breakdown,
      recommendations: performance.recommendations
    }
  });
}

// GET endpoint for health check and basic info
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "health") {
      // Basic health check
      return createApiResponse({
        success: true,
        data: {
          status: "healthy",
          services: {
            patternDetectionEngine: "active",
            patternStrategyOrchestrator: "active", 
            patternEmbeddingService: "active"
          },
          capabilities: {
            readyStateDetection: true,
            advanceDetection: true,
            correlationAnalysis: true,
            trendAnalysis: true,
            performanceAnalysis: true
          },
          competitiveAdvantage: {
            minAdvanceHours: 3.5,
            readyStatePattern: "sts:2, st:2, tt:4",
            confidence: "85%+ for ready state"
          }
        }
      });
    }

    if (action === "stats") {
      // Get performance metrics
      const orchestratorMetrics = patternStrategyOrchestrator.getPerformanceMetrics();
      
      return createApiResponse({
        success: true,
        data: {
          orchestratorMetrics,
          timestamp: new Date().toISOString()
        }
      });
    }

    return createApiResponse({
      success: true,
      data: {
        message: "MEXC Pattern Detection System",
        version: "2.0.0",
        features: [
          "Centralized Pattern Detection Engine",
          "3.5+ Hour Advance Detection",
          "Ready State Pattern Recognition (sts:2, st:2, tt:4)",
          "Multi-Symbol Correlation Analysis",
          "Strategic Workflow Orchestration",
          "Enhanced Pattern Analytics",
          "Real-time Pattern Monitoring"
        ],
        endpoints: {
          "POST /api/pattern-detection": "Main pattern detection API",
          "GET /api/pattern-detection?action=health": "Health check",
          "GET /api/pattern-detection?action=stats": "Performance metrics"
        }
      }
    });
  } catch (error) {
    console.error("[PatternDetection API] GET request failed:", error);
    
    return createApiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}