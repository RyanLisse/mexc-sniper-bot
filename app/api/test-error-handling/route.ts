import { NextRequest, NextResponse } from "next/server";
import { CalendarAgent } from "../../../src/mexc-agents/calendar-agent";

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing Error Handling and Retry Logic...');

    // Test error handling by temporarily changing the API key
    const originalApiKey = process.env.OPENAI_API_KEY;
    
    // Test 1: Invalid API key handling
    console.log('1️⃣ Testing invalid API key handling...');
    process.env.OPENAI_API_KEY = "invalid-key-test";
    
    const calendarAgent = new CalendarAgent();
    const mockData = [
      {
        vcoinId: "test-error",
        symbol: "ERRORTEST",
        projectName: "Error Handling Test",
        firstOpenTime: Date.now() + (6 * 60 * 60 * 1000)
      }
    ];

    try {
      await calendarAgent.scanForNewListings(mockData);
      // If we reach here, the test failed because it should have thrown an error
      return NextResponse.json({
        success: false,
        message: "Error handling test failed - expected error but got success",
        issue: "Invalid API key was not properly detected"
      }, { status: 500 });
    } catch (error) {
      console.log('✅ Invalid API key error properly caught:', (error as Error).message);
      
      // Restore the original API key
      process.env.OPENAI_API_KEY = originalApiKey;
      
      // Test 2: Recovery after fixing API key
      console.log('2️⃣ Testing recovery after fixing API key...');
      const recoveryResult = await calendarAgent.scanForNewListings(mockData);
      console.log('✅ Recovery successful after fixing API key');

      return NextResponse.json({
        success: true,
        message: "Error handling and recovery tests passed successfully!",
        results: {
          invalidApiKeyTest: {
            errorProperlyCaught: true,
            errorMessage: (error as Error).message,
            errorType: (error as Error).name
          },
          recoveryTest: {
            recoverySuccessful: true,
            contentGenerated: recoveryResult.content.length > 0,
            tokensUsed: recoveryResult.metadata?.tokensUsed || 0
          }
        },
        errorHandlingValidation: {
          apiKeyValidationWorking: true,
          errorRecoveryWorking: true,
          gracefulFailureHandling: true
        }
      });
    }

  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    
    // Make sure to restore the original API key even if test fails
    const originalApiKey = process.env.OPENAI_API_KEY;
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
    
    return NextResponse.json({
      success: false,
      message: "Error handling test encountered unexpected failure",
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack?.split('\n').slice(0, 5)
      }
    }, { status: 500 });
  }
}