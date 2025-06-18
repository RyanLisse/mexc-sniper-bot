import { NextRequest, NextResponse } from "next/server";
import { inngest } from "../../../../src/inngest/client";
import { patternDetectionEngine } from "../../../../src/services/pattern-detection-engine";
import { patternStrategyOrchestrator } from "../../../../src/services/pattern-strategy-orchestrator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      symbols = [], 
      vcoinId, 
      symbolData, 
      calendarEntries,
      directAnalysis = false,
      analysisType = "discovery",
      confidenceThreshold = 70
    } = body;

    console.log(`[PatternAnalysis Trigger] Processing ${analysisType} analysis for ${symbols.length || 0} symbols`);

    // Option 1: Direct analysis using centralized engine (faster)
    if (directAnalysis) {
      console.log("[PatternAnalysis Trigger] Running direct analysis with centralized engine");
      
      const workflowResult = await patternStrategyOrchestrator.executePatternWorkflow({
        type: analysisType,
        input: {
          symbolData,
          calendarEntries,
          vcoinId,
          symbols
        },
        options: {
          confidenceThreshold,
          includeAdvanceDetection: true,
          enableAgentAnalysis: true,
          maxExecutionTime: 30000
        }
      });

      return NextResponse.json({
        success: workflowResult.success,
        message: "Direct pattern analysis completed",
        directAnalysis: true,
        results: {
          patternAnalysis: workflowResult.results.patternAnalysis,
          strategicRecommendations: workflowResult.results.strategicRecommendations,
          performance: workflowResult.performance,
          readyStateDetected: workflowResult.results.patternAnalysis?.matches.filter(m => 
            m.patternType === "ready_state"
          ).length || 0,
          advanceOpportunities: workflowResult.results.patternAnalysis?.matches.filter(m => 
            m.patternType === "launch_sequence" && m.advanceNoticeHours >= 3.5
          ).length || 0
        },
        error: workflowResult.error
      });
    }

    // Option 2: Trigger asynchronous Inngest workflow (for complex analysis)
    console.log("[PatternAnalysis Trigger] Triggering async workflow via Inngest");
    
    const event = await inngest.send({
      name: "mexc/patterns.analyze",
      data: {
        symbols,
        vcoinId,
        symbolData,
        calendarEntries,
        analysisType,
        confidenceThreshold,
        triggeredBy: "api",
        timestamp: new Date().toISOString(),
        enhancedAnalysis: true // Flag to use centralized engine
      },
    });

    return NextResponse.json({
      success: true,
      message: "Enhanced pattern analysis workflow triggered",
      eventId: event.ids[0],
      symbols,
      analysisType,
      enhancedAnalysis: true,
      directAnalysis: false
    });
  } catch (error) {
    console.error("Failed to trigger pattern analysis:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger pattern analysis workflow",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}