import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/src/db/index";
import {
  strategyTemplates,
  tradingStrategies,
} from "@/src/db/schemas/strategies";
import { inngest } from "@/src/inngest/client";
import { apiResponse } from "@/src/lib/api-response";
import { rateLimiter } from "@/src/lib/rate-limiter";
import { ensureStartupInitialization } from "@/src/lib/startup-initialization";
import { requireAuth } from "@/src/lib/supabase-auth";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";

// ===========================================
// MULTI-PHASE STRATEGY CREATION TRIGGER
// ===========================================

const TriggerSchema = z.object({
  action: z.enum(["create", "analyze", "optimize", "recommend"]),

  // For strategy creation
  symbol: z.string().optional(),
  marketData: z.string().optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).optional(),
  timeframe: z.enum(["short", "medium", "long"]).optional(),
  capital: z.number().positive().optional(),
  entryPrice: z.number().positive().optional(),

  // For AI-powered strategy recommendation
  userPreferences: z
    .object({
      riskTolerance: z.enum(["low", "medium", "high"]),
      capital: z.number().positive(),
      timeframe: z.enum(["short", "medium", "long"]),
      tradingStyle: z
        .enum(["conservative", "balanced", "aggressive", "scalping", "diamond"])
        .optional(),
    })
    .optional(),

  // For strategy optimization
  strategyId: z.number().optional(),
  currentMarketConditions: z.string().optional(),
  performanceData: z.string().optional(),

  // For manual trigger testing
  test: z.boolean().optional(),
});

