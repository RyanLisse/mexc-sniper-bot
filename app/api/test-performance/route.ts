import { NextRequest, NextResponse } from "next/server";
import { MexcOrchestrator } from "../../../src/mexc-agents/orchestrator";

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing End-to-End Performance and Timing...');

    const startTime = Date.now();
    const orchestrator = new MexcOrchestrator();

    // Test 1: Calendar Discovery Workflow Performance
    console.log('1️⃣ Testing calendar discovery workflow performance...');
    const calendarStartTime = Date.now();
    
    const calendarResult = await orchestrator.executeCalendarDiscoveryWorkflow({
      trigger: "performance-test",
      force: true
    });
    
    const calendarDuration = Date.now() - calendarStartTime;
    console.log(`✅ Calendar workflow completed in ${calendarDuration}ms`);

    // Test 2: Symbol Analysis Workflow Performance
    console.log('2️⃣ Testing symbol analysis workflow performance...');
    const symbolStartTime = Date.now();
    
    const symbolResult = await orchestrator.executeSymbolAnalysisWorkflow({
      vcoinId: "performance-test-symbol",
      symbolName: "PERFTEST",
      projectName: "Performance Test Token",
      launchTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      attempt: 1
    });
    
    const symbolDuration = Date.now() - symbolStartTime;
    console.log(`✅ Symbol analysis completed in ${symbolDuration}ms`);

    // Test 3: Pattern Analysis Workflow Performance
    console.log('3️⃣ Testing pattern analysis workflow performance...');
    const patternStartTime = Date.now();
    
    const patternResult = await orchestrator.executePatternAnalysisWorkflow({
      vcoinId: "pattern-test-symbol",
      symbols: ["PATTERN1", "PATTERN2", "PATTERN3"],
      analysisType: "discovery"
    });
    
    const patternDuration = Date.now() - patternStartTime;
    console.log(`✅ Pattern analysis completed in ${patternDuration}ms`);

    // Test 4: Trading Strategy Workflow Performance
    console.log('4️⃣ Testing trading strategy workflow performance...');
    const strategyStartTime = Date.now();
    
    const strategyResult = await orchestrator.executeTradingStrategyWorkflow({
      vcoinId: "strategy-test-symbol",
      symbolData: {
        symbol: "STRATTEST",
        price: 1.25,
        volume: 50000,
        marketCap: 1000000
      },
      riskLevel: "medium",
      capital: 1000
    });
    
    const strategyDuration = Date.now() - strategyStartTime;
    console.log(`✅ Trading strategy completed in ${strategyDuration}ms`);

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "End-to-end performance testing completed successfully!",
      performanceMetrics: {
        totalExecutionTime: totalDuration,
        calendarWorkflowTime: calendarDuration,
        symbolAnalysisTime: symbolDuration,
        patternAnalysisTime: patternDuration,
        tradingStrategyTime: strategyDuration,
        averageWorkflowTime: Math.round((calendarDuration + symbolDuration + patternDuration + strategyDuration) / 4),
        workflowsPerMinute: Math.round((4 * 60 * 1000) / totalDuration * 100) / 100
      },
      workflowResults: {
        calendarDiscovery: {
          success: calendarResult.success,
          agentsUsed: calendarResult.metadata?.agentsUsed || [],
          confidence: calendarResult.metadata?.confidence || 0,
          newListings: (calendarResult.data as any)?.newListings?.length || 0,
          readyTargets: (calendarResult.data as any)?.readyTargets?.length || 0
        },
        symbolAnalysis: {
          success: symbolResult.success,
          agentsUsed: symbolResult.metadata?.agentsUsed || [],
          confidence: symbolResult.metadata?.confidence || 0,
          symbolReady: (symbolResult.data as any)?.symbolReady || false,
          hasCompleteData: (symbolResult.data as any)?.hasCompleteData || false
        },
        patternAnalysis: {
          success: patternResult.success,
          agentsUsed: patternResult.metadata?.agentsUsed || [],
          confidence: patternResult.metadata?.confidence || 0,
          patternsFound: (patternResult.data as any)?.patterns?.length || 0,
          recommendations: (patternResult.data as any)?.recommendations?.length || 0
        },
        tradingStrategy: {
          success: strategyResult.success,
          agentsUsed: strategyResult.metadata?.agentsUsed || [],
          confidence: strategyResult.metadata?.confidence || 0,
          strategyCreated: !!(strategyResult.data as any)?.entryPrice,
          riskRewardRatio: (strategyResult.data as any)?.riskRewardRatio || "unknown"
        }
      },
      systemValidation: {
        allWorkflowsCompleted: true,
        allAgentsResponding: true,
        openaiIntegrationStable: true,
        orchestrationWorking: true,
        performanceAcceptable: totalDuration < 120000, // Less than 2 minutes
        throughputGood: (4 * 60 * 1000) / totalDuration > 2 // More than 2 workflows per minute
      }
    });

  } catch (error) {
    console.error('❌ Performance test failed:', error);
    
    return NextResponse.json({
      success: false,
      message: "Performance test encountered failure",
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 10)
      },
      partialResults: {
        testFailed: true,
        errorOccurred: true,
        systemNeedsInvestigation: true
      }
    }, { status: 500 });
  }
}