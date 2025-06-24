import { NextRequest, NextResponse } from "next/server";
import { createLogger } from '../../../../src/lib/structured-logger';
import { getAiIntelligenceService } from "../../../../src/services/ai-intelligence-service";
import { createApiResponse } from "../../../../src/lib/api-response";

export async function GET(request: NextRequest) {
  // Create logger lazily to prevent build-time issues
  let logger: ReturnType<typeof createLogger>;
  try {
    logger = createLogger('route');
  } catch {
    // Fallback to console during build
    logger = { 
      error: console.error.bind(console),
      info: console.log.bind(console),
      warn: console.warn.bind(console),
      debug: console.debug.bind(console)
    } as any;
  }

  try {
    // Check AI service health and configuration
    const cohereStatus = await checkCohereStatus();
    const perplexityStatus = await checkPerplexityStatus();
    const openaiStatus = await checkOpenAIStatus();

    const overallStatus = determineOverallStatus([cohereStatus, perplexityStatus, openaiStatus]);

    return createApiResponse({
      success: true,
      data: {
        overall: overallStatus,
        services: {
          cohere: cohereStatus,
          perplexity: perplexityStatus,
          openai: openaiStatus,
        },
        capabilities: {
          patternEmbedding: cohereStatus.available,
          marketResearch: perplexityStatus.available,
          fallbackAnalysis: openaiStatus.available,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("[AI Services Status] Error:", { error: error });
    return createApiResponse(
      {
        success: false,
        error: "Failed to check AI services status",
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      },
      500
    );
  }
}

async function checkCohereStatus() {
  try {
    const hasApiKey = !!process.env.COHERE_API_KEY;

    if (!hasApiKey) {
      return {
        name: "Cohere",
        status: "unavailable",
        available: false,
        message: "API key not configured",
        capabilities: ["pattern-embedding"],
        lastCheck: new Date().toISOString(),
      };
    }

    // Test Cohere API with a simple embedding request
    const testResult = await getAiIntelligenceService().generatePatternEmbedding({
      symbolName: "TEST",
      vcoinId: "test",
      type: "ready_state",
      data: { sts: 2, st: 2, tt: 4 },
      confidence: 85,
    });

    return {
      name: "Cohere",
      status: testResult ? "healthy" : "error",
      available: !!testResult,
      message: testResult ? "Service operational" : "API test failed",
      capabilities: ["pattern-embedding", "similarity-analysis"],
      lastCheck: new Date().toISOString(),
      metrics: {
        embeddingDimensions: testResult?.length || 0,
        responseTime: "< 2s",
      },
    };
  } catch (error) {
    return {
      name: "Cohere",
      status: "error",
      available: false,
      message: `Service error: ${error instanceof Error ? error.message : "Unknown error"}`,
      capabilities: ["pattern-embedding"],
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkPerplexityStatus() {
  try {
    const hasApiKey = !!process.env.PERPLEXITY_API_KEY;

    if (!hasApiKey) {
      return {
        name: "Perplexity",
        status: "unavailable",
        available: false,
        message: "API key not configured",
        capabilities: ["market-research"],
        lastCheck: new Date().toISOString(),
      };
    }

    // Test Perplexity API with a simple research request
    const testResult = await getAiIntelligenceService().conductMarketResearch("BTC", "sentiment");

    return {
      name: "Perplexity",
      status: testResult ? "healthy" : "error",
      available: !!testResult,
      message: testResult ? "Service operational" : "API test failed",
      capabilities: ["market-research", "sentiment-analysis", "news-analysis"],
      lastCheck: new Date().toISOString(),
      metrics: {
        researchQuality: testResult?.confidence || 0,
        responseTime: "< 5s",
      },
    };
  } catch (error) {
    return {
      name: "Perplexity",
      status: "error",
      available: false,
      message: `Service error: ${error instanceof Error ? error.message : "Unknown error"}`,
      capabilities: ["market-research"],
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkOpenAIStatus() {
  try {
    const hasApiKey = !!process.env.OPENAI_API_KEY;

    return {
      name: "OpenAI",
      status: hasApiKey ? "healthy" : "unavailable",
      available: hasApiKey,
      message: hasApiKey ? "Service configured" : "API key not configured",
      capabilities: ["fallback-analysis", "text-generation"],
      lastCheck: new Date().toISOString(),
      metrics: {
        model: "gpt-4",
        responseTime: "< 3s",
      },
    };
  } catch (error) {
    return {
      name: "OpenAI",
      status: "error",
      available: false,
      message: `Service error: ${error instanceof Error ? error.message : "Unknown error"}`,
      capabilities: ["fallback-analysis"],
      lastCheck: new Date().toISOString(),
    };
  }
}

function determineOverallStatus(services: any[]) {
  const availableServices = services.filter(s => s.available).length;
  const totalServices = services.length;

  if (availableServices === 0) {
    return {
      status: "critical",
      message: "No AI services available",
      availableServices: 0,
      totalServices,
    };
  } else if (availableServices < totalServices) {
    return {
      status: "degraded",
      message: `${availableServices}/${totalServices} AI services available`,
      availableServices,
      totalServices,
    };
  } else {
    return {
      status: "healthy",
      message: "All AI services operational",
      availableServices,
      totalServices,
    };
  }
}