// POST /api/triggers/multi-phase-strategy - Trigger multi-phase strategy workflows
export async function POST(request: NextRequest) {
  try {
    // Ensure startup initialization is complete
    await ensureStartupInitialization();

    // Rate limiting
    const rateLimitResult = await rateLimiter.checkRateLimit(
      rateLimiter.getClientIP(request),
      "strategy_triggers"
    );
    if (!rateLimitResult.success) {
      return apiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    let user;
    try {
      user = await requireAuth();
      if (!user?.id) {
        return apiResponse.error("Unauthorized", 401);
      }
    } catch (_error) {
      return apiResponse.error("Unauthorized", 401);
    }

    // Parse request body
    const body = await request.json();
    const data = TriggerSchema.parse(body);

    // Handle test requests
    if (data.test) {
      return apiResponse.success(
        {
          message: "Multi-phase strategy system is operational",
          userId: user.id,
          timestamp: new Date().toISOString(),
          availableActions: ["create", "analyze", "optimize", "recommend"],
        },
        { message: "Test successful" }
      );
    }

    let result: any = {};

    switch (data.action) {
      case "create":
        result = await handleStrategyCreation(data, user.id);
        break;

      case "analyze":
        result = await handleStrategyAnalysis(data, user.id);
        break;

      case "optimize":
        result = await handleStrategyOptimization(data, user.id);
        break;

      case "recommend":
        result = await handleStrategyRecommendation(data, user.id);
        break;

      default:
        return apiResponse.error("Invalid action", 400);
    }

    return apiResponse.success(result, {
      message: `Strategy ${data.action} completed successfully`,
    });
  } catch (error) {
    console.error("Error in multi-phase strategy trigger:", { error: error });

    if (error instanceof z.ZodError) {
      return apiResponse.error("Invalid request data", 400, {
        validationErrors: error.errors,
      });
    }

    return apiResponse.error("Failed to process strategy request", 500);
  }
}

// Handle strategy creation with AI assistance
async function handleStrategyCreation(data: any, userId: string) {
  const strategyAgent = new StrategyAgent();

  if (!data.symbol || !data.marketData) {
    throw new Error(
      "Symbol and market data are required for strategy creation"
    );
  }

  // Get AI strategy recommendation
  const recommendation = await strategyAgent.createMultiPhaseStrategy({
    marketData: data.marketData,
    symbol: data.symbol,
    riskTolerance: data.riskTolerance || "medium",
    timeframe: data.timeframe || "medium",
    capital: data.capital,
    entryPrice: data.entryPrice,
    objectives: [
      "profit maximization",
      "risk management",
      "automated execution",
    ],
  });

  // Trigger Inngest workflow for strategy creation
  const workflowId = `multi-phase-create-${userId}-${Date.now()}`;

  await inngest.send({
    name: "multi-phase-strategy/create",
    data: {
      userId,
      symbol: data.symbol,
      marketData: data.marketData,
      riskTolerance: data.riskTolerance || "medium",
      timeframe: data.timeframe || "medium",
      capital: data.capital,
      entryPrice: data.entryPrice,
      aiRecommendation: recommendation.content,
      workflowId,
    },
  });

  return {
    workflowId,
    aiInsights: recommendation.content,
    strategyRecommendation:
      "AI-powered multi-phase strategy creation initiated",
    nextSteps: [
      "AI analysis of market conditions",
      "Multi-phase target calculation",
      "Risk assessment and position sizing",
      "Strategy validation and testing",
    ],
  };
}

// Handle strategy analysis for existing strategies
async function handleStrategyAnalysis(data: any, userId: string) {
  const strategyAgent = new StrategyAgent();

  if (!data.symbol || !data.marketData) {
    throw new Error(
      "Symbol and market data are required for strategy analysis"
    );
  }

  // Get current market analysis
  const analysis = await strategyAgent.process(data.marketData, {
    marketData: data.marketData,
    symbol: data.symbol,
    riskTolerance: data.riskTolerance || "medium",
    objectives: ["market analysis", "trend identification", "risk assessment"],
  });

  // Trigger Inngest workflow for market analysis
  const workflowId = `multi-phase-analyze-${userId}-${Date.now()}`;

  await inngest.send({
    name: "multi-phase-strategy/analyze",
    data: {
      userId,
      symbol: data.symbol,
      marketData: data.marketData,
      analysisType: "market_conditions",
      aiAnalysis: analysis.content,
      workflowId,
    },
  });

  return {
    workflowId,
    marketAnalysis: analysis.content,
    analysisType: "market_conditions",
    recommendations: [
      "Monitor current market trends",
      "Assess volatility levels",
      "Check support and resistance levels",
      "Evaluate entry timing",
    ],
  };
}

// Handle strategy optimization
async function handleStrategyOptimization(data: any, userId: string) {
  const strategyAgent = new StrategyAgent();

  if (!data.strategyId) {
    throw new Error("Strategy ID is required for optimization");
  }

  // Get existing strategy from database
  const db = getDb();
  const [strategy] = await db
    .select()
    .from(tradingStrategies)
    .where(
      and(
        eq(tradingStrategies.id, parseInt(data.strategyId)),
        eq(tradingStrategies.userId, userId)
      )
    )
    .limit(1);

  if (!strategy) {
    throw new Error("Strategy not found");
  }

  // Parse strategy configuration
  const levels = JSON.parse(strategy.levels);
  const strategyConfig = {
    id: strategy.id.toString(),
    name: strategy.name,
    description: strategy.description || "",
    levels,
  };

  // Get optimization recommendations
  const optimization = await strategyAgent.optimizeExistingStrategy(
    strategyConfig,
    data.currentMarketConditions || "Current market analysis needed",
    data.performanceData
  );

  // Trigger Inngest workflow for strategy optimization
  const workflowId = `multi-phase-optimize-${userId}-${Date.now()}`;

  await inngest.send({
    name: "multi-phase-strategy/optimize",
    data: {
      userId,
      strategyId: data.strategyId,
      currentStrategy: strategyConfig,
      marketConditions: data.currentMarketConditions,
      performanceData: data.performanceData,
      aiOptimization: optimization.content,
      workflowId,
    },
  });

  return {
    workflowId,
    currentStrategy: {
      name: strategy.name,
      symbol: strategy.symbol,
      phases: levels.length,
      status: strategy.status,
    },
    optimizationInsights: optimization.content,
    optimizationType: "performance_enhancement",
    nextSteps: [
      "Analyze current performance metrics",
      "Identify optimization opportunities",
      "Test optimized strategy parameters",
      "Implement improvements if validated",
    ],
  };
}

// Handle strategy recommendation
async function handleStrategyRecommendation(data: any, userId: string) {
  const strategyAgent = new StrategyAgent();

  if (!data.symbol || !data.marketData || !data.userPreferences) {
    throw new Error(
      "Symbol, market data, and user preferences are required for recommendations"
    );
  }

  // Get comprehensive strategy recommendation
  const recommendation = await strategyAgent.recommendStrategyForSymbol(
    data.symbol,
    data.marketData,
    data.userPreferences
  );

  // Trigger Inngest workflow for strategy recommendation
  const workflowId = `multi-phase-recommend-${userId}-${Date.now()}`;

  await inngest.send({
    name: "multi-phase-strategy/recommend",
    data: {
      userId,
      symbol: data.symbol,
      marketData: data.marketData,
      userPreferences: data.userPreferences,
      aiRecommendation: recommendation,
      workflowId,
    },
  });

  return {
    workflowId,
    recommendation: {
      primaryStrategy: recommendation.recommendedStrategy
        ? {
            name: recommendation.recommendedStrategy.name,
            description: recommendation.recommendedStrategy.description,
            riskLevel: recommendation.riskAssessment?.riskLevel,
            timeHorizon: recommendation.riskAssessment?.timeHorizon,
            suitabilityScore: recommendation.riskAssessment?.suitabilityScore,
            phases: recommendation.recommendedStrategy.levels.length,
          }
        : null,
      alternatives: recommendation.alternativeStrategies?.map((alt) => ({
        name: alt.name,
        description: alt.description,
        phases: alt.levels.length,
      })),
      riskAssessment: recommendation.riskAssessment,
      executionGuidance: recommendation.executionGuidance,
    },
    aiReasoning: recommendation.reasoning,
    nextSteps: [
      "Review recommended strategy details",
      "Validate risk parameters",
      "Set up position sizing",
      "Initialize strategy execution",
    ],
  };
}

// GET /api/triggers/multi-phase-strategy - Get trigger status and capabilities
export async function GET(request: NextRequest) {
  try {
    // Ensure startup initialization is complete
    await ensureStartupInitialization();

    // Rate limiting
    const rateLimitResult = await rateLimiter.checkRateLimit(
      rateLimiter.getClientIP(request),
      "strategy_status"
    );
    if (!rateLimitResult.success) {
      return apiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    let user;
    try {
      user = await requireAuth();
      if (!user?.id) {
        return apiResponse.error("Unauthorized", 401);
      }
    } catch (_error) {
      return apiResponse.error("Unauthorized", 401);
    }

    // Get user's strategies summary
    const db = getDb();
    const strategies = await db
      .select()
      .from(tradingStrategies)
      .where(eq(tradingStrategies.userId, user.id))
      .limit(10);

    const templates = await db
      .select()
      .from(strategyTemplates)
      .where(eq(strategyTemplates.isActive, true));

    return apiResponse.success({
      status: "operational",
      capabilities: {
        actions: ["create", "analyze", "optimize", "recommend"],
        aiPowered: true,
        realTimeAnalysis: true,
        multiPhaseExecution: true,
        riskManagement: true,
      },
      userStats: {
        totalStrategies: strategies.length,
        activeStrategies: strategies.filter(
          (s: (typeof strategies)[0]) => s.status === "active"
        ).length,
        availableTemplates: templates.length,
      },
      recentActivity: strategies
        .slice(0, 5)
        .map((s: (typeof strategies)[0]) => ({
          id: s.id,
          name: s.name,
          symbol: s.symbol,
          status: s.status,
          phases: `${s.executedPhases}/${s.totalPhases}`,
          createdAt: s.createdAt,
        })),
      systemHealth: {
        aiAgentStatus: "operational",
        databaseConnection: "healthy",
        workflowEngine: "running",
        lastUpdate: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting strategy system status:", { error: error });
    return apiResponse.error("Failed to get system status", 500);
  }
}
