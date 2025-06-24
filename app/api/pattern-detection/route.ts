import { NextRequest, NextResponse } from "next/server";
// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import { PatternDetectionCore } from "../../../src/core/pattern-detection";
import { patternStrategyOrchestrator } from "../../../src/services/pattern-strategy-orchestrator";
import { patternEmbeddingService } from "../../../src/services/pattern-embedding-service";
import { apiAuthWrapper } from "../../../src/lib/api-auth";
import { createApiResponse } from "../../../src/lib/api-response";
import { 
  withApiErrorHandling, 
  withDatabaseErrorHandling,
  handleApiError,
  ValidationError 
} from "../../../src/lib/central-api-error-handler";
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

export const POST = apiAuthWrapper(withApiErrorHandling(async (request: NextRequest) => {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[pattern-detection]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[pattern-detection]', message, context || ''),
    error: (message: string, context?: any) => console.error('[pattern-detection]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[pattern-detection]', message, context || ''),
  };
  
  const body = await request.json();
  
  try {
    const validatedRequest = PatternDetectionRequestSchema.parse(body);
    logger.info(`[PatternDetection API] Processing ${validatedRequest.action} request`);

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
        throw new ValidationError(`Unknown action: ${validatedRequest.action}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError("Invalid request format", undefined, { issues: error.errors });
    }
    throw error;
  }
}, "pattern-detection"));

// ============================================================================
// Action Handlers
// ============================================================================

async function handlePatternAnalysis(request: z.infer<typeof PatternDetectionRequestSchema>) {
  try {
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
  } catch (error) {
    console.error('[pattern-detection] Pattern analysis failed:', error);
    return createApiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Pattern analysis failed",
      data: {
        analysis: { matches: [], summary: { averageConfidence: 0 }, recommendations: [], correlations: [], analysisMetadata: {} },
        summary: { totalMatches: 0, readyStatePatterns: 0, advanceOpportunities: 0, highConfidenceMatches: 0, averageConfidence: 0 }
      }
    }, 500);
  }
}

async function handlePatternDiscovery(request: z.infer<typeof PatternDetectionRequestSchema>) {
  if (!request.calendarEntries || request.calendarEntries.length === 0) {
    return createApiResponse({
      success: false,
      error: "Calendar entries required for pattern discovery"
    }, 400);
  }

  try {
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
  } catch (error) {
    console.error('[pattern-detection] Pattern discovery failed:', error);
    return createApiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Pattern discovery failed",
      data: {
        workflow: { success: false, error: "Discovery workflow failed" },
        patternAnalysis: null,
        strategicRecommendations: [],
        monitoringPlan: null,
        performance: { duration: 0, status: 'failed' }
      }
    }, 500);
  }
}

async function handlePatternMonitoring(request: z.infer<typeof PatternDetectionRequestSchema>) {
  if (!request.symbolData || request.symbolData.length === 0) {
    return createApiResponse({
      success: false,
      error: "Symbol data required for pattern monitoring"
    }, 400);
  }

  try {
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
  } catch (error) {
    console.error('[pattern-detection] Pattern monitoring failed:', error);
    return createApiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Pattern monitoring failed",
      data: {
        workflow: { success: false, error: "Monitoring workflow failed" },
        readyStateDetection: [],
        preReadyPatterns: [],
        strategicRecommendations: [],
        performance: { duration: 0, status: 'failed' }
      }
    }, 500);
  }
}

async function handlePatternValidation(request: z.infer<typeof PatternDetectionRequestSchema>) {
  if (!request.symbolData || request.symbolData.length === 0) {
    return createApiResponse({
      success: false,
      error: "Symbol data required for pattern validation"
    }, 400);
  }

  try {
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
  } catch (error) {
    console.error('[pattern-detection] Pattern validation failed:', error);
    return createApiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Pattern validation failed",
      data: {
        validationResult: { success: false, error: "Validation workflow failed" },
        readyStateValidation: [],
        riskAssessment: [],
        recommendations: [],
        performance: { duration: 0, status: 'failed' }
      }
    }, 500);
  }
}

async function handlePatternTrends(request: z.infer<typeof PatternDetectionRequestSchema>) {
  const patternType = request.patternType || "ready_state";
  const timeWindows = [1, 6, 24, 168]; // 1h, 6h, 24h, 7d

  try {
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
  } catch (error) {
    console.error('[pattern-detection] Pattern trends analysis failed:', error);
    return createApiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Pattern trends analysis failed",
      data: {
        patternType,
        trends: [],
        insights: [],
        alerts: [],
        summary: {
          totalTrendWindows: 0,
          increasingTrends: 0,
          decreasingTrends: 0,
          avgSuccessRate: 0,
          alertCount: 0
        }
      }
    }, 500);
  }
}

async function handlePatternPerformance(request: z.infer<typeof PatternDetectionRequestSchema>) {
  const timeRange = {
    start: new Date(Date.now() - (request.timeWindow || 168) * 60 * 60 * 1000), // Default 7 days
    end: new Date()
  };

  try {
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
  } catch (error) {
    console.error('[pattern-detection] Pattern performance analysis failed:', error);
    return createApiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Pattern performance analysis failed",
      data: {
        timeRange,
        patternType: request.patternType || "all",
        performance: { 
          summary: { totalPatterns: 0, successRate: 0, avgProfit: 0 }, 
          breakdown: [], 
          recommendations: [] 
        },
        summary: {
          totalPatterns: 0,
          overallSuccessRate: 0,
          avgProfit: 0,
          patternTypeCount: 0,
          topPerformingType: { patternType: "none", successRate: 0 }
        },
        breakdown: [],
        recommendations: []
      }
    }, 500);
  }
}

// GET endpoint for health check and basic info
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  // Build-safe logger - use console logger to avoid webpack bundling issues
  const logger = {
    info: (message: string, context?: any) => console.info('[pattern-detection-get]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[pattern-detection-get]', message, context || ''),
    error: (message: string, context?: any) => console.error('[pattern-detection-get]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[pattern-detection-get]', message, context || ''),
  };
  
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "analyze") {
    // Handle GET requests with analyze action (the failing requests)
    // Extract query parameters for pattern analysis
    const enableAgentAnalysis = url.searchParams.get("enableAgentAnalysis") === "true";
    const confidenceThreshold = parseInt(url.searchParams.get("confidenceThreshold") || "70");
    const enableAdvanceDetection = url.searchParams.get("enableAdvanceDetection") === "true";
    const patternTypes = url.searchParams.get("patternTypes")?.split(",") || [];

    return await withDatabaseErrorHandling(async () => {
      const result = await PatternDetectionCore.getInstance().analyzePatterns({
        symbols: [],
        calendarEntries: [],
        analysisType: "discovery",
        confidenceThreshold,
        includeHistorical: true
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
    }, "pattern-analysis-get");
  }

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
    // Get performance metrics with database operation protection
    return await withDatabaseErrorHandling(async () => {
      const orchestratorMetrics = patternStrategyOrchestrator.getPerformanceMetrics();
      
      return createApiResponse({
        success: true,
        data: {
          orchestratorMetrics,
          timestamp: new Date().toISOString()
        }
      });
    }, "pattern-stats");
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
        "GET /api/pattern-detection?action=stats": "Performance metrics",
        "GET /api/pattern-detection?action=analyze": "Pattern analysis via GET"
      }
    }
  });
}, "pattern-detection-get");