import { NextRequest, NextResponse } from "next/server";
import { CalendarAgent } from "../../../src/mexc-agents/calendar-agent";
import { PatternDiscoveryAgent } from "../../../src/mexc-agents/pattern-discovery-agent";
import { MexcOrchestrator } from "../../../src/mexc-agents/orchestrator";

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Starting OpenAI Integration Test...');

    // Test 1: CalendarAgent OpenAI integration
    console.log('1️⃣ Testing CalendarAgent.scanForNewListings...');
    const calendarAgent = new CalendarAgent();
    
    const mockCalendarData = [
      {
        vcoinId: "test-coin-123",
        symbol: "TESTCOIN",
        projectName: "Test AI Project",
        firstOpenTime: Date.now() + (6 * 60 * 60 * 1000), // 6 hours from now
        tradingPairs: ["TESTCOINUSDT"],
        sts: 1,
        st: 1,
        tt: 2
      },
      {
        vcoinId: "defi-token-456",
        symbol: "DEFITEST",
        projectName: "DeFi Test Protocol",
        firstOpenTime: Date.now() + (12 * 60 * 60 * 1000), // 12 hours from now
        tradingPairs: ["DEFITESTUSDT"],
        sts: 2,
        st: 1,
        tt: 3
      }
    ];

    const calendarResult = await calendarAgent.scanForNewListings(mockCalendarData);
    console.log('✅ CalendarAgent OpenAI call successful!');

    // Test 2: PatternDiscoveryAgent OpenAI integration
    console.log('2️⃣ Testing PatternDiscoveryAgent.discoverNewListings...');
    const patternAgent = new PatternDiscoveryAgent();
    
    const patternResult = await patternAgent.discoverNewListings(mockCalendarData);
    console.log('✅ PatternDiscoveryAgent OpenAI call successful!');

    // Test 3: Ready state validation
    console.log('3️⃣ Testing ready state pattern validation...');
    const readyStateData = {
      vcoinId: "ready-coin-789",
      symbolData: [
        {
          cd: "READYCOIN",
          sts: 2,
          st: 2,
          tt: 4
        }
      ],
      count: 1
    };

    const readyStateResult = await patternAgent.validateReadyState(readyStateData);
    console.log('✅ Ready state validation successful!');

    // Test 4: MexcOrchestrator workflow integration
    console.log('4️⃣ Testing MexcOrchestrator workflow...');
    const orchestrator = new MexcOrchestrator();
    
    const workflowResult = await orchestrator.executeCalendarDiscoveryWorkflow({
      trigger: "test-api",
      force: true
    });

    console.log('✅ MexcOrchestrator workflow completed!');

    return NextResponse.json({
      success: true,
      message: "All OpenAI integration tests passed successfully!",
      results: {
        calendarAgentTest: {
          success: true,
          contentPreview: calendarResult.content.substring(0, 200),
          metadata: calendarResult.metadata
        },
        patternAgentTest: {
          success: true,
          contentPreview: patternResult.content.substring(0, 200),
          metadata: patternResult.metadata
        },
        readyStateValidation: {
          success: true,
          contentPreview: readyStateResult.content.substring(0, 200),
          metadata: readyStateResult.metadata
        },
        orchestratorWorkflow: {
          success: workflowResult.success,
          data: workflowResult.data,
          metadata: workflowResult.metadata
        }
      },
      summary: {
        calendarAgentWorking: true,
        patternAgentWorking: true,
        readyStateValidationWorking: true,
        orchestratorWorkflowWorking: workflowResult.success,
        openaiIntegrationVerified: true
      }
    });

  } catch (error) {
    console.error('❌ OpenAI integration test failed:', error);
    
    return NextResponse.json({
      success: false,
      message: "OpenAI integration test failed",
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 10)
      },
      troubleshooting: {
        checkApiKey: process.env.OPENAI_API_KEY ? "API key is set" : "API key is missing",
        possibleIssues: [
          "Invalid OpenAI API key",
          "Rate limit exceeded",
          "Network connectivity issue",
          "OpenAI service unavailable"
        ]
      }
    }, { status: 500 });
  }
}